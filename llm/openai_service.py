from __future__ import annotations

import json
import uuid
from typing import Any

from openai import OpenAI

from backend import question_engine


_QUESTION_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "interview_question",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["question", "interview_category", "focus_area", "difficulty", "question_type", "format", "concept_id", "scenario_id", "follow_up_to_question_id", "expected_answer", "explanation", "evaluation_criteria", "tags", "options", "option_explanations", "correct_option"],
            "properties": {
                "question": {"type": "string"},
                "interview_category": {"type": "string", "enum": ["Technical", "Situational", "Behavioral", "System design"]},
                "focus_area": {"type": "string"},
                "difficulty": {"type": "string", "enum": ["Entry", "Intermediate", "Advanced"]},
                "question_type": {"type": "string", "enum": ["Troubleshooting", "Scenario", "Decision making", "System design", "Behavioral", "Multiple choice", "Follow-up"]},
                "format": {"type": "string", "enum": ["multiple_choice"]},
                "concept_id": {"type": "string"},
                "scenario_id": {"type": "string"},
                "follow_up_to_question_id": {"type": "string"},
                "expected_answer": {"type": "string"},
                "explanation": {"type": "string"},
                "evaluation_criteria": {"type": "array", "items": {"type": "string"}},
                "tags": {"type": "array", "items": {"type": "string"}},
                "options": {
                    "type": "object", "additionalProperties": False, "required": ["A", "B", "C", "D"],
                    "properties": {key: {"type": "string"} for key in ("A", "B", "C", "D")},
                },
                "option_explanations": {
                    "type": "object", "additionalProperties": False, "required": ["A", "B", "C", "D"],
                    "properties": {key: {"type": "string"} for key in ("A", "B", "C", "D")},
                },
                "correct_option": {"type": "string", "enum": ["A", "B", "C", "D"]},
            },
        },
    },
}


def _complete(api_key: str, model: str, system_prompt: str, user_prompt: str, response_format: dict[str, Any] | None = None) -> dict[str, Any]:
    client = OpenAI(api_key=api_key, timeout=25.0, max_retries=2)
    response = client.chat.completions.create(
        model=model,
        response_format=response_format or {"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.7,
    )
    content = response.choices[0].message.content
    if not content:
        raise ValueError("The AI returned an empty response.")
    return json.loads(content)


def _difficulty(experience: str) -> str:
    value = experience.casefold()
    if any(term in value for term in ("entry", "early", "career change")):
        return "Entry"
    if any(term in value for term in ("senior", "lead", "principal", "8+")):
        return "Advanced"
    return "Intermediate"


def generate_question(
    api_key: str,
    model: str,
    setup: dict[str, Any],
    history: list[dict[str, Any]],
    question_number: int,
    requested_format: str,
    requested_type: str,
    focus_area: str,
) -> dict[str, Any]:
    family = question_engine.role_family(setup["role"])
    type_instruction = "Write one single-answer multiple-choice interview question with four plausible options."
    system_prompt = (
        "You are a senior technical interviewer. Produce a realistic job-specific interview question using the supplied context. "
        "Prefer concrete production constraints, diagnostic evidence, prioritization, reliability, security, and engineering trade-offs. "
        "Do not add the job title to a generic prompt to simulate personalization. Do not reuse or paraphrase any prior scenario, concept, or question. "
        f"{type_instruction} Match the candidate experience. Include one best answer, three plausible distractors based on realistic trade-offs or common mistakes, "
        "and a specific explanation for why each of the four options is or is not the best. Keep option lengths and specificity balanced. "
        "For a Follow-up, build on the most recent candidate answer, "
        "introduce a material new constraint, and ask how the approach changes; do not repeat the original question. Return only the required schema."
    )
    prompt_data = {
        "role": setup["role"],
        "role_family": family,
        "experience_level": setup["experience"],
        "target_difficulty": _difficulty(setup["experience"]),
        "interview_type": setup["interview_type"],
        "focus_area": focus_area,
        "requested_format": requested_format,
        "requested_question_type": requested_type,
        "round_question_number": question_number,
        "follow_up_target": next((
            {key: item.get(key, "") for key in ("question_id", "question", "candidate_answer", "was_correct", "concept_id", "scenario_id")}
            for item in reversed(history) if item.get("candidate_answer")
        ), None) if requested_type == "Follow-up" else None,
        "recent_question_history": [
            {key: item.get(key, "") for key in ("question_id", "question", "concept_id", "scenario_id", "focus_area", "question_type", "candidate_answer", "was_correct")}
            for item in history[-30:]
        ],
    }
    last_error: Exception | None = None
    for _ in range(3):
        result = _complete(api_key, model, system_prompt, json.dumps(prompt_data), _QUESTION_SCHEMA)
        question = {
            **result,
            "question_id": str(uuid.uuid4()),
            "role_family": family,
            "role": setup["role"],
            "experience_level": setup["experience"],
            "focus_area": focus_area,
            "source": "openai",
        }
        if question.get("format") != requested_format or question.get("question_type") != requested_type:
            last_error = ValueError("The AI returned the wrong question type or format.")
            prompt_data["requested_format"] = requested_format
            continue
        if requested_type == "Follow-up":
            follow_up_target = prompt_data.get("follow_up_target") or {}
            if question.get("follow_up_to_question_id") != follow_up_target.get("question_id"):
                last_error = ValueError("The AI follow-up did not reference the preceding answered question.")
                continue
        elif question.get("follow_up_to_question_id"):
            last_error = ValueError("Only follow-up questions may reference an earlier question.")
            continue
        try:
            question_engine.validate_question(question)
        except ValueError as error:
            last_error = error
            continue
        if question_engine.is_duplicate(question, history):
            last_error = ValueError("The AI generated a duplicate interview question.")
            prompt_data["recent_question_history"].append({
                "question": question["question"],
                "concept_id": question["concept_id"],
                "scenario_id": question["scenario_id"],
            })
            continue
        return question
    raise ValueError("Could not generate a new valid question.") from last_error


def evaluate_open_answer(api_key: str, model: str, setup: dict[str, Any], question: dict[str, Any], answer: str) -> dict[str, Any]:
    result = _complete(
        api_key,
        model,
        "You are a senior interviewer evaluating an open-ended answer against the provided rubric. Be evidence-based and constructive. "
        "Return valid JSON with score as an integer 0-100, feedback as a concise paragraph, strengths as an array of strings, "
        "growth_areas as an array of strings, and next_steps as an array of actionable strings. Do not infer experience not stated.",
        json.dumps({
            "role": setup["role"],
            "experience": setup["experience"],
            "question": question["question"],
            "evaluation_criteria": question["evaluation_criteria"],
            "expected_answer": question["expected_answer"],
            "candidate_answer": answer,
        }),
    )
    score = max(0, min(100, int(result.get("score", 0))))
    return {
        "score": score,
        "is_correct": score >= 60,
        "feedback": str(result.get("feedback", "Review complete.")).strip(),
        "strengths": _string_list(result.get("strengths")),
        "growth_areas": _string_list(result.get("growth_areas")),
        "next_steps": _string_list(result.get("next_steps")),
    }


def summarize_quiz(api_key: str, model: str, setup: dict[str, Any], results: list[dict[str, Any]], focus_stats: list[dict[str, Any]]) -> dict[str, Any]:
    result = _complete(
        api_key,
        model,
        "You are a constructive interview coach. The supplied answer key and correctness values are authoritative; do not change or "
        "re-score them. Summarize what the candidate did well, focus areas with missed questions, and concrete next actions. "
        "Return valid JSON with feedback (one concise paragraph) and next_steps (array of 2-4 short actionable strings).",
        json.dumps({
            "role": setup["role"],
            "experience_level": setup["experience"],
            "results": results,
            "focus_accuracy": focus_stats,
        }),
    )
    return {
        "feedback": str(result.get("feedback", "Review complete.")).strip(),
        "next_steps": _string_list(result.get("next_steps")),
    }


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def demo_summary(correct_count: int, total_count: int, focus_stats: list[dict[str, Any]]) -> dict[str, Any]:
    weak_areas = [item["focus_area"] for item in focus_stats if item["correct"] < item["total"]]
    if weak_areas:
        feedback = f"You answered {correct_count} of {total_count} correctly. Review {', '.join(weak_areas)} before your next interview round."
        next_steps = [f"Review the fundamentals of {area.lower()} and explain why the best option works." for area in weak_areas[:3]]
    else:
        feedback = f"You answered all {total_count} questions correctly. Try a new round to keep building confidence."
        next_steps = ["Try another round with a different focus area.", "Explain the reasoning behind each answer aloud."]
    return {
        "feedback": feedback,
        "next_steps": next_steps,
    }