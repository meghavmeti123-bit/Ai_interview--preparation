from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "local-interview-coach-key")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    EXCEL_PATH = Path(os.getenv("EXCEL_PATH", str(PROJECT_ROOT / "data" / "interview_practice.xlsx")))
    HOST = os.getenv("HOST", "127.0.0.1")
    PORT = int(os.getenv("PORT", "5000"))
    DEBUG = os.getenv("FLASK_DEBUG", "false").lower() == "true"