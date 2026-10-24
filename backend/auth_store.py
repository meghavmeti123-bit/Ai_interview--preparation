from __future__ import annotations

import hashlib
import json
import re
import secrets
import sqlite3
import time
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask.sessions import CallbackDict, SessionInterface, SessionMixin
from werkzeug.security import check_password_hash, generate_password_hash


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SESSION_COOKIE_NAME = "interviewready_session"
SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 14


def _connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute(
        """CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )"""
    )
    connection.execute(
        """CREATE TABLE IF NOT EXISTS server_sessions (
            token_hash TEXT PRIMARY KEY,
            data_json TEXT NOT NULL,
            expires_at INTEGER NOT NULL
        )"""
    )
    connection.execute(
        """CREATE TABLE IF NOT EXISTS roadmap_progress (
            user_id TEXT NOT NULL,
            roadmap_id TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (user_id, roadmap_id)
        )"""
    )
    connection.execute(
        """CREATE TABLE IF NOT EXISTS planner_progress (
            user_id TEXT NOT NULL,
            local_date TEXT NOT NULL,
            task_id TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (user_id, local_date, task_id)
        )"""
    )
    connection.commit()
    return connection


def get_checklist_progress(path: Path, user_id: str, local_date: str) -> dict[str, list[str]]:
    with closing(_connect(path)) as connection:
        roadmap_rows = connection.execute(
            "SELECT roadmap_id FROM roadmap_progress WHERE user_id = ? ORDER BY roadmap_id",
            (user_id,),
        ).fetchall()
        planner_rows = connection.execute(
            "SELECT task_id FROM planner_progress WHERE user_id = ? AND local_date = ? ORDER BY task_id",
            (user_id, local_date),
        ).fetchall()
    return {
        "roadmap_completed": [row["roadmap_id"] for row in roadmap_rows],
        "planner_completed": [row["task_id"] for row in planner_rows],
    }


def save_roadmap_progress(path: Path, user_id: str, completed: list[str]) -> None:
    updated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with closing(_connect(path)) as connection:
        connection.execute("DELETE FROM roadmap_progress WHERE user_id = ?", (user_id,))
        connection.executemany(
            "INSERT INTO roadmap_progress (user_id, roadmap_id, updated_at) VALUES (?, ?, ?)",
            [(user_id, item, updated_at) for item in completed],
        )
        connection.commit()


def save_planner_progress(path: Path, user_id: str, local_date: str, completed: list[str]) -> None:
    updated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with closing(_connect(path)) as connection:
        connection.execute(
            "DELETE FROM planner_progress WHERE user_id = ? AND local_date = ?",
            (user_id, local_date),
        )
        connection.executemany(
            """INSERT INTO planner_progress (user_id, local_date, task_id, updated_at)
               VALUES (?, ?, ?, ?)""",
            [(user_id, local_date, item, updated_at) for item in completed],
        )
        connection.commit()


def create_user(path: Path, full_name: str, email: str, password: str) -> str | None:
    normalized_email = email.strip().casefold()
    if not EMAIL_PATTERN.fullmatch(normalized_email):
        raise ValueError("Enter a valid email address.")
    if len(full_name.strip()) < 2 or len(full_name.strip()) > 100:
        raise ValueError("Full name must be between 2 and 100 characters.")
    if len(password) < 10 or len(password) > 128:
        raise ValueError("Password must be between 10 and 128 characters.")
    import uuid
    from datetime import datetime, timezone

    user_id = str(uuid.uuid4())
    with closing(_connect(path)) as connection:
        try:
            connection.execute(
                "INSERT INTO users (user_id, full_name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                (
                    user_id, full_name.strip(), normalized_email, generate_password_hash(password),
                    datetime.now(timezone.utc).isoformat(timespec="seconds"),
                ),
            )
        except sqlite3.IntegrityError:
            return None
        connection.commit()
    return user_id


def authenticate_user(path: Path, email: str, password: str) -> dict[str, str] | None:
    normalized_email = email.strip().casefold()
    with closing(_connect(path)) as connection:
        row = connection.execute(
            "SELECT user_id, full_name, email, password_hash FROM users WHERE email = ?",
            (normalized_email,),
        ).fetchone()
    if row is None or not check_password_hash(row["password_hash"], password):
        return None
    return {"user_id": row["user_id"], "full_name": row["full_name"], "email": row["email"]}


def get_user(path: Path, user_id: str) -> dict[str, str] | None:
    with closing(_connect(path)) as connection:
        row = connection.execute(
            "SELECT user_id, full_name, email FROM users WHERE user_id = ?", (user_id,),
        ).fetchone()
    return dict(row) if row else None


class SQLiteSession(CallbackDict[str, Any], SessionMixin):
    def __init__(self, initial: dict[str, Any] | None = None, sid: str | None = None, new: bool = False):
        def on_update(_: dict[str, Any]) -> None:
            self.modified = True

        super().__init__(initial, on_update)
        self.sid = sid or secrets.token_urlsafe(32)
        self.new = new
        self.modified = False

    def regenerate(self) -> None:
        self.sid = secrets.token_urlsafe(32)
        self.new = True
        self.modified = True


class SQLiteSessionInterface(SessionInterface):
    session_class = SQLiteSession

    @staticmethod
    def _token_hash(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def open_session(self, app, request):
        token = request.cookies.get(self.get_cookie_name(app))
        if not token or len(token) > 128:
            return self.session_class(new=True)
        with closing(_connect(Path(app.config["AUTH_DB_PATH"]))) as connection:
            row = connection.execute(
                "SELECT data_json, expires_at FROM server_sessions WHERE token_hash = ?",
                (self._token_hash(token),),
            ).fetchone()
            if row is None:
                return self.session_class(new=True)
            if int(row["expires_at"]) <= int(time.time()):
                connection.execute("DELETE FROM server_sessions WHERE token_hash = ?", (self._token_hash(token),))
                connection.commit()
                return self.session_class(new=True)
        try:
            data = json.loads(row["data_json"])
        except (TypeError, json.JSONDecodeError):
            return self.session_class(new=True)
        if not isinstance(data, dict):
            return self.session_class(new=True)
        return self.session_class(data, sid=token)

    def save_session(self, app, session, response) -> None:
        cookie_name = self.get_cookie_name(app)
        path = Path(app.config["AUTH_DB_PATH"])
        if not session:
            with closing(_connect(path)) as connection:
                connection.execute("DELETE FROM server_sessions WHERE token_hash = ?", (self._token_hash(session.sid),))
                connection.commit()
            response.delete_cookie(
                cookie_name,
                domain=self.get_cookie_domain(app),
                path=self.get_cookie_path(app),
                secure=self.get_cookie_secure(app),
                httponly=self.get_cookie_httponly(app),
                samesite=self.get_cookie_samesite(app),
            )
            return
        if not session.modified and not session.new:
            return
        expires_at = int(time.time()) + SESSION_LIFETIME_SECONDS
        with closing(_connect(path)) as connection:
            connection.execute(
                "INSERT OR REPLACE INTO server_sessions (token_hash, data_json, expires_at) VALUES (?, ?, ?)",
                (self._token_hash(session.sid), json.dumps(dict(session)), expires_at),
            )
            connection.execute("DELETE FROM server_sessions WHERE expires_at <= ?", (int(time.time()),))
            connection.commit()
        response.set_cookie(
            cookie_name,
            session.sid,
            max_age=SESSION_LIFETIME_SECONDS,
            httponly=True,
            secure=self.get_cookie_secure(app),
            samesite="Lax",
            path=self.get_cookie_path(app),
            domain=self.get_cookie_domain(app),
        )
