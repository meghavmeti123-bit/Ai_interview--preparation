# InterviewReady AI

Personalized, role-specific interview preparation and practice platform rewritten in React + TypeScript with Vite, full-stack Express backend, Gemini AI question generation, live webcam anti-cheat proctoring, and voice answer integration.

## Key Features

- **Role & Focus Adaptive Practice**: Practice tailored questions for Software Engineers, Application Engineers, Quality Engineers, Architects, DevOps Engineers, or any custom role.
- **Dynamic AI Question Generation**: Connects to Google Gemini API (`gemini-3.8-flash`) via the modern `@google/genai` TypeScript SDK to generate custom multiple-choice questions matching candidate level and focus areas, with fallback to an in-depth curated question bank in Demo Mode.
- **Live Webcam & Anti-Cheat Proctoring Engine**:
  - Live candidate camera feed to simulate authentic proctored exam conditions.
  - Real-time tab-switching and window blur detection to flag when candidates leave the test window to search for answers.
  - Face-in-frame presence monitoring to ensure candidate integrity.
  - Configurable fullscreen enforcement and comprehensive Interview Integrity Audit reports.
- **Voice Integration**:
  - Speech-to-Text: Speak answers verbally ("Option A", "Option B", etc.) using microphone speech recognition.
  - Text-to-Speech: AI Interviewer reads questions and answer choices aloud with natural pacing.
- **Answer Checks & Readiness Reports**: Instant feedback for every choice (A, B, C, D) with in-depth rationale, overall accuracy calculation, focus area breakdowns, and intentional question retry.
- **Interview Workspace**:
  - **Dashboard**: High-level stats, accuracy metrics, and recent practice sessions.
  - **Prep Hub**: Searchable question library by topic, role, or focus area.
  - **Learning Roadmap**: 5-module structured preparation progression with interactive completion checklists.
  - **Mock Interviews**: Quick presets for HR, Technical Deep-Dive, Troubleshooting, and Mixed Full-Panel rounds.
  - **Progress Tracker**: Historical workbook performance, topic-specific accuracy bars, and daily study planner.
  - **Interview Experiences & Practical Resources**: Guidance on the STAR framework, technical trade-offs, and interview reflection.

## Getting Started

### Development
```bash
npm install
npm run dev
```

The application runs on `http://0.0.0.0:3000`.

### Environment Configuration
Copy `.env.example` to `.env` and set:
```
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
```
When `GEMINI_API_KEY` is present, the app automatically switches to **AI COACH (GEMINI)** with dynamic generation. In its absence, it runs seamlessly in **DEMO MODE** using the offline curated question inventory.