from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from backend import excel_store, question_engine
from frontend import create_app


class InterviewWorkflowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.workbook_path = Path(self.temporary_directory.name) / "practice.xlsx"
        self.app = create_app({
            "TESTING": True,
            "OPENAI_API_KEY": "",
            "EXCEL_PATH": self.workbook_path,
            "MAX_QUESTION_COUNT": 40,
        })
        self.client = self.app.test_client()
        self.setup = {
            "role": "Software engineer",
            "experience": "Mid-level (4-7 years)",
            "interview_type": "Mixed practice",
            "focus_areas": [
                "Problem solving", "Technical depth", "Reliability", "Security & reliability",
                "Performance", "Accessibility", "Communication", "Leadership", "Collaboration",
                "Impact & results",
            ],
        }

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def create_session(self, question_count: int = 4) -> str:
        response = self.client.post("/api/sessions", json={**self.setup, "question_count": question_count})
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()["session_id"]

    def test_brand_and_capacity_endpoint(self) -> None:
        page = self.client.get("/")
        self.assertIn(b"InterviewReady AI", page.data)
        for page_name in (b"Prep Hub", b"Learning Roadmap", b"Mock Interviews", b"Progress Tracker", b"Interview Experiences"):
            self.assertIn(page_name, page.data)
        self.assertNotIn(b"Upgrade to", page.data)
        capacity = self.client.post("/api/question-capacity", json=self.setup)
        self.assertEqual(capacity.status_code, 200)
        self.assertGreater(capacity.get_json()["available_question_count"], 0)

    def test_topic_availability_comes_from_question_bank(self) -> None:
        response = self.client.get("/api/topics")
        self.assertEqual(response.status_code, 200)
        topics = response.get_json()["topics"]
        self.assertTrue(all(isinstance(item["available_question_count"], int) for item in topics))
        self.assertTrue(any(item["available_question_count"] > 0 for item in topics))

    def test_topic_progress_does_not_double_count_intentional_retries(self) -> None:
        session_id = self.create_session(question_count=1)
        question = self.client.post(
            f"/api/sessions/{session_id}/practice",
            json={"round_number": 1},
        ).get_json()
        session = excel_store.get_session(self.workbook_path, session_id)
        record = next(row for row in session["practice"] if row["question_id"] == question["question_id"])
        incorrect_option = next(option for option in "ABCD" if option != record["correct_option"])
        self.client.post(
            f"/api/sessions/{session_id}/reviews",
            json={
                "question_id": question["question_id"],
                "selected_option": incorrect_option,
                "round_number": 1,
            },
        )
        retry = self.client.post(
            f"/api/sessions/{session_id}/retry",
            json={"question_id": question["question_id"], "round_number": 1},
        )
        self.assertEqual(retry.status_code, 200, retry.get_json())
        self.client.post(
            f"/api/sessions/{session_id}/reviews",
            json={
                "question_id": retry.get_json()["question_id"],
                "selected_option": record["correct_option"],
                "round_number": 1,
            },
        )

        dashboard = self.client.get("/api/dashboard").get_json()
        self.assertEqual(sum(topic["total"] for topic in dashboard["topic_stats"]), 1)
        self.assertEqual(dashboard["completed_session_count"], 1)

    def test_dashboard_metrics_use_saved_workbook_answers(self) -> None:
        empty = self.client.get("/api/dashboard").get_json()
        self.assertEqual(empty["session_count"], 0)
        self.assertIsNone(empty["accuracy"])
        session_id = self.create_session(question_count=1)
        question = self.client.post(
            f"/api/sessions/{session_id}/practice",
            json={"round_number": 1},
        ).get_json()
        record = next(
            row for row in excel_store.get_session(self.workbook_path, session_id)["practice"]
            if row["question_id"] == question["question_id"]
        )
        self.client.post(
            f"/api/sessions/{session_id}/reviews",
            json={"question_id": question["question_id"], "selected_option": record["correct_option"], "round_number": 1},
        )
        dashboard = self.client.get("/api/dashboard").get_json()
        self.assertEqual(dashboard["session_count"], 1)
        self.assertEqual(dashboard["attempted_count"], 1)
        self.assertEqual(dashboard["accuracy"], 100)
        self.assertEqual(dashboard["completed_session_count"], 1)
        self.assertEqual(sum(topic["total"] for topic in dashboard["topic_stats"]), 1)
        self.assertEqual(sum(topic["correct"] for topic in dashboard["topic_stats"]), 1)
        self.assertEqual(dashboard["recent_sessions"][0]["role"], self.setup["role"])

    def test_invalid_counts_and_custom_counts_over_twenty(self) -> None:
        for invalid in (0, -1, "3.5", "many", 41):
            response = self.client.post("/api/sessions", json={**self.setup, "question_count": invalid})
            self.assertEqual(response.status_code, 400, invalid)

        ai_app = create_app({
            "TESTING": True,
            "OPENAI_API_KEY": "configured-for-validation-only",
            "EXCEL_PATH": self.workbook_path,
            "MAX_QUESTION_COUNT": 40,
        })
        response = ai_app.test_client().post("/api/sessions", json={**self.setup, "question_count": 24})
        self.assertEqual(response.status_code, 200, response.get_json())
        session = excel_store.get_session(self.workbook_path, response.get_json()["session_id"])
        self.assertEqual(session["session"]["question_count"], 24)

    def test_demo_mode_rejects_counts_beyond_unique_inventory(self) -> None:
        available = question_engine.count_available_questions(self.setup, [])
        response = self.client.post("/api/sessions", json={**self.setup, "question_count": available + 1})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.get_json()["available_question_count"], available)

    def test_mcq_key_security_scoring_and_results(self) -> None:
        session_id = self.create_session()
        first = self.client.post(
            f"/api/sessions/{session_id}/practice",
            json={"round_number": 1},
        )
        self.assertEqual(first.status_code, 200, first.get_json())
        question = first.get_json()
        self.assertEqual(set(question["options"]), {"A", "B", "C", "D"})
        self.assertNotIn("correct_option", question)
        self.assertNotIn("option_explanations", question)

        stored = excel_store.get_session(self.workbook_path, session_id)
        record = next(row for row in stored["practice"] if row["question_id"] == question["question_id"])
        self.assertTrue(record["bank_question_id"])
        correct_option = record["correct_option"]
        wrong_option = next(option for option in "ABCD" if option != correct_option)

        missing = self.client.post(
            f"/api/sessions/{session_id}/reviews",
            json={"question_id": question["question_id"], "round_number": 1},
        )
        self.assertEqual(missing.status_code, 400)

        incorrect = self.client.post(
            f"/api/sessions/{session_id}/reviews",
            json={"question_id": question["question_id"], "selected_option": wrong_option, "round_number": 1},
        )
        self.assertEqual(incorrect.status_code, 200, incorrect.get_json())
        review = incorrect.get_json()["review"]
        self.assertFalse(review["is_correct"])
        self.assertEqual(review["correct_option"], correct_option)
        self.assertEqual(set(review["option_explanations"]), {"A", "B", "C", "D"})
        self.assertTrue(review["option_explanations"][wrong_option])
        self.assertTrue(review["option_explanations"][correct_option])

        duplicate_submit = self.client.post(
            f"/api/sessions/{session_id}/reviews",
            json={"question_id": question["question_id"], "selected_option": correct_option, "round_number": 1},
        )
        self.assertEqual(duplicate_submit.status_code, 409)

        duplicate_question = self.client.post(
            f"/api/sessions/{session_id}/practice",
            json={"round_number": 1},
        )
        self.assertEqual(duplicate_question.status_code, 200, duplicate_question.get_json())
        self.assertNotEqual(duplicate_question.get_json()["question_id"], question["question_id"])

        correct_question = duplicate_question.get_json()
        correct_record = next(
            row for row in excel_store.get_session(self.workbook_path, session_id)["practice"]
            if row["question_id"] == correct_question["question_id"]
        )
        correct_response = self.client.post(
            f"/api/sessions/{session_id}/reviews",
            json={"question_id": correct_question["question_id"], "selected_option": correct_record["correct_option"], "round_number": 1},
        )
        self.assertTrue(correct_response.get_json()["review"]["is_correct"])

        summary = self.client.get(f"/api/sessions/{session_id}?round=1").get_json()
        self.assertEqual(summary["requested_question_count"], 4)
        self.assertEqual(summary["attempted_count"], 2)
        self.assertEqual(summary["correct_count"], 1)
        self.assertEqual(summary["incorrect_count"], 1)
        self.assertEqual(summary["accuracy"], 50)

    def test_requested_session_completes_at_its_own_count(self) -> None:
        session_id = self.create_session(question_count=2)
        for expected_number in (1, 2):
            response = self.client.post(
                f"/api/sessions/{session_id}/practice",
                json={"round_number": 1},
            )
            self.assertEqual(response.status_code, 200, response.get_json())
            question = response.get_json()
            self.assertEqual(question["question_number"], expected_number)
            self.assertEqual(question["question_count"], 2)
            row = next(
                record for record in excel_store.get_session(self.workbook_path, session_id)["practice"]
                if record["question_id"] == question["question_id"]
            )
            review = self.client.post(
                f"/api/sessions/{session_id}/reviews",
                json={
                    "question_id": question["question_id"],
                    "selected_option": row["correct_option"],
                    "round_number": 1,
                },
            )
            self.assertTrue(review.get_json()["review"]["is_correct"])

        summary = self.client.get(f"/api/sessions/{session_id}?round=1").get_json()
        self.assertEqual(summary["requested_question_count"], 2)
        self.assertEqual(summary["score_total"], 2)
        self.assertEqual(summary["attempted_count"], 2)
        self.assertEqual(summary["correct_count"], 2)
        self.assertEqual(summary["accuracy"], 100)
        exhausted = self.client.post(
            f"/api/sessions/{session_id}/practice",
            json={"round_number": 1},
        )
        self.assertEqual(exhausted.status_code, 409)

    def test_stable_id_and_metadata_duplicate_detection(self) -> None:
        question = {"question_id": "same-id", "question": "first prompt", "role_family": "backend"}
        self.assertTrue(question_engine.is_duplicate(question, [question]))
        self.assertTrue(question_engine.is_duplicate(
            {"question_id": "stable-bank-id", "question": "New wording", "role_family": "backend"},
            [{"question_id": "attempt-id", "bank_question_id": "stable-bank-id", "question": "Prior wording"}],
        ))
        self.assertTrue(question_engine.is_duplicate(
            {"question": "How should the service handle stale data?", "concept_id": "cache-freshness", "role_family": "backend"},
            [{"question": "Prior wording", "concept_id": "cache-freshness", "role_family": "backend"}],
        ))
        self.assertTrue(question_engine.is_duplicate(
            {"question": " DNS failure! ", "concept_id": "new", "role_family": "devops"},
            [{"question": "dns   failure", "concept_id": "old", "role_family": "devops"}],
        ))

    def test_default_demo_capacity_for_supported_roles(self) -> None:
        focus_areas = [
            "Communication", "Problem solving", "Leadership", "Technical depth",
            "Impact & results", "Collaboration",
        ]
        for role in ("Software engineer", "Application engineer", "Quality engineer", "Architect", "DevOps engineer"):
            setup = {**self.setup, "role": role, "focus_areas": focus_areas}
            self.assertGreaterEqual(question_engine.count_available_questions(setup, []), 5, role)


if __name__ == "__main__":
    unittest.main()
