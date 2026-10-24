# Interview Ready AI

A local interview-practice website built with Flask and plain HTML, CSS, and JavaScript. Candidates create an account, choose a role, topic, difficulty, and question count, practise timed multiple-choice questions, review every answer choice, and receive a personal readiness report. Session answers and question metadata are stored in an Excel workbook; account records and server-side sessions are stored separately in SQLite.

Questions carry stable IDs, topic, difficulty, estimated time, per-choice explanations, and source metadata. Exact normalized text, stable IDs, concept/scenario metadata, and text similarity are checked against prior session questions. Intentional retries are retained for review but excluded from first-attempt accuracy and completion counts. The bank includes more than 100 curated questions. With an NVIDIA API key, the app can request generated questions, evaluations, and summaries; otherwise it selects unseen matching MCQs locally. NVIDIA connectivity has not been verified against a live key, and generated content falls back to the curated bank when a provider request fails.

The dark InterviewReady AI workspace includes a dashboard, searchable Prep Hub with topic availability and previews, structured learning roadmap, text-based mock interview setup, workbook-backed progress tracker, and interview-experience empty state. Topic availability and progress are based on the current question bank and saved workbook data; topics without matching questions and unverified experiences are identified rather than fabricated. Roadmap checkmarks and daily planner items are stored in the signed-in user's account; planner entries are scoped to the user's local calendar date.

## Run

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

To use AI-generated content, add an NVIDIA API key to `.env` as `NVIDIA_API_KEY`. Without a key, the app works in curated-bank mode. Start the complete app with:

```powershell
python run.py
```

Keep real credentials in the ignored local `.env` file; `.env.example` is for placeholders only. If a real credential was committed previously, rotate it because ignoring the file does not erase repository history.

Open http://127.0.0.1:5000 (or the configured `HOST` and `PORT`). Sign up on first use. The workbook is created automatically at `data/interview_practice.xlsx`; account data is created at `data/accounts.sqlite3`. Set `EXCEL_PATH` or `AUTH_DB_PATH` in `.env` to change their locations.

Question counts are configurable with `MAX_QUESTION_COUNT` (default `100`). Without NVIDIA generation, setup checks the number of unseen questions matching the selected role, focus areas, difficulty, and interview type. Per-question time defaults are configurable with `QUESTION_TIME_LIMIT_EASY_MINUTES`, `QUESTION_TIME_LIMIT_MEDIUM_MINUTES`, and `QUESTION_TIME_LIMIT_HARD_MINUTES`; grade boundaries use `GRADE_THRESHOLD_A`, `GRADE_THRESHOLD_B`, and `GRADE_THRESHOLD_C`.

## Project structure

- `frontend/`: Flask routes and plain HTML/CSS/JavaScript.
- `backend/auth_store.py`: password hashing and opaque, server-side SQLite sessions.
- `backend/excel_store.py`: additive workbook schema migration and per-user progress.
- `backend/question_engine.py`: structured role-aware bank, availability counts, validation, and duplicate detection.
- `backend/dsa_question_bank.py`: original programming, DSA, and communication questions.
- `llm/nvidia_service.py`: NVIDIA-compatible question generation, answer evaluation, and round summaries, with curated-bank fallback.
- `core/config.py`: environment-based application configuration.
- `run.py`: single application entry point.