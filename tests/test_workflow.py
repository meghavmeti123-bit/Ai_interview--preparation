from __future__ import annotations

import tempfile
import unittest
import re
from pathlib import Path
import sqlite3
from contextlib import closing

from backend import excel_store, question_engine
from frontend import create_app


class InterviewWorkflowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.workbook_path = Path(self.temporary_directory.name) / "practice.xlsx"
        self.auth_path = Path(self.temporary_directory.name) / "accounts.sqlite3"
        self.app = create_app({
            "TESTING": True,
            "NVIDIA_API_KEY": "",
            "EXCEL_PATH": self.workbook_path,
            "AUTH_DB_PATH": self.auth_path,
            "MAX_QUESTION_COUNT": 40,
        })
        self.client = self.app.test_client()
        self.signup(self.client, "Test Candidate", "candidate@example.com", "correct-horse-battery")
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

    def csrf_token(self, client, path: str) -> str:
        page = client.get(path).get_data(as_text=True)
        match = re.search(r'name="csrf_token" value="([^"]+)"', page)
        self.assertIsNotNone(match)
        return match.group(1)

    def signup(self, client, full_name: str, email: str, password: str):
        token = self.csrf_token(client, "/signup")
        return client.post("/signup", data={
            "csrf_token": token,
            "full_name": full_name,
            "email": email,
            "password": password,
            "confirm_password": password,
        }, follow_redirects=False)

    def login(self, client, email: str = "candidate@example.com", password: str = "correct-horse-battery"):
        token = self.csrf_token(client, "/login")
        return client.post("/login", data={
            "csrf_token": token,
            "email": email,
            "password": password,
        }, follow_redirects=False)

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

    def test_signup_hashes_password_and_rejects_duplicate_normalized_email(self) -> None:
        duplicate = self.signup(self.client, "Another Candidate", " CANDIDATE@EXAMPLE.COM ", "correct-horse-battery")
        self.assertEqual(duplicate.status_code, 409)
        with closing(sqlite3.connect(self.auth_path)) as connection:
            user = connection.execute("SELECT email, password_hash FROM users").fetchone()
        self.assertEqual(user[0], "candidate@example.com")
        self.assertNotEqual(user[1], "correct-horse-battery")
        self.assertTrue(user[1].startswith("scrypt:"))

    def test_login_logout_and_authentication_protection(self) -> None:
        anonymous = self.app.test_client()
        self.assertEqual(anonymous.get("/").status_code, 302)
        self.assertEqual(anonymous.get("/api/dashboard").status_code, 401)
        self.assertEqual(anonymous.get("/api/dashboard").get_json()["error"], "Please sign in to continue.")
        self.assertEqual(anonymous.post("/api/not-a-route").status_code, 401)

        token = self.csrf_token(anonymous, "/login")
        login = anonymous.post("/login", data={
            "csrf_token": token,
            "email": "CANDIDATE@example.com",
            "password": "correct-horse-battery",
        })
        self.assertEqual(login.status_code, 302)
        self.assertEqual(anonymous.get("/").status_code, 200)
        logout_token = re.search(
            r'name="csrf_token" value="([^"]+)"',
            anonymous.get("/").get_data(as_text=True),
        ).group(1)
        logout = anonymous.post("/logout", data={"csrf_token": logout_token})
        self.assertEqual(logout.status_code, 302)
        self.assertEqual(anonymous.get("/").status_code, 302)

    def test_users_cannot_view_another_users_session_or_progress(self) -> None:
        session_id = self.create_session(question_count=1)
        second_client = self.app.test_client()
        self.signup(second_client, "Second Candidate", "second@example.com", "another-secure-password")
        self.assertEqual(second_client.get(f"/api/sessions/{session_id}").status_code, 404)
        self.assertEqual(second_client.post(
            f"/api/sessions/{session_id}/practice", json={"round_number": 1},
        ).status_code, 404)
        dashboard = second_client.get("/api/dashboard").get_json()
        self.assertEqual(dashboard["session_count"], 0)
        self.assertEqual(self.client.get("/api/dashboard").get_json()["session_count"], 1)

    def test_checklist_progress_persists_per_user_and_planner_day(self) -> None:
        csrf_token = re.search(
            r'data-csrf-token="([^"]+)"',
            self.client.get("/").get_data(as_text=True),
        ).group(1)
        headers = {"X-CSRF-Token": csrf_token}
        date = "2026-10-24"
        roadmap = self.client.put(
            "/api/user-progress/roadmap",
            json={"completed": ["interview-basics", "arrays-strings"]},
            headers=headers,
        )
        planner = self.client.put(
            "/api/user-progress/planner",
            json={"date": date, "completed": ["practice", "review"]},
            headers=headers,
        )
        self.assertEqual(roadmap.status_code, 200, roadmap.get_json())
        self.assertEqual(planner.status_code, 200, planner.get_json())

        second_client = self.app.test_client()
        self.login(second_client)
        saved = second_client.get(f"/api/user-progress?date={date}").get_json()
        self.assertEqual(saved["roadmap_completed"], ["arrays-strings", "interview-basics"])
        self.assertEqual(saved["planner_completed"], ["practice", "review"])
        following_day = second_client.get("/api/user-progress?date=2026-10-25").get_json()
        self.assertEqual(following_day["planner_completed"], [])

        another_user = self.app.test_client()
        self.signup(another_user, "Second Candidate", "second@example.com", "another-secure-password")
        other_progress = another_user.get(f"/api/user-progress?date={date}").get_json()
        self.assertEqual(other_progress["roadmap_completed"], [])
        self.assertEqual(other_progress["planner_completed"], [])

    def test_checklist_progress_rejects_invalid_data_and_missing_csrf(self) -> None:
        invalid_date = self.client.get("/api/user-progress?date=2026-02-30")
        self.assertEqual(invalid_date.status_code, 400)
        malformed = self.client.put(
            "/api/user-progress/roadmap",
            json={"completed": ["valid", 3]},
            headers={"X-CSRF-Token": re.search(
                r'data-csrf-token="([^"]+)"',
                self.client.get("/").get_data(as_text=True),
            ).group(1)},
        )
        self.assertEqual(malformed.status_code, 400)
        missing_csrf = self.client.put(
            "/api/user-progress/planner",
            json={"date": "2026-10-24", "completed": ["practice"]},
        )
        self.assertEqual(missing_csrf.status_code, 400)

    def test_api_unknown_route_returns_json(self) -> None:
        response = self.client.get("/api/does-not-exist")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.mimetype, "application/json")
        self.assertIn("error", response.get_json())

    def test_topic_availability_comes_from_question_bank(self) -> None:
        response = self.client.get("/api/topics")
        self.assertEqual(response.status_code, 200)
        topics = response.get_json()["topics"]
        self.assertTrue(all(isinstance(item["available_question_count"], int) for item in topics))
        self.assertTrue(any(item["available_question_count"] > 0 for item in topics))
        dsa = self.client.get("/api/topics/Data%20Structures%20and%20Algorithms").get_json()
        self.assertGreater(dsa["available_question_count"], 0)
        self.assertTrue(dsa["reference_url"].startswith("https://takeuforward.org/"))

    def test_question_bank_has_over_one_hundred_unique_usable_mcqs(self) -> None:
        mcqs = [item for item in question_engine.QUESTION_BANK if item["format"] == "multiple_choice"]
        self.assertGreaterEqual(len(mcqs), 100)
        self.assertEqual(len({item["question_id"] for item in mcqs}), len(mcqs))
        self.assertTrue(all(set(item["options"]) == {"A", "B", "C", "D"} for item in mcqs))

    def test_timeout_is_saved_as_incorrect_and_dashboard_uses_attempt_grade(self) -> None:
        setup = {
            "role": "Software engineer",
            "experience": "Mid-level (4-7 years)",
            "interview_type": "Technical",
            "focus_areas": ["Arrays"],
            "difficulty": "Easy",
            "question_count": 1,
        }
        session_response = self.client.post("/api/sessions", json=setup)
        self.assertEqual(session_response.status_code, 200, session_response.get_json())
        session_id = session_response.get_json()["session_id"]
        question_response = self.client.post(
            f"/api/sessions/{session_id}/practice",
            json={"round_number": 1},
        )
        self.assertEqual(question_response.status_code, 200, question_response.get_json())
        question = question_response.get_json()
        self.assertEqual(question["difficulty"], "Easy")
        self.assertGreaterEqual(question["time_limit_seconds"], 60)
        self.assertEqual(question["time_limit_seconds"], 5 * 60)

        early_timeout = self.client.post(
            f"/api/sessions/{session_id}/reviews",
            json={
                "question_id": question["question_id"],
                "round_number": 1,
                "elapsed_seconds": question["time_limit_seconds"] - 1,
                "timed_out": True,
            },
        )
        self.assertEqual(early_timeout.status_code, 400)
        timeout = self.client.post(
            f"/api/sessions/{session_id}/reviews",
            json={
                "question_id": question["question_id"],
                "round_number": 1,
                "elapsed_seconds": question["time_limit_seconds"],
                "timed_out": True,
            },
        )
        self.assertEqual(timeout.status_code, 200, timeout.get_json())
        self.assertFalse(timeout.get_json()["review"]["is_correct"])
        self.assertTrue(timeout.get_json()["review"]["timed_out"])

        summary = self.client.get(f"/api/sessions/{session_id}?round=1").get_json()
        self.assertEqual(summary["attempted_count"], 1)
        self.assertEqual(summary["accuracy"], 0)
        self.assertEqual(summary["grade"], "D")
        self.assertEqual(summary["full_name"], "Test Candidate")
        self.assertEqual(summary["attempt_number"], 1)
        self.assertTrue(summary["items"][0]["timed_out"])
        dashboard = self.client.get("/api/dashboard").get_json()
        self.assertEqual(dashboard["attempted_count"], 1)
        self.assertEqual(dashboard["recent_sessions"][0]["grade"], "D")
        self.assertEqual(dashboard["recent_sessions"][0]["attempt_number"], 1)

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
        self.assertEqual(dashboard["attempted_count"], 1)
        self.assertEqual(dashboard["accuracy"], 0)
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
            "NVIDIA_API_KEY": "configured-for-validation-only",
            "EXCEL_PATH": self.workbook_path,
            "AUTH_DB_PATH": self.auth_path,
            "MAX_QUESTION_COUNT": 40,
        })
        ai_client = ai_app.test_client()
        self.login(ai_client)
        response = ai_client.post("/api/sessions", json={**self.setup, "question_count": 24})
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
