from __future__ import annotations

import json
import random
import secrets
import re
from datetime import date
from functools import wraps
from typing import Any

from flask import Flask, g, jsonify, redirect, render_template, request, session, url_for
from werkzeug.exceptions import HTTPException

from backend import auth_store
from backend import excel_store
from backend import question_engine
from core.config import Config
from llm import nvidia_service


def create_app(overrides: dict[str, Any] | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    app.config["TEMPLATES_AUTO_RELOAD"] = True
    if overrides:
        app.config.update(overrides)
    app.session_interface = auth_store.SQLiteSessionInterface()

    @app.context_processor
    def expose_csrf_token():
        token = session.setdefault("csrf_token", secrets.token_urlsafe(32))
        return {"csrf_token": token}

    @app.errorhandler(HTTPException)
    def handle_http_error(error: HTTPException):
        if request.path.startswith("/api/"):
            return jsonify(error=error.description), error.code or 500
        return error

    @app.errorhandler(Exception)
    def handle_unexpected_error(error: Exception):
        app.logger.exception("Unexpected application error")
        if request.path.startswith("/api/"):
            return jsonify(error="The request could not be completed. Please try again."), 500
        return "The request could not be completed. Please try again.", 500

    @app.before_request
    def load_authenticated_user():
        if request.endpoint in {"static", "login", "login_submit", "signup", "signup_submit", "logout"}:
            return None
        user_id = session.get("user_id")
        user = auth_store.get_user(app.config["AUTH_DB_PATH"], str(user_id)) if user_id else None
        if user is None:
            session.clear()
            if request.path.startswith("/api/"):
                return jsonify(error="Please sign in to continue."), 401
            return redirect(url_for("login"))
        g.current_user = user
        return None

    @app.get("/login")
    def login():
        return render_template("auth.html", mode="login", error=None)

    @app.post("/login")
    def login_submit():
        if not _valid_csrf_token():
            return render_template("auth.html", mode="login", error="Your form expired. Refresh this page and try again."), 400
        user = auth_store.authenticate_user(
            app.config["AUTH_DB_PATH"],
            str(request.form.get("email", "")),
            str(request.form.get("password", "")),
        )
        if user is None:
            return render_template("auth.html", mode="login", error="Email or password is incorrect."), 401
        session.clear()
        session.regenerate()
        session["user_id"] = user["user_id"]
        return redirect(url_for("index"))

    @app.get("/signup")
    def signup():
        return render_template("auth.html", mode="signup", error=None)

    @app.post("/signup")
    def signup_submit():
        if not _valid_csrf_token():
            return render_template("auth.html", mode="signup", error="Your form expired. Refresh this page and try again."), 400
        full_name = str(request.form.get("full_name", "")).strip()
        email = str(request.form.get("email", "")).strip()
        password = str(request.form.get("password", ""))
        confirmation = str(request.form.get("confirm_password", ""))
        if password != confirmation:
            return render_template("auth.html", mode="signup", error="Passwords do not match."), 400
        try:
            user_id = auth_store.create_user(app.config["AUTH_DB_PATH"], full_name, email, password)
        except ValueError as error:
            return render_template("auth.html", mode="signup", error=str(error)), 400
        if user_id is None:
            return render_template("auth.html", mode="signup", error="An account with that email already exists."), 409
        session.clear()
        session.regenerate()
        session["user_id"] = user_id
        return redirect(url_for("index"))

    @app.post("/logout")
    def logout():
        if not _valid_csrf_token():
            return "Your form expired. Refresh the page and try again.", 400
        session.clear()
        return redirect(url_for("login"))

    @app.get("/")
    def index():
        return render_template(
            "index.html",
            demo_mode=not bool(app.config["NVIDIA_API_KEY"]),
            max_question_count=app.config["MAX_QUESTION_COUNT"],
            current_user=g.current_user,
        )

    @app.get("/api/dashboard")
    def dashboard():
        return jsonify(excel_store.get_dashboard_summary(
            app.config["EXCEL_PATH"], user_id=g.current_user["user_id"],
            grade_thresholds=app.config["GRADE_THRESHOLDS"],
        ))

    @app.get("/api/user-progress")
    def user_progress():
        local_date = _valid_progress_date(request.args.get("date"))
        if local_date is None:
            return jsonify(error="Provide a valid local date in YYYY-MM-DD format."), 400
        progress = auth_store.get_checklist_progress(
            app.config["AUTH_DB_PATH"], g.current_user["user_id"], local_date,
        )
        return jsonify(date=local_date, **progress)

    @app.put("/api/user-progress/roadmap")
    def update_roadmap_progress():
        if not _valid_csrf_token():
            return jsonify(error="Your request could not be verified. Reload the page and try again."), 400
        payload = request.get_json(silent=True)
        completed = _checklist_items(payload)
        if completed is None:
            return jsonify(error="Roadmap progress must be a list of at most 100 item IDs."), 400
        auth_store.save_roadmap_progress(
            app.config["AUTH_DB_PATH"], g.current_user["user_id"], completed,
        )
        return jsonify(roadmap_completed=completed)

    @app.put("/api/user-progress/planner")
    def update_planner_progress():
        if not _valid_csrf_token():
            return jsonify(error="Your request could not be verified. Reload the page and try again."), 400
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify(error="Planner progress must be a JSON object."), 400
        local_date = _valid_progress_date(payload.get("date"))
        completed = _checklist_items(payload)
        if local_date is None:
            return jsonify(error="Provide a valid local date in YYYY-MM-DD format."), 400
        if completed is None:
            return jsonify(error="Planner progress must be a list of at most 100 task IDs."), 400
        auth_store.save_planner_progress(
            app.config["AUTH_DB_PATH"], g.current_user["user_id"], local_date, completed,
        )
        return jsonify(date=local_date, planner_completed=completed)

    @app.get("/api/topics")
    def topics():
        topic_groups: dict[str, list[dict[str, Any]]] = {}
        for question in question_engine.QUESTION_BANK:
            topic_groups.setdefault(str(question["focus_area"]), []).append(question)
        topic_groups["Data Structures and Algorithms"] = [
            item for item in question_engine.QUESTION_BANK
            if str(item.get("course_section", "")).casefold() == "data structures and algorithms"
        ]
        topics = []
        for area, items in sorted(topic_groups.items(), key=lambda group: group[0].casefold()):
            topics.append({
                "focus_area": area,
                "topic": area,
                "available_question_count": sum(
                    1 for item in items
                    if item["format"] == "multiple_choice"
                    and str(item.get("role_family") or "general") in {"general", "backend"}
                ),
                "practice_focus_areas": sorted({str(item["focus_area"]) for item in items}),
                "difficulty_counts": {
                    difficulty: sum(
                        1 for item in items
                        if item["format"] == "multiple_choice"
                        and str(item.get("role_family") or "general") in {"general", "backend"}
                        and item["difficulty"].casefold() == difficulty.casefold()
                    )
                    for difficulty in ("Easy", "Medium", "Hard")
                },
            })
        return jsonify(topics=topics)

    @app.get("/api/topics/<path:topic_name>")
    def topic_status(topic_name: str):
        normalized = topic_name.strip().casefold()
        topic_questions = [
            question for question in question_engine.QUESTION_BANK
            if str(question.get("topic", question["focus_area"])).casefold() == normalized
            or str(question.get("course_section", "")).casefold() == normalized
            or str(question.get("focus_area", "")).casefold() == normalized
            or str(question.get("subtopic", "")).casefold() == normalized
        ]
        available = [
            question for question in topic_questions
            if question["format"] == "multiple_choice"
            and str(question.get("role_family") or "general") in {"general", "backend"}
        ]
        return jsonify(
            topic=topic_name,
            available_question_count=len(available),
            status="available" if available else "unavailable",
            practice_focus_areas=sorted({str(item["focus_area"]) for item in available}),
            question_types=sorted({str(item["question_type"]) for item in topic_questions}),
            difficulty_counts={
                difficulty: sum(item["difficulty"].casefold() == difficulty.casefold() for item in available)
                for difficulty in ("Easy", "Medium", "Hard")
            },
            question_titles=[
                {"question": item["question"], "subtopic": item.get("subtopic", "")}
                for item in available[:8]
            ],
            reference_url=next((item.get("source_reference", "") for item in topic_questions if item.get("source_reference")), ""),
        )

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
        difficulty = str(payload.get("difficulty", "")).strip()
        if difficulty and difficulty not in {"Easy", "Medium", "Hard"}:
            return jsonify(error="Choose Easy, Medium, or Hard difficulty, or select Any difficulty."), 400
        if not role or not experience or not interview_type or not isinstance(focus_areas, list):
            return jsonify(error="Choose a role, experience level, interview type, and at least one focus area."), 400
        clean_focus = list(dict.fromkeys(str(item).strip()[:60] for item in focus_areas if str(item).strip()))[:50]
        if not clean_focus:
            return jsonify(error="Choose at least one valid focus area."), 400
        setup = {"role": role[:100], "experience": experience, "interview_type": interview_type, "focus_areas": clean_focus, "difficulty": difficulty}
        available_count = question_engine.count_available_questions(setup, [])
        if not app.config["NVIDIA_API_KEY"] and question_count > available_count:
            return jsonify(
                error=f"Only {available_count} unseen MCQs are available for this role and focus selection. Reduce the count or configure NVIDIA question generation.",
                available_question_count=available_count,
                ai_generation_available=False,
            ), 422
        session_id = excel_store.create_session(
            app.config["EXCEL_PATH"], setup, question_count,
            user_id=g.current_user["user_id"], full_name=g.current_user["full_name"],
        )
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
        difficulty = str(payload.get("difficulty", "")).strip()
        if difficulty and difficulty not in {"Easy", "Medium", "Hard"}:
            return jsonify(error="Choose Easy, Medium, or Hard difficulty, or select Any difficulty."), 400
        setup = {"role": role[:100], "experience": experience, "interview_type": interview_type, "focus_areas": [str(item)[:60] for item in focus_areas[:50]], "difficulty": difficulty}
        return jsonify(
            available_question_count=question_engine.count_available_questions(setup, []),
            ai_generation_available=bool(app.config["NVIDIA_API_KEY"]),
            max_question_count=int(app.config["MAX_QUESTION_COUNT"]),
        )

    @app.post("/api/sessions/<session_id>/practice")
    def create_practice(session_id: str):
        data = excel_store.get_session(app.config["EXCEL_PATH"], session_id)
        if not _owned_session(data, g.current_user["user_id"]):
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
            if app.config["NVIDIA_API_KEY"]:
                practice = nvidia_service.generate_question(
                    app.config["NVIDIA_API_KEY"], app.config["NVIDIA_MODEL"], setup, history,
                    question_number, requested_format, requested_type, focus_area,
                )
        except Exception as error:
            app.logger.warning("NVIDIA question generation failed; trying curated questions (%s)", type(error).__name__)
        if practice is None:
            practice = question_engine.select_bank_question(setup, history, question_number)
        if practice is None:
            remaining = question_engine.count_available_questions(setup, history)
            return jsonify(error=f"No unseen questions remain for this role and setup. {remaining} unique curated questions remain; reduce the requested count or configure NVIDIA generation."), 409
        if question_engine.is_duplicate(practice, history):
            practice = question_engine.select_bank_question(setup, history, question_number)
        if practice is None:
            return jsonify(error="No new non-duplicate question is available for this setup."), 409
        time_limits = app.config["QUESTION_TIME_LIMITS"]
        practice["time_limit_seconds"] = max(
            60,
            int(practice.get("estimated_time_minutes") or time_limits.get(str(practice.get("difficulty")), 12)) * 60,
        )
        try:
            question_id = excel_store.add_practice(app.config["EXCEL_PATH"], session_id, practice, round_number)
        except ValueError:
            return jsonify(error="A duplicate question was detected. Request another question."), 409
        return jsonify(
            question_id=question_id,
            question_number=question_number,
            question_count=question_count,
            **_public_question(practice),
        )

    @app.post("/api/sessions/<session_id>/retry")
    def retry_question(session_id: str):
        payload = request.get_json(silent=True) or {}
        source_id = str(payload.get("question_id", ""))
        round_number = _round_number(payload.get("round_number"))
        if not source_id or round_number is None:
            return jsonify(error="Choose a reviewed question and a valid round."), 400
        data = excel_store.get_session(app.config["EXCEL_PATH"], session_id)
        if not _owned_session(data, g.current_user["user_id"]):
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
        if not _owned_session(data, g.current_user["user_id"]):
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
        timed_out = payload.get("timed_out") is True
        elapsed_seconds = payload.get("elapsed_seconds", 0)
        if isinstance(elapsed_seconds, bool) or not str(elapsed_seconds).isdecimal():
            return jsonify(error="Elapsed time must be a non-negative whole number of seconds."), 400
        elapsed_seconds = int(elapsed_seconds)
        time_limit_seconds = int(practice.get("time_limit_seconds") or 0)
        if time_limit_seconds and elapsed_seconds > time_limit_seconds:
            return jsonify(error="The recorded answer time exceeds the question time limit."), 400
        if timed_out and time_limit_seconds and elapsed_seconds < time_limit_seconds:
            return jsonify(error="A question can only be marked timed out after its time limit expires."), 400
        if time_limit_seconds and elapsed_seconds >= time_limit_seconds:
            timed_out = True
            selected_option = ""
        if question["format"] == "multiple_choice":
            if not timed_out and selected_option not in {"A", "B", "C", "D"}:
                return jsonify(error="Select one of the four answer options."), 400
            options = question["options"]
            correct_option = str(question["correct_option"]).upper()
            is_correct = not timed_out and selected_option == correct_option
            review = {
                "selected_option": selected_option,
                "correct_option": correct_option,
                "is_correct": is_correct,
                "score": 100 if is_correct else 0,
                "explanation": str(question["explanation"]),
                "option_explanations": question["option_explanations"],
                "feedback": "Time expired. Review the correct answer and its explanation." if timed_out else str(question["explanation"]),
                "focus_area": str(question["focus_area"]),
                "format": question["format"],
                "timed_out": timed_out,
                "strengths": ["Selected the strongest option."] if is_correct else [],
                "growth_areas": [] if is_correct else [str(question["focus_area"])],
                "next_steps": [],
            }
            selected_text = options[selected_option] if selected_option else "Time expired"
            correct_text = options[correct_option]
            answer = selected_text
        else:
            if len(answer) < 20:
                return jsonify(error="Add a little more detail before submitting your answer."), 400
            setup = _setup_from_row(data["session"])
            if app.config["NVIDIA_API_KEY"]:
                try:
                    review = nvidia_service.evaluate_open_answer(
                        app.config["NVIDIA_API_KEY"], app.config["NVIDIA_MODEL"], setup, question, answer,
                    )
                except Exception as error:
                    app.logger.warning("NVIDIA answer evaluation failed; using local rubric estimate (%s)", type(error).__name__)
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
        excel_store.add_review(
            app.config["EXCEL_PATH"], session_id, question_id, answer, review, round_number,
            elapsed_seconds=elapsed_seconds, timed_out=timed_out,
        )
        return jsonify(
            review=review,
            selected_text=selected_text,
            correct_text=correct_text,
            question=practice["question"],
        )

    @app.get("/api/sessions/<session_id>")
    def session_summary(session_id: str):
        data = excel_store.get_session(app.config["EXCEL_PATH"], session_id)
        if not _owned_session(data, g.current_user["user_id"]):
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
                "topic": practice.get("topic") or area,
                "subtopic": practice.get("subtopic", ""),
                "difficulty": practice.get("difficulty", ""),
                "estimated_time_minutes": practice.get("estimated_time_minutes"),
                "time_limit_seconds": practice.get("time_limit_seconds"),
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
                "elapsed_seconds": int(review.get("elapsed_seconds") or 0),
                "timed_out": _as_bool(review.get("timed_out")),
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
        feedback = nvidia_service.demo_summary(correct_count, len(items), focus_stats)
        if app.config["NVIDIA_API_KEY"] and items:
            try:
                feedback = nvidia_service.summarize_quiz(
                    app.config["NVIDIA_API_KEY"], app.config["NVIDIA_MODEL"],
                    _setup_from_row(data["session"]), items, focus_stats,
                )
            except Exception as error:
                app.logger.warning("NVIDIA summary generation failed; using local summary (%s)", type(error).__name__)
        accuracy = round(100 * correct_count / len(items)) if items else 0
        grade = _grade(accuracy, app.config["GRADE_THRESHOLDS"]) if items else None
        performance_feedback = _performance_feedback(accuracy) if items else "Complete at least one question to receive a score and feedback."
        completed_attempts = excel_store.get_dashboard_summary(
            app.config["EXCEL_PATH"],
            limit=100000,
            user_id=g.current_user["user_id"],
            grade_thresholds=app.config["GRADE_THRESHOLDS"],
        )["recent_sessions"]
        attempt = next((row for row in completed_attempts if row["session_id"] == session_id), None)
        return jsonify(
            setup=_setup_from_row(data["session"]),
            full_name=data["session"].get("full_name", g.current_user["full_name"]),
            created_at=data["session"].get("created_at", ""),
            attempt_number=attempt.get("attempt_number") if attempt else None,
            grade=grade,
            performance_feedback=performance_feedback,
            round_number=round_number,
            question_count=len(practice_rows),
            requested_question_count=session_question_count,
            review_count=len(reviews),
            correct_count=correct_count,
            incorrect_count=len(items) - correct_count,
            attempted_count=len(items),
            accuracy=accuracy,
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


def _grade(accuracy: int, thresholds: dict[str, int]) -> str:
    if accuracy >= int(thresholds["A"]):
        return "A"
    if accuracy >= int(thresholds["B"]):
        return "B"
    if accuracy >= int(thresholds["C"]):
        return "C"
    return "D"


def _performance_feedback(accuracy: int) -> str:
    if accuracy >= 90:
        return "Excellent work! You demonstrated strong understanding."
    if accuracy >= 75:
        return "Great job! Review the questions you missed to improve further."
    if accuracy >= 50:
        return "Good effort. Practise the weaker topics and try again."
    return "Don't give up. Review the explanations and take another attempt."


def _valid_csrf_token() -> bool:
    token = str(request.headers.get("X-CSRF-Token") or request.form.get("csrf_token", ""))
    expected = str(session.get("csrf_token", ""))
    return bool(token and expected and secrets.compare_digest(token, expected))


def _valid_progress_date(value: Any) -> str | None:
    if not isinstance(value, str) or len(value) != 10:
        return None
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        return None
    return value if parsed.isoformat() == value else None


def _checklist_items(payload: Any) -> list[str] | None:
    if not isinstance(payload, dict):
        return None
    items = payload.get("completed")
    if not isinstance(items, list) or len(items) > 100:
        return None
    normalized: list[str] = []
    for item in items:
        if not isinstance(item, str):
            return None
        item_id = item.strip()
        if not item_id or len(item_id) > 80:
            return None
        if item_id not in normalized:
            normalized.append(item_id)
    return normalized


def _owned_session(data: dict[str, Any] | None, user_id: str) -> bool:
    return bool(data and str(data["session"].get("user_id") or "") == user_id)


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
        "topic": question.get("topic", question["focus_area"]),
        "subtopic": question.get("subtopic", ""),
        "estimated_time_minutes": question.get("estimated_time_minutes", 12),
        "source_reference": question.get("source_reference", ""),
        "time_limit_seconds": question.get("time_limit_seconds", 0),
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
        "topic": row.get("topic") or row["focus_area"],
        "subtopic": row.get("subtopic", ""),
        "estimated_time_minutes": int(row.get("estimated_time_minutes") or 12),
        "source_reference": row.get("source_reference", ""),
        "time_limit_seconds": int(row.get("time_limit_seconds") or 0),
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
    feedback = (
        "Offline rubric estimate only; configure an NVIDIA API key for contextual review. "
        + f"Your answer touched {len(covered)} of {len(criteria)} evaluation points."
    )
    return {
        "score": score,
        "is_correct": passed,
        "feedback": feedback,
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
        "difficulty": row.get("difficulty") or "",
    }