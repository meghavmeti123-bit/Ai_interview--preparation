import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json());

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY || '';
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health & Status check endpoint
app.get('/api/status', (_req: Request, res: Response) => {
  res.json({
    ai_available: Boolean(apiKey && ai),
    model: 'gemini-3.8-flash',
    proctoring_supported: true,
    voice_supported: true,
  });
});

// Dynamic AI Question Generation using Gemini 3.8 Flash
app.post('/api/ai/generate-question', async (req: Request, res: Response) => {
  if (!ai || !apiKey) {
    return res.status(503).json({ error: 'Gemini API key is not configured. Falling back to curated bank.' });
  }

  const { setup, question_number, history } = req.body || {};
  if (!setup || !setup.role) {
    return res.status(400).json({ error: 'Missing candidate setup parameters.' });
  }

  const role = String(setup.role);
  const experience = String(setup.experience || 'Mid-level');
  const interviewType = String(setup.interview_type || 'Technical');
  const focusAreas = Array.isArray(setup.focus_areas) ? setup.focus_areas.join(', ') : 'General';
  const recentHistory = Array.isArray(history) ? history.map((h: any) => h.question).slice(-5) : [];

  const systemInstruction = `You are an expert senior engineering and behavioral interviewer conducting a high-stakes job interview.
Generate a realistic, job-specific interview question tailored strictly to:
- Role: ${role}
- Experience Level: ${experience}
- Interview Format: ${interviewType}
- Focus Area: ${focusAreas}

Rules:
1. Provide one single-answer multiple-choice question with four distinct, realistic choices (A, B, C, D).
2. Exactly one option MUST be the best, industry-standard answer.
3. The other three options must be realistic trade-offs, common misconceptions, or suboptimal alternatives.
4. Provide comprehensive, educational explanations for each option (A, B, C, D) detailing why it is or isn't best.
5. Do NOT duplicate or closely rephrase any of these recent questions: ${JSON.stringify(recentHistory)}.
6. Return purely structured JSON according to the schema.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Generate question #${question_number || 1} for a ${role} candidate (${experience} level) covering ${focusAreas}.`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING, description: 'The scenario or problem question prompt.' },
            focus_area: { type: Type.STRING, description: 'The primary skill or focus area being assessed.' },
            interview_category: { type: Type.STRING, description: 'E.g., Technical, Situational, Behavioral, System design' },
            difficulty: { type: Type.STRING, description: 'Entry, Intermediate, or Advanced' },
            question_type: { type: Type.STRING, description: 'Troubleshooting, Decision making, Scenario, or Multiple choice' },
            explanation: { type: Type.STRING, description: 'Comprehensive rationale for the correct answer.' },
            expected_answer: { type: Type.STRING, description: 'Brief summary of the ideal response.' },
            options: {
              type: Type.OBJECT,
              properties: {
                A: { type: Type.STRING },
                B: { type: Type.STRING },
                C: { type: Type.STRING },
                D: { type: Type.STRING },
              },
              required: ['A', 'B', 'C', 'D'],
            },
            correct_option: { type: Type.STRING, description: 'A, B, C, or D' },
            option_explanations: {
              type: Type.OBJECT,
              properties: {
                A: { type: Type.STRING },
                B: { type: Type.STRING },
                C: { type: Type.STRING },
                D: { type: Type.STRING },
              },
              required: ['A', 'B', 'C', 'D'],
            },
          },
          required: ['question', 'options', 'correct_option', 'option_explanations', 'explanation', 'focus_area'],
        },
      },
    });

    const text = response.text?.trim() || '{}';
    const parsed = JSON.parse(text);

    const question_id = 'gemini-' + Math.random().toString(36).substring(2, 10);
    return res.json({
      question_id,
      role_family: 'ai-generated',
      format: 'multiple_choice',
      concept_id: 'gemini-concept-' + (question_number || 1),
      scenario_id: 'gemini-scenario-' + (question_number || 1),
      interview_category: parsed.interview_category || interviewType,
      difficulty: parsed.difficulty || 'Intermediate',
      question_type: parsed.question_type || 'Multiple choice',
      expected_answer: parsed.expected_answer || parsed.explanation,
      tags: [role.toLowerCase(), focusAreas.toLowerCase()],
      ...parsed,
    });
  } catch (err: any) {
    console.error('Gemini question generation error:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate question with Gemini.' });
  }
});

// Mount Vite or serve static assets
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`InterviewReady AI Server running at http://0.0.0.0:${port}`);
  });
}

startServer();
