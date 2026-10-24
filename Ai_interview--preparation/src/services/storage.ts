import {
  PracticeSetup,
  Question,
  Review,
  PracticeSessionRecord,
  DashboardSummary,
  RoundSummary,
  ProctorSettings,
  ProctorViolation,
  CandidateFeedback,
} from '../types';
import {
  CURATED_QUESTION_BANK,
  countAvailableQuestions,
  selectBankQuestion,
} from './questionBank';

const SESSIONS_KEY = 'interviewready-sessions';
const PRACTICE_KEY = 'interviewready-practice';
const REVIEWS_KEY = 'interviewready-reviews';
const ROADMAP_KEY = 'interviewready-roadmap-completed';
const PROCTOR_SETTINGS_KEY = 'interviewready-proctor-settings';
const PROCTOR_LOGS_KEY = 'interviewready-proctor-logs';
const FEEDBACK_KEY = 'interviewready-feedbacks';

export function getProctorSettings(): ProctorSettings {
  try {
    const raw = localStorage.getItem(PROCTOR_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return {
    antiCheatEnabled: true,
    cameraEnabled: true,
    fullscreenEnforced: false,
    tabSwitchDetection: true,
    voiceAnswerEnabled: true,
    readQuestionsAloud: false,
    voiceMailEnabled: true,
  };
}

export function saveProctorSettings(settings: ProctorSettings): void {
  localStorage.setItem(PROCTOR_SETTINGS_KEY, JSON.stringify(settings));
}

export function getProctorViolations(sessionId?: string): ProctorViolation[] {
  try {
    const raw = localStorage.getItem(PROCTOR_LOGS_KEY);
    if (!raw) return [];
    const logs: (ProctorViolation & { sessionId?: string })[] = JSON.parse(raw);
    if (sessionId) return logs.filter(l => l.sessionId === sessionId);
    return logs;
  } catch {
    return [];
  }
}

export function recordProctorViolation(
  sessionId: string,
  type: 'tab_switch' | 'face_lost' | 'fullscreen_exit',
  message: string
): ProctorViolation {
  const violation: ProctorViolation & { sessionId: string } = {
    id: 'v-' + Math.random().toString(36).substring(2, 9),
    sessionId,
    type,
    message,
    timestamp: new Date().toLocaleTimeString(),
  };
  try {
    const raw = localStorage.getItem(PROCTOR_LOGS_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    logs.push(violation);
    localStorage.setItem(PROCTOR_LOGS_KEY, JSON.stringify(logs.slice(-100)));
  } catch {
    // ignore
  }
  return violation;
}

function getStoredSessions(): PracticeSessionRecord[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: PracticeSessionRecord[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function getStoredPractice(): (Question & { session_id: string; round_number: number; intentional_retry?: boolean; retry_of_question_id?: string })[] {
  try {
    const raw = localStorage.getItem(PRACTICE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePractice(practice: any[]): void {
  localStorage.setItem(PRACTICE_KEY, JSON.stringify(practice));
}

function getStoredReviews(): Review[] {
  try {
    const raw = localStorage.getItem(REVIEWS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveReviews(reviews: Review[]): void {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
}

export function createSession(setup: PracticeSetup): { session_id: string; setup: PracticeSetup; question_count: number; available_question_count: number } {
  const sessionId = 'sess-' + Math.random().toString(36).substring(2, 10);
  const isUnlimited = Boolean(setup.is_unlimited || setup.question_count >= 999);
  const record: PracticeSessionRecord = {
    session_id: sessionId,
    created_at: new Date().toISOString(),
    role: setup.role,
    experience: setup.experience,
    interview_type: setup.interview_type,
    focus_areas: setup.focus_areas,
    question_count: isUnlimited ? 999 : setup.question_count,
    is_unlimited: isUnlimited,
  };
  const sessions = getStoredSessions();
  sessions.unshift(record);
  saveSessions(sessions);

  const available = countAvailableQuestions(setup, []);
  return {
    session_id: sessionId,
    setup: { ...setup, is_unlimited: isUnlimited },
    question_count: isUnlimited ? 999 : setup.question_count,
    available_question_count: available,
  };
}

export function getSession(sessionId: string) {
  const sessions = getStoredSessions();
  const session = sessions.find(s => s.session_id === sessionId);
  if (!session) return null;
  const practice = getStoredPractice().filter(p => p.session_id === sessionId);
  const reviews = getStoredReviews().filter(r => r.session_id === sessionId);
  return { session, practice, reviews };
}

export async function requestNextQuestion(
  sessionId: string,
  roundNumber: number = 1,
  requestedFocus: string[] = []
): Promise<Question> {
  const data = getSession(sessionId);
  if (!data) throw new Error('Practice session not found.');

  const roundPractice = data.practice.filter(p => p.round_number === roundNumber && !p.intentional_retry);
  const isUnlimited = Boolean(data.session.is_unlimited || (data.session.question_count && data.session.question_count >= 999));
  const questionCount = data.session.question_count || 5;

  if (!isUnlimited && roundPractice.length >= questionCount) {
    throw new Error('This practice session is complete.');
  }

  const questionNumber = roundPractice.length + 1;
  const history = data.practice;
  const setup: PracticeSetup = {
    role: data.session.role,
    experience: data.session.experience,
    interview_type: data.session.interview_type,
    focus_areas: requestedFocus.length > 0 ? requestedFocus : data.session.focus_areas,
    question_count: isUnlimited ? 999 : questionCount,
    is_unlimited: isUnlimited,
  };

  let question: Question | null = null;

  // Attempt server-side Gemini generation first
  try {
    const res = await fetch('/api/ai/generate-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setup,
        question_number: questionNumber,
        history: history.slice(-10),
      }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.question && json.options && json.correct_option) {
        question = {
          ...json,
          question_number: questionNumber,
          question_count: isUnlimited ? undefined : questionCount,
          source: 'gemini-ai',
        };
      }
    }
  } catch (e) {
    console.warn('AI question generation call skipped or failed, using curated bank', e);
  }

  // Fallback to curated question bank or cycling
  if (!question) {
    question = selectBankQuestion(setup, history, questionNumber);
  }

  // If in unlimited mode and curated bank exhausted, recycle with fresh concept IDs
  if (!question && isUnlimited && CURATED_QUESTION_BANK.length > 0) {
    const index = (questionNumber - 1) % CURATED_QUESTION_BANK.length;
    const base = CURATED_QUESTION_BANK[index];
    question = {
      ...base,
      question_id: `unlimited-${questionNumber}-${base.question_id}`,
      question_number: questionNumber,
      question_count: undefined,
      source: 'curated-extended',
    };
  }

  if (!question) {
    throw new Error('No more unique interview questions match your current role and focus selection.');
  }

  const storedPractice = getStoredPractice();
  storedPractice.push({
    ...question,
    session_id: sessionId,
    round_number: roundNumber,
  });
  savePractice(storedPractice);

  return question;
}

export function submitReview(
  sessionId: string,
  questionId: string,
  selectedOption: string,
  roundNumber: number = 1
) {
  const data = getSession(sessionId);
  if (!data) throw new Error('Practice session not found.');

  const practice = data.practice.find(p => p.question_id === questionId && p.round_number === roundNumber);
  if (!practice) throw new Error('Practice question not found in this session.');

  const existingReview = data.reviews.find(r => r.question_id === questionId);
  if (existingReview) throw new Error('This question has already been answered.');

  const correctOption = (practice.correct_option || '').toUpperCase();
  const isCorrect = selectedOption.toUpperCase() === correctOption;
  const score = isCorrect ? 100 : 0;
  const selectedText = practice.options[selectedOption] || '';
  const correctText = practice.options[correctOption] || '';

  const review: Review = {
    review_id: 'rev-' + Math.random().toString(36).substring(2, 9),
    session_id: sessionId,
    question_id: questionId,
    reviewed_at: new Date().toISOString(),
    candidate_answer: selectedText,
    score,
    strengths: isCorrect ? ['Selected the strongest option with sound trade-off analysis.'] : [],
    growth_areas: isCorrect ? [] : [practice.focus_area],
    next_steps: isCorrect ? [] : [`Review key considerations for ${practice.focus_area}`],
    feedback: practice.explanation,
    selected_option: selectedOption,
    correct_option: correctOption,
    is_correct: isCorrect,
    explanation: practice.explanation,
    option_explanations: practice.option_explanations,
    round_number: roundNumber,
    format: 'multiple_choice',
    focus_area: practice.focus_area,
  };

  const storedReviews = getStoredReviews();
  storedReviews.push(review);
  saveReviews(storedReviews);

  return {
    review,
    selected_text: selectedText,
    correct_text: correctText,
    question: practice.question,
  };
}

export function retryQuestion(sessionId: string, sourceQuestionId: string, roundNumber: number): Question {
  const data = getSession(sessionId);
  if (!data) throw new Error('Practice session not found.');

  const source = data.practice.find(p => p.question_id === sourceQuestionId);
  const review = data.reviews.find(r => r.question_id === sourceQuestionId);
  if (!source || !review || review.is_correct) {
    throw new Error('Only an incorrect, reviewed question can be intentionally retried.');
  }

  const retryId = 'retry-' + Math.random().toString(36).substring(2, 9);
  const retryQuestion: Question = {
    ...source,
    question_id: retryId,
    intentional_retry: true,
  };

  const storedPractice = getStoredPractice();
  storedPractice.push({
    ...retryQuestion,
    session_id: sessionId,
    round_number: roundNumber,
    retry_of_question_id: sourceQuestionId,
  });
  savePractice(storedPractice);

  return retryQuestion;
}

export function getSessionSummary(sessionId: string, roundNumber: number = 1): RoundSummary {
  const data = getSession(sessionId);
  if (!data) throw new Error('Practice session not found.');

  const practiceRows = data.practice.filter(
    p => p.round_number === roundNumber && !p.intentional_retry
  );
  const questionIds = new Set(practiceRows.map(p => p.question_id));
  const reviews = data.reviews.filter(r => questionIds.has(r.question_id));
  const reviewByQ = new Map(reviews.map(r => [r.question_id, r]));

  const items = [];
  const focusSummary: Record<string, { correct: number; total: number }> = {};

  for (const practice of practiceRows) {
    const rev = reviewByQ.get(practice.question_id);
    if (!rev) continue;
    const isCorrect = rev.is_correct;
    const area = practice.focus_area || 'General';

    if (!focusSummary[area]) focusSummary[area] = { correct: 0, total: 0 };
    focusSummary[area].total += 1;
    if (isCorrect) focusSummary[area].correct += 1;

    items.push({
      question_id: practice.question_id,
      question: practice.question,
      focus_area: area,
      options: practice.options,
      option_explanations: practice.option_explanations,
      format: 'multiple_choice',
      question_type: practice.question_type || 'Multiple choice',
      selected_option: rev.selected_option,
      candidate_answer: rev.candidate_answer,
      correct_option: rev.correct_option,
      is_correct: isCorrect,
      score: rev.score,
      explanation: rev.explanation,
      expected_answer: practice.expected_answer || '',
      intentional_retry: !!practice.intentional_retry,
      strengths: rev.strengths || [],
      growth_areas: rev.growth_areas || [],
    });
  }

  const focusStats = Object.entries(focusSummary).map(([focus_area, counts]) => ({
    focus_area,
    correct: counts.correct,
    total: counts.total,
  }));

  const improvementAreas = focusStats.filter(s => s.correct < s.total).map(s => s.focus_area);
  const correctCount = items.filter(i => i.is_correct).length;
  const attemptedCount = items.length;
  const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
  const requestedCount = data.session.question_count || practiceRows.length;

  let feedback = '';
  let nextSteps: string[] = [];

  if (improvementAreas.length > 0) {
    feedback = `You answered ${correctCount} of ${attemptedCount} correctly (${accuracy}%). Focus attention on ${improvementAreas.join(', ')} before your real interview round.`;
    nextSteps = improvementAreas.slice(0, 3).map(
      a => `Review core principles for ${a.toLowerCase()} and articulate trade-offs clearly.`
    );
  } else {
    feedback = `Outstanding performance! You answered all ${attemptedCount} questions correctly (100% accuracy). You demonstrate solid engineering reasoning and role clarity.`;
    nextSteps = [
      'Take a mock interview with timed responses.',
      'Practice explaining your reasoning verbally as you solve problems.',
    ];
  }

  // Integrity summary from proctor logs
  const violations = getProctorViolations(sessionId);
  const tabSwitches = violations.filter(v => v.type === 'tab_switch').length;
  const faceLostEvents = violations.filter(v => v.type === 'face_lost').length;
  const totalViolations = violations.length;

  let riskScore = totalViolations * 15;
  if (riskScore > 100) riskScore = 100;

  let riskLevel: 'Clean' | 'Low Risk' | 'Suspicious' | 'High Risk' = 'Clean';
  if (riskScore >= 60) riskLevel = 'High Risk';
  else if (riskScore >= 30) riskLevel = 'Suspicious';
  else if (riskScore > 0) riskLevel = 'Low Risk';

  return {
    setup: {
      role: data.session.role,
      experience: data.session.experience,
      interview_type: data.session.interview_type,
      focus_areas: data.session.focus_areas,
      question_count: requestedCount,
    },
    round_number: roundNumber,
    question_count: practiceRows.length,
    requested_question_count: requestedCount,
    review_count: reviews.length,
    correct_count: correctCount,
    incorrect_count: attemptedCount - correctCount,
    attempted_count: attemptedCount,
    accuracy,
    score_total: requestedCount,
    items,
    focus_stats: focusStats,
    improvement_areas: improvementAreas,
    feedback,
    next_steps: nextSteps,
    integrity: {
      violations: totalViolations,
      tabSwitches,
      faceLostEvents,
      riskScore,
      riskLevel,
    },
  };
}

export function getDashboardSummary(): DashboardSummary {
  const sessions = getStoredSessions();
  const practiceRows = getStoredPractice();
  const reviews = getStoredReviews();

  const reviewsBySession = new Map<string, Review[]>();
  for (const r of reviews) {
    const list = reviewsBySession.get(r.session_id) || [];
    list.push(r);
    reviewsBySession.set(r.session_id, list);
  }

  const practiceBySession = new Map<string, any[]>();
  for (const p of practiceRows) {
    if (!p.intentional_retry) {
      const list = practiceBySession.get(p.session_id) || [];
      list.push(p);
      practiceBySession.set(p.session_id, list);
    }
  }

  const attempted = reviews.length;
  const correct = reviews.filter(r => r.is_correct).length;
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : null;

  const focusSummary: Record<string, { correct: number; total: number }> = {};
  let completedCount = 0;

  for (const s of sessions) {
    const sid = s.session_id;
    const req = s.question_count || 0;
    const sPractice = practiceBySession.get(sid) || [];
    const sReviews = reviewsBySession.get(sid) || [];
    const reviewedQIds = new Set(sReviews.map(r => r.question_id));

    if (req > 0 && reviewedQIds.size >= req) {
      completedCount++;
    }

    for (const p of sPractice) {
      const rev = sReviews.find(r => r.question_id === p.question_id);
      if (!rev) continue;
      const area = p.focus_area || 'Other';
      if (!focusSummary[area]) focusSummary[area] = { correct: 0, total: 0 };
      focusSummary[area].total++;
      if (rev.is_correct) focusSummary[area].correct++;
    }
  }

  const recent = sessions.slice(0, 5).map(s => {
    const sReviews = reviewsBySession.get(s.session_id) || [];
    const sAttempted = sReviews.length;
    const sCorrect = sReviews.filter(r => r.is_correct).length;
    return {
      session_id: s.session_id,
      role: s.role || 'Software engineer',
      experience: s.experience || '',
      created_at: s.created_at,
      requested_question_count: s.question_count || 0,
      attempted_count: sAttempted,
      accuracy: sAttempted > 0 ? Math.round((sCorrect / sAttempted) * 100) : null,
    };
  });

  const topicStats = Object.entries(focusSummary)
    .map(([focus_area, counts]) => ({
      focus_area,
      correct: counts.correct,
      total: counts.total,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    session_count: sessions.length,
    question_count: practiceRows.length,
    attempted_count: attempted,
    accuracy,
    completed_session_count: completedCount,
    topic_stats: topicStats,
    recent_sessions: recent,
  };
}

export function getTopicAvailability(): { focus_area: string; available_question_count: number }[] {
  const dummySetup: PracticeSetup = {
    role: 'Software engineer',
    experience: 'Mid-level (4-7 years)',
    interview_type: 'Mixed practice',
    focus_areas: [],
    question_count: 5,
  };
  const areas = Array.from(new Set(CURATED_QUESTION_BANK.map(q => q.focus_area))).sort();
  return areas.map(area => ({
    focus_area: area,
    available_question_count: countAvailableQuestions({ ...dummySetup, focus_areas: [area] }, []),
  }));
}

export function readRoadmapCompleted(): string[] {
  try {
    const raw = localStorage.getItem(ROADMAP_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleRoadmapItem(id: string): string[] {
  const set = new Set(readRoadmapCompleted());
  if (set.has(id)) set.delete(id);
  else set.add(id);
  const arr = Array.from(set);
  localStorage.setItem(ROADMAP_KEY, JSON.stringify(arr));
  return arr;
}

export function plannerStorageKey(): string {
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return `interviewready-planner-${localDate}`;
}

export function readPlanner(): string[] {
  try {
    const raw = localStorage.getItem(plannerStorageKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function togglePlannerTask(task: string, checked: boolean): string[] {
  const set = new Set(readPlanner());
  if (checked) set.add(task);
  else set.delete(task);
  const arr = Array.from(set);
  localStorage.setItem(plannerStorageKey(), JSON.stringify(arr));
  return arr;
}

export function resetPlanner(): void {
  localStorage.removeItem(plannerStorageKey());
}

const DEFAULT_FEEDBACKS: CandidateFeedback[] = [
  {
    id: 'fb-teacher-1',
    author: 'Prof. Julian Vance',
    role: 'CS Faculty & Interview Coach',
    isUseful: true,
    rating: 5,
    thumbs: 'up',
    teacherEmoji: '🏆 Outstanding',
    comment: 'The on-the-spot question generation and detailed option trade-offs provide our students with the exact caliber of evaluation expected at top tech companies. The proctor camera helps simulate real exam focus.',
    createdAt: 'Yesterday, 3:45 PM',
    likes: 18,
    dislikes: 0,
    userReaction: 'up',
  },
  {
    id: 'fb-teacher-2',
    author: 'Sarah Jenkins',
    role: 'Lead Technical Recruiter & Mentor',
    isUseful: true,
    rating: 5,
    thumbs: 'up',
    teacherEmoji: '🌟 Highly Recommended',
    comment: 'Voice answer integration and voice mail recording allow candidates to practice speaking their thought process aloud. A game-changer for behavioral and system design readiness.',
    createdAt: '2 days ago',
    likes: 14,
    dislikes: 1,
  },
  {
    id: 'fb-candidate-1',
    author: 'Aarav Patel',
    role: 'Full-Stack Developer Candidate',
    isUseful: true,
    rating: 5,
    thumbs: 'up',
    teacherEmoji: '🎯 Spot On',
    comment: 'Unlimited practice mode is fantastic! I practiced 15 questions in a row for Frontend & Distributed Systems without hitting any artificial limits.',
    createdAt: '3 days ago',
    likes: 22,
    dislikes: 0,
  },
  {
    id: 'fb-teacher-3',
    author: 'Marcus Aurelius Sterling',
    role: 'Engineering Director & Panel Evaluator',
    isUseful: true,
    rating: 4,
    thumbs: 'up',
    teacherEmoji: '👏 Great Effort',
    comment: 'Comprehensive answer breakdowns. Students who practice here consistently explain their trade-offs instead of just reciting textbook answers.',
    createdAt: '4 days ago',
    likes: 9,
    dislikes: 0,
  },
  {
    id: 'fb-candidate-2',
    author: 'Elena Rostova',
    role: 'Junior DevOps Candidate',
    isUseful: false,
    rating: 3,
    thumbs: 'down',
    teacherEmoji: '🤔 Needs Work',
    comment: 'Great explanations, but would love even more questions on Kubernetes and Terraform troubleshooting scenarios.',
    createdAt: '5 days ago',
    likes: 4,
    dislikes: 2,
  },
];

export function getStoredFeedbacks(): CandidateFeedback[] {
  try {
    const raw = localStorage.getItem(FEEDBACK_KEY);
    if (!raw) {
      localStorage.setItem(FEEDBACK_KEY, JSON.stringify(DEFAULT_FEEDBACKS));
      return DEFAULT_FEEDBACKS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_FEEDBACKS;
  }
}

export function saveCandidateFeedback(
  feedback: Omit<CandidateFeedback, 'id' | 'createdAt' | 'likes' | 'dislikes'>
): CandidateFeedback {
  const newFeedback: CandidateFeedback = {
    ...feedback,
    id: 'fb-' + Math.random().toString(36).substring(2, 9),
    createdAt: 'Just now',
    likes: 1,
    dislikes: 0,
    userReaction: 'up',
  };

  const list = getStoredFeedbacks();
  list.unshift(newFeedback);
  try {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
  return newFeedback;
}

export function toggleFeedbackReaction(id: string, reaction: 'up' | 'down'): CandidateFeedback[] {
  const list = getStoredFeedbacks();
  const updated = list.map(item => {
    if (item.id !== id) return item;

    let likes = item.likes || 0;
    let dislikes = item.dislikes || 0;
    let current = item.userReaction;

    if (current === reaction) {
      // Toggle off
      if (reaction === 'up') likes = Math.max(0, likes - 1);
      if (reaction === 'down') dislikes = Math.max(0, dislikes - 1);
      current = undefined;
    } else {
      // Switch or set
      if (current === 'up') likes = Math.max(0, likes - 1);
      if (current === 'down') dislikes = Math.max(0, dislikes - 1);

      if (reaction === 'up') likes += 1;
      if (reaction === 'down') dislikes += 1;
      current = reaction;
    }

    return {
      ...item,
      likes,
      dislikes,
      userReaction: current,
    };
  });

  try {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

