# Your Prep Room

A local interview-practice website built with Flask and plain HTML, CSS, and JavaScript. Candidates practice role-specific rounds mixing troubleshooting, scenario, system-design, behavioral, open-ended, and multiple-choice questions. Sessions and question metadata are stored in an Excel workbook.

Questions carry stable IDs, role family, focus, category, difficulty, format, concept/scenario IDs, evaluation criteria, and source. Exact normalized text, concept/scenario metadata, and text similarity are checked against prior session questions. Incorrect answers can be retried intentionally without counting twice in round results. With an OpenAI key, question generation includes recent questions and answers; otherwise the app selects unseen matching questions from the curated bank and reports when it runs out.

## Run

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Add your OpenAI API key to `.env`, then launch the complete app with:

```powershell
python run.py
```

Open http://127.0.0.1:5000. Without an API key, the app runs in clearly labeled demo mode. The workbook is created automatically at `data/interview_practice.xlsx` on first use. Set `EXCEL_PATH` in `.env` to change its location.

## Project structure

- `frontend/`: Flask routes and plain HTML/CSS/JavaScript.
- `backend/excel_store.py`: safe append-only workbook schema migration and persistence.
- `backend/question_engine.py`: structured curated bank, role routing, validation, and duplicate detection.
- `llm/openai_service.py`: OpenAI question generation, answer evaluation, and round summaries, with curated-bank fallback.
- `core/config.py`: environment-based application configuration.
- `run.py`: single application entry point.