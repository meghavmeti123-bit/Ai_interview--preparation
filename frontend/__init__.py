from __future__ import annotations

import json
import random
from typing import Any

from flask import Flask, jsonify, render_template, request

from backend import excel_store
from backend import question_engine
from core.config import Config
from llm import openai_service


def create_app(overrides: dict[str, Any] | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    app.config["TEMPLATES_AUTO_RELOAD"] = True
    if overrides:
        app.config.update(overrides)

    @app.get("/")
    def index():
        return render_template(
            "index.html",
            demo_mode=not bool(app.config["OPENAI_API_KEY"]),
            max_question_count=app.config["MAX_QUESTION_COUNT"],
        )

    @app.get("/api/dashboard")
    def dashboard():
        return jsonify(excel_store.get_dashboard_summary(app.config["EXCEL_PATH"]))

    @app.get("/api/topics")
    def topics():
        setup = {
            "role": "Software engineer",
            "experience": "Mid-level (4-7 years)",
            "interview_type": "Mixed practice",
            "focus_areas": [],
        }
        focus_areas = sorted({str(question["focus_area"]) for question in question_engine.QUESTION_BANK})
        return jsonify(topics=[
            {
                "focus_area": area,
                "available_question_count": question_engine.count_available_questions(
                    {**setup, "focus_areas": [area]}, [],
                ),
            }
            for area in focus_areas
        ])

    @app.post("/api/sessions")
    def start_session():
        payload = request.get_json(silent=True) or {}
        role = str(payload.get("role", "")).strip()
        experience = str(payload.get("experience", "")).strip()
        interview_type = str(payload.get("interview_type", "")).strip()
        focus_areas = payload.get("focus_areas")
        raw_count = payload.get("question_count")
        count_text = str(raw_count if raw_count is not None else "").strip()
        if isinstance(raw_count, bool) or not count_text.isdecimal() or len(count_text) > 9:
            return jsonify(error="Enter a whole number of questions greater than zero."), 400
        question_count = int(count_text)
        max_question_count = int(app.config["MAX_QUESTION_COUNT"])
        if question_count < 1 or question_count > max_question_count:
            return jsonify(error=f"Choose between 1 and {max_question_count} questions. This configurable limit protects the service from oversized requests."), 400
        if not role or not experience or not interview_type or not isinstance(focus_areas, list):
            return jsonify(error="Choose a role, experience level, interview type, and at least one focus area."), 400
        clean_focus = list(dict.fromkeys(str(item).strip()[:60] for item in focus_areas if str(item).strip()))[:12]
        if not clean_focus:
            return jsonify(error="Choose at least one valid focus area."), 400
        setup = {"role": role[:100], "experience": experience, "interview_type": interview_type, "focus_areas": clean_focus}
        available_count = question_engine.count_available_questions(setup, [])
        if not app.config["OPENAI_API_KEY"] and question_count > available_count:
            return jsonify(
                error=f"Only {available_count} unseen MCQs are available for this role and focus selection in demo mode. Reduce the count or configure OpenAI question generation.",
                available_question_count=available_count,
                ai_generation_available=False,
            ), 422
        session_id = excel_store.create_session(app.config["EXCEL_PATH"], setup, question_count)
        return jsonify(session_id=session_id, setup=setup, question_count=question_count, available_question_count=available_count)

    @app.post("/api/question-capacity")
    def question_capacity():
        payload = request.get_json(silent=True) or {}
        role = str(payload.get("role", "")).strip()
        experience = str(payload.get("experience", "")).strip()
        interview_type = str(payload.get("interview_type", "")).strip()
        focus_areas = payload.get("focus_areas")
        if not role or not experience or not interview_type or not isinstance(focus_areas, list):
            return jsonify(error="Complete the role, experience, interview type, and focus areas to check availability."), 400
        setup = {"role": role[:100], "experience": experience, "interview_type": interview_type, "focus_areas": [str(item)[:60] for item in focus_areas[:12]]}
        return jsonify(
            available_question_count=question_engine.count_available_questions(setup, []),
            ai_generation_available=bool(app.config["OPENAI_API_KEY"]),
            max_question_count=int(app.config["MAX_QUESTION_COUNT"]),
        )

    @app.post("/api/sessions/<session_id>/practice")
    def create_practice(session_id: str):
        data = excel_store.get_session(app.config["EXCEL_PATH"], session_id)
        if not data:
            return jsonify(error="Practice session not found."), 404
        payload = request.get_json(silent=True) or {}
        round_number = _round_number(payload.get("round_number", 1))
        if round_number is None:
            return jsonify(error="Round number must be a positive integer."), 400
        round_practice = [row for row in data["practice"] if int(row.get("round_number") or 1) == round_number]
        question_count = int(data["session"].get("question_count") or 5)
        base_round_practice = [row for row in round_practice if not bool(row.get("intentional_retry"))]
        if len(base_round_practice) >= question_count:
            return jsonify(error="This practice session is complete."), 409
        setup = _setup_from_row(data["session"])
        requested_focus = payload.get("focus_areas")
        if isinstance(requested_focus, list):
            selected_focus = [
                str(area) for area in requested_focus
                if str(area) in setup["focus_areas"]
                or question_engine.matches_focus(str(area), set(setup["focus_areas"]))
            ]
            if selected_focus:
                setup["focus_areas"] = selected_focus
        question_number = len(base_round_practice) + 1
        setup["focus_areas"] = [str(area) for area in setup["focus_areas"]]
        focus_pool = [
            str(area) for area in requested_focus
            if str(area) in setup["focus_areas"]
            or question_engine.matches_focus(str(area), set(setup["focus_areas"]))
        ] if isinstance(requested_focus, list) else []
        if focus_pool:
            setup["focus_areas"] = focus_pool
        focus_area = random.choice(setup["focus_areas"])
        requested_format = question_engine.requested_format(question_number, setup["interview_type"])
        requested_type = question_engine.requested_question_type(question_number, setup["interview_type"])
        reviews_by_question = {review["question_id"]: review for review in data["reviews"]}
        history = [
            {
                **item,
                "candidate_answer": (reviews_by_question.get(item["question_id"]) or {}).get("candidate_answer", ""),
                "was_correct": (reviews_by_question.get(item["question_id"]) or {}).get("is_correct", ""),
            }
            for item in data["practice"]
        ]
        practice = None
        try:
            if app.config["OPENAI_API_KEY"]:
                practice = openai_service.generate_question(
                    app.config["OPENAI_API_KEY"], app.config["OPENAI_MODEL"], setup, history,
                    question_number, requested_format, requested_type, focus_area,
                )
        except Exception:
            app.logger.exception("AI question generation failed; trying the curated bank")
        if practice is None:
            practice = question_engine.select_bank_question(setup, history, question_number)
        if practice is None:
            remaining = question_engine.count_available_questions(setup, history)
            return jsonify(error=f"No unseen questions remain for this role and setup. {remaining} unique curated MCQs remain; reduce the requested count or configure OpenAI generation."), 409
        if question_engine.is_duplicate(practice, history):
            practice = question_engine.select_bank_question(setup, history, question_number)
        if practice is None:
            return jsonify(error="No new non-duplicate question is available for this setup."), 409
        try:
            question_id = excel_store.add_practice(app.config["EXCEL_PATH"], session_id, practice, round_number)
        except ValueError:
            return jsonify(error="A duplicate question was detected. Request another question."), 409
        return jsonify(question_id=question_id, question_number=question_number, question_count=question_count, **_public_question(practice))

    @app.post("/api/sessions/<session_id>/retry")
    def retry_question(session_id: str):
        payload = request.get_json(silent=True) or {}
        source_id = str(payload.get("question_id", ""))
        round_number = _round_number(payload.get("round_number"))
        if not source_id or round_number is None:
            return jsonify(error="Choose a reviewed question and a valid round."), 400
        data = excel_store.get_session(app.config["EXCEL_PATH"], session_id)
        if not data:
            return jsonify(error="Practice session not found."), 404
        source = next((row for row in data["practice"] if row["question_id"] == source_id), None)
        review = next((row for row in data["reviews"] if row["question_id"] == source_id), None)
        if not source or not review or bool(review["is_correct"]):
            return jsonify(error="Only an incorrect, reviewed question can be intentionally retried."), 409
        practice = _practice_from_row(source)
        practice["intentional_retry"] = True
        question_id = excel_store.add_practice(
            app.config["EXCEL_PATH"], session_id, practice, round_number,
            intentional_retry=True, retry_of_question_id=source_id,
        )
        return jsonify(question_id=question_id, **_public_question(practice), intentional_retry=True)

    @app.post("/api/sessions/<session_id>/reviews")
    def review_practice(session_id: str):
        payload = request.get_json(silent=True) or {}
        question_id = str(payload.get("question_id", ""))
        selected_option = str(payload.get("selected_option", "")).strip().upper()
        answer = str(payload.get("answer", "")).strip()
        round_number = _round_number(payload.get("round_number", 1))
        if not question_id:
            return jsonify(error="Question ID is required."), 400
        if round_number is None:
            return jsonify(error="Round number must be a positive integer."), 400
        data = excel_store.get_session(app.config["EXCEL_PATH"], session_id)
        if not data:
            return jsonify(error="Practice session not found."), 404
        practice = next((
            row for row in data["practice"]
            if row["question_id"] == question_id and int(row.get("round_number") or 1) == round_number
        ), None)
        if not practice:
            return jsonify(error="Practice question not found in this session."), 404
        if any(row["question_id"] == question_id for row in data["reviews"]):
            return jsonify(error="This question has already been answered."), 409
        question = _practice_from_row(practice)
        if question["format"] == "multiple_choice":
            if selected_option not in {"A", "B", "C", "D"}:
                return jsonify(error="Select one of the four answer options."), 400
            options = question["options"]
            correct_option = str(question["correct_option"]).upper()
            is_correct = selected_option == correct_option
            review = {
                "selected_option": selected_option,
                "correct_option": correct_option,
                "is_correct": is_correct,
                "score": 100 if is_correct else 0,
                "explanation": str(question["explanation"]),
                "option_explanations": question["option_explanations"],
                "feedback": str(question["explanation"]),
                "focus_area": str(question["focus_area"]),
                "format": question["format"],
                "strengths": ["Selected the strongest option."] if is_correct else [],
                "growth_areas": [] if is_correct else [str(question["focus_area"])],
                "next_steps": [],
            }
            selected_text = options[selected_option]
            correct_text = options[correct_option]
            answer = selected_text
        else:
            if len(answer) < 20:
                return jsonify(error="Add a little more detail before submitting your answer."), 400
            setup = _setup_from_row(data["session"])
            if app.config["OPENAI_API_KEY"]:
                try:
                    review = openai_service.evaluate_open_answer(
                        app.config["OPENAI_API_KEY"], app.config["OPENAI_MODEL"], setup, question, answer,
                    )
                except Exception:
                    app.logger.exception("Open-answer evaluation failed; using local rubric estimate")
                    review = _demo_open_review(question, answer)
            else:
                review = _demo_open_review(question, answer)
            review.update({
                "selected_option": "",
                "correct_option": "",
                "explanation": review["feedback"],
                "focus_area": str(question["focus_area"]),
                "format": question["format"],
            })
            selected_text = answer
            correct_text = str(question["expected_answer"])
        excel_store.add_review(app.config["EXCEL_PATH"], session_id, question_id, answer, review, round_number)
        return jsonify(
            review=review,
            selected_text=selected_text,
            correct_text=correct_text,
            question=practice["question"],
        )

    @app.get("/api/sessions/<session_id>")
    def session_summary(session_id: str):
        data = excel_store.get_session(app.config["EXCEL_PATH"], session_id)
        if not data:
            return jsonify(error="Practice session not found."), 404
        round_number = _round_number(request.args.get("round", "1"))
        if round_number is None:
            return jsonify(error="Round number must be a positive integer."), 400
        practice_rows = [
            row for row in data["practice"]
            if int(row.get("round_number") or 1) == round_number and not bool(row.get("intentional_retry"))
        ]
        question_ids = {row["question_id"] for row in practice_rows}
        reviews = [row for row in data["reviews"] if row["question_id"] in question_ids]
        review_by_question = {row["question_id"]: row for row in reviews}
        items = []
        focus_summary: dict[str, dict[str, int]] = {}
        for practice in practice_rows:
            review = review_by_question.get(practice["question_id"])
            if not review:
                continue
            is_correct = _as_bool(review["is_correct"])
            area = str(practice["focus_area"])
            focus_summary.setdefault(area, {"correct": 0, "total": 0})
            focus_summary[area]["total"] += 1
            focus_summary[area]["correct"] += int(is_correct)
            items.append({
                "question_id": practice["question_id"],
                "question": practice["question"],
                "focus_area": area,
                "options": json.loads(practice.get("options_json") or "{}"),
                "option_explanations": json.loads(practice.get("option_explanations_json") or "{}"),
                "format": practice.get("format") or "multiple_choice",
                "question_type": practice.get("question_type") or "Multiple choice",
                "selected_option": review["selected_option"],
                "candidate_answer": review.get("candidate_answer", ""),
                "correct_option": review["correct_option"],
                "is_correct": is_correct,
                "score": int(review.get("score") or 0),
                "explanation": review["explanation"],
                "expected_answer": practice.get("expected_answer") or practice.get("sample_answer", ""),
                "intentional_retry": bool(practice.get("intentional_retry")),
                "strengths": json.loads(review.get("strengths") or "[]"),
                "growth_areas": json.loads(review.get("growth_areas") or "[]"),
            })
        focus_stats = [
            {"focus_area": area, "correct": counts["correct"], "total": counts["total"]}
            for area, counts in focus_summary.items()
        ]
        improvement_areas = [item["focus_area"] for item in focus_stats if item["correct"] < item["total"]]
        correct_count = sum(item["is_correct"] for item in items)
        session_question_count = int(data["session"].get("question_count") or len(practice_rows))
        feedback = openai_service.demo_summary(correct_count, len(items), focus_stats)
        if app.config["OPENAI_API_KEY"] and items:
            try:
                feedback = openai_service.summarize_quiz(
                    app.config["OPENAI_API_KEY"], app.config["OPENAI_MODEL"],
                    _setup_from_row(data["session"]), items, focus_stats,
                )
            except Exception:
                app.logger.exception("Quiz summary generation failed; using the local summary")
        return jsonify(
            setup=_setup_from_row(data["session"]),
            round_number=round_number,
            question_count=len(practice_rows),
            requested_question_count=session_question_count,
            review_count=len(reviews),
            correct_count=correct_count,
            incorrect_count=len(items) - correct_count,
            attempted_count=len(items),
            accuracy=round(100 * correct_count / len(items)) if items else 0,
            score_total=session_question_count,
            items=items,
            focus_stats=focus_stats,
            improvement_areas=improvement_areas,
            feedback=feedback["feedback"],
            next_steps=feedback["next_steps"],
        )

    return app


def _round_number(value: Any) -> int | None:
    try:
        round_number = int(value)
    except (TypeError, ValueError):
        return None
    return round_number if round_number > 0 else None


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().casefold() in {"1", "true", "yes", "y"}


def _public_question(question: dict[str, Any]) -> dict[str, Any]:
    return {
        "question": question["question"],
        "options": question["options"],
        "format": question["format"],
        "question_type": question["question_type"],
        "interview_category": question["interview_category"],
        "difficulty": question["difficulty"],
        "focus_area": question["focus_area"],
    }


def _practice_from_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "question_id": row["question_id"],
        "question": row["question"],
        "role": row.get("role", ""),
        "role_family": row.get("role_family", "general"),
        "experience_level": row.get("experience_level", ""),
        "interview_category": row.get("interview_category", "Technical"),
        "focus_area": row["focus_area"],
        "difficulty": row.get("difficulty", "Intermediate"),
        "question_type": row.get("question_type", "Multiple choice"),
        "format": row.get("format") or "multiple_choice",
        "concept_id": row.get("concept_id", ""),
        "scenario_id": row.get("scenario_id", ""),
        "bank_question_id": row.get("bank_question_id", ""),
        "expected_answer": row.get("expected_answer") or row.get("sample_answer", ""),
        "explanation": row.get("explanation", ""),
        "evaluation_criteria": json.loads(row.get("evaluation_criteria_json") or "[]"),
        "tags": json.loads(row.get("tags_json") or "[]"),
        "source": row.get("source", "legacy"),
        "options": json.loads(row.get("options_json") or "{}"),
        "option_explanations": json.loads(row.get("option_explanations_json") or "{}"),
        "correct_option": row.get("correct_option", ""),
        "intentional_retry": bool(row.get("intentional_retry", False)),
    }


def _demo_open_review(question: dict[str, Any], answer: str) -> dict[str, Any]:
    normalized_answer = question_engine.normalize_question(answer)
    answer_tokens = set(normalized_answer.split())
    criteria = question.get("evaluation_criteria", [])
    covered = [
        criterion for criterion in criteria
        if answer_tokens & set(question_engine.normalize_question(criterion).split())
    ]
    score = round(100 * len(covered) / max(1, len(criteria)))
    passed = score >= 40
    return {
        "score": score,
        "is_correct": passed,
        "feedback": "Offline rubric estimate only; add an OpenAI API key for a contextual review. "
        + (f"Your answer touched {len(covered)} of {len(criteria)} evaluation points."),
        "strengths": covered,
        "growth_areas": [item for item in criteria if item not in covered],
        "next_steps": [f"Address this evaluation point: {item}" for item in criteria if item not in covered][:3],
    }


def _setup_from_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "role": row["role"],
        "experience": row["experience"],
        "interview_type": row["interview_type"],
        "focus_areas": [area.strip() for area in str(row["focus_areas"]).split(",") if area.strip()],
    }