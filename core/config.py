from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "local-interview-coach-key")
    AUTH_DB_PATH = Path(os.getenv("AUTH_DB_PATH", str(PROJECT_ROOT / "data" / "accounts.sqlite3")))
    SESSION_COOKIE_NAME = "interviewready_session"
    SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"
    NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
    NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "meta/llama-3.3-70b-instruct")
    QUESTION_TIME_LIMITS = {
        "Easy": int(os.getenv("QUESTION_TIME_LIMIT_EASY_MINUTES", "5")),
        "Medium": int(os.getenv("QUESTION_TIME_LIMIT_MEDIUM_MINUTES", "12")),
        "Hard": int(os.getenv("QUESTION_TIME_LIMIT_HARD_MINUTES", "25")),
        "Entry": 5,
        "Intermediate": 12,
        "Advanced": 25,
    }
    GRADE_THRESHOLDS = {
        "A": int(os.getenv("GRADE_THRESHOLD_A", "90")),
        "B": int(os.getenv("GRADE_THRESHOLD_B", "75")),
        "C": int(os.getenv("GRADE_THRESHOLD_C", "50")),
    }
    MAX_QUESTION_COUNT = int(os.getenv("MAX_QUESTION_COUNT", "100"))
    EXCEL_PATH = Path(os.getenv("EXCEL_PATH", str(PROJECT_ROOT / "data" / "interview_practice.xlsx")))
    HOST = os.getenv("HOST", "127.0.0.1")
    PORT = int(os.getenv("PORT", "5000"))
    DEBUG = os.getenv("FLASK_DEBUG", "false").lower() == "true"