from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from openpyxl import Workbook, load_workbook


_LOCK = threading.RLock()
_HEADERS = {
    "Sessions": ["session_id", "created_at", "role", "experience", "interview_type", "focus_areas"],
    "Practice": [
        "question_id", "session_id", "created_at", "focus_area", "question", "sample_answer",
        "options_json", "correct_option", "explanation", "round_number", "role", "role_family",
        "experience_level", "interview_category", "difficulty", "question_type", "format", "concept_id",
        "scenario_id", "expected_answer", "evaluation_criteria_json", "tags_json", "source",
        "intentional_retry", "retry_of_question_id", "follow_up_to_question_id",
    ],
    "Reviews": [
        "review_id", "session_id", "question_id", "reviewed_at", "candidate_answer", "score",
        "strengths", "growth_areas", "next_steps", "feedback", "selected_option", "correct_option",
        "is_correct", "explanation", "round_number", "format", "evaluation_json",
    ],
}


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _open(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        workbook = Workbook()
        workbook.remove(workbook.active)
        for sheet_name, headers in _HEADERS.items():
            workbook.create_sheet(sheet_name).append(headers)
        workbook.save(path)
    workbook = load_workbook(path)
    for sheet_name, headers in _HEADERS.items():
        if sheet_name not in workbook.sheetnames:
            workbook.create_sheet(sheet_name).append(headers)
            continue
        sheet = workbook[sheet_name]
        current_headers = [cell.value for cell in sheet[1]] if sheet.max_row else []
        if not current_headers:
            sheet.append(headers)
        else:
            for header in headers:
                if header not in current_headers:
                    sheet.cell(row=1, column=len(current_headers) + 1, value=header)
                    current_headers.append(header)
    return workbook


def _records(sheet) -> list[dict[str, Any]]:
    rows = sheet.iter_rows(values_only=True)
    headers = next(rows, ())
    return [dict(zip(headers, row)) for row in rows if any(value is not None for value in row)]


def create_session(path: Path, setup: dict[str, Any]) -> str:
    with _LOCK:
        workbook = _open(Path(path))
        session_id = str(uuid.uuid4())
        workbook["Sessions"].append([
            session_id, _timestamp(), setup["role"], setup["experience"],
            setup["interview_type"], ", ".join(setup["focus_areas"]),
        ])
        workbook.save(path)
        return session_id


def add_practice(
    path: Path,
    session_id: str,
    practice: dict[str, Any],
    round_number: int,
    *,
    intentional_retry: bool = False,
    retry_of_question_id: str = "",
) -> str:
    with _LOCK:
        workbook = _open(Path(path))
        if not intentional_retry:
            from backend.question_engine import is_duplicate

            history = [
                row for row in _records(workbook["Practice"])
                if row["session_id"] == session_id and not bool(row.get("intentional_retry"))
            ]
            if is_duplicate(practice, history):
                raise ValueError("A duplicate interview question cannot be added to this session.")
        question_id = str(uuid.uuid4())
        values = {
            "question_id": question_id,
            "session_id": session_id,
            "created_at": _timestamp(),
            "focus_area": practice["focus_area"],
            "question": practice["question"],
            "sample_answer": practice.get("expected_answer", practice.get("sample_answer", "")),
            "options_json": json.dumps(practice["options"]),
            "correct_option": practice["correct_option"],
            "explanation": practice["explanation"],
            "round_number": round_number,
            "role": practice.get("role", ""),
            "role_family": practice.get("role_family", ""),
            "experience_level": practice.get("experience_level", ""),
            "interview_category": practice.get("interview_category", ""),
            "difficulty": practice.get("difficulty", ""),
            "question_type": practice.get("question_type", ""),
            "format": practice.get("format", "multiple_choice"),
            "concept_id": practice.get("concept_id", ""),
            "scenario_id": practice.get("scenario_id", ""),
            "expected_answer": practice.get("expected_answer", ""),
            "evaluation_criteria_json": json.dumps(practice.get("evaluation_criteria", [])),
            "tags_json": json.dumps(practice.get("tags", [])),
            "source": practice.get("source", ""),
            "intentional_retry": intentional_retry,
            "retry_of_question_id": retry_of_question_id,
            "follow_up_to_question_id": practice.get("follow_up_to_question_id", ""),
        }
        _append_record(workbook["Practice"], values)
        workbook.save(path)
        return question_id


def add_review(
    path: Path, session_id: str, question_id: str, answer: str, review: dict[str, Any], round_number: int,
) -> None:
    with _LOCK:
        workbook = _open(Path(path))
        values = {
            "review_id": str(uuid.uuid4()),
            "session_id": session_id,
            "question_id": question_id,
            "reviewed_at": _timestamp(),
            "candidate_answer": answer,
            "score": int(review.get("score", int(review["is_correct"]))),
            "strengths": json.dumps(["Correct answer selected"] if review["is_correct"] else []),
            "growth_areas": json.dumps([] if review["is_correct"] else [review["focus_area"]]),
            "next_steps": json.dumps([]),
            "feedback": review["explanation"],
            "selected_option": review["selected_option"],
            "correct_option": review["correct_option"],
            "is_correct": review["is_correct"],
            "explanation": review["explanation"],
            "round_number": round_number,
            "format": review.get("format", "multiple_choice"),
            "evaluation_json": json.dumps(review),
        }
        _append_record(workbook["Reviews"], values)
        workbook.save(path)


def _append_record(sheet, values: dict[str, Any]) -> None:
    headers = [cell.value for cell in sheet[1]]
    sheet.append([values.get(header) for header in headers])


def get_session(path: Path, session_id: str) -> dict[str, Any] | None:
    with _LOCK:
        workbook = _open(Path(path))
        session = next((row for row in _records(workbook["Sessions"]) if row["session_id"] == session_id), None)
        if session is None:
            return None
        practice = [row for row in _records(workbook["Practice"]) if row["session_id"] == session_id]
        reviews = [row for row in _records(workbook["Reviews"]) if row["session_id"] == session_id]
        return {"session": session, "practice": practice, "reviews": reviews}