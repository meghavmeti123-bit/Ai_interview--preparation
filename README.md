# Interview Ready AI

A local interview-practice website built with Flask and plain HTML, CSS, and JavaScript. Candidates choose a question count, practice with role-specific multiple-choice questions, review every answer choice, and receive a calculated readiness report. Sessions and question metadata are stored in an Excel workbook.

Questions carry stable source IDs, role family, focus, category, difficulty, concept/scenario IDs, per-choice explanations, and source. Exact normalized text, stable IDs, concept/scenario metadata, and text similarity are checked against prior session questions. Incorrect answers can be retried intentionally without counting twice in results. With an OpenAI key, question generation uses recent questions and answers; otherwise the app selects unseen matching MCQs from the curated bank and explains when it runs out.

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

Question counts are configurable with `MAX_QUESTION_COUNT` (default `100`). In demo mode, the setup checks the number of unseen questions matching the selected role and focus areas and will not create a session that the bank cannot complete.

## Project structure

- `frontend/`: Flask routes and plain HTML/CSS/JavaScript.
- `backend/excel_store.py`: safe append-only workbook schema migration and persistence.
- `backend/question_engine.py`: structured role-aware bank, availability counts, validation, and duplicate detection.
- `llm/openai_service.py`: OpenAI question generation, answer evaluation, and round summaries, with curated-bank fallback.
- `core/config.py`: environment-based application configuration.
- `run.py`: single application entry point.