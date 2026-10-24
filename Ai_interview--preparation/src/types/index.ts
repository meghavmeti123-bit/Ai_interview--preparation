export interface Question {
  question_id: string;
  question: string;
  role_family: string;
  experience_level?: string;
  interview_category: string;
  focus_area: string;
  difficulty: string;
  question_type: string;
  format: string;
  concept_id: string;
  scenario_id: string;
  follow_up_to_question_id?: string;
  expected_answer?: string;
  explanation: string;
  evaluation_criteria?: string[];
  tags?: string[];
  source?: string;
  options: Record<string, string>;
  correct_option: string;
  option_explanations: Record<string, string>;
  intentional_retry?: boolean;
  question_number?: number;
  question_count?: number;
  role?: string;
}

export interface PracticeSetup {
  role: string;
  experience: string;
  interview_type: string;
  focus_areas: string[];
  question_count: number;
  is_unlimited?: boolean;
}

export interface Review {
  review_id: string;
  session_id: string;
  question_id: string;
  reviewed_at: string;
  candidate_answer: string;
  score: number;
  strengths: string[];
  growth_areas: string[];
  next_steps: string[];
  feedback: string;
  selected_option: string;
  correct_option: string;
  is_correct: boolean;
  explanation: string;
  option_explanations?: Record<string, string>;
  round_number: number;
  format: string;
  focus_area: string;
  voice_recording_url?: string;
}

export interface PracticeSessionRecord {
  session_id: string;
  created_at: string;
  role: string;
  experience: string;
  interview_type: string;
  focus_areas: string[];
  question_count: number;
  is_unlimited?: boolean;
}

export interface DashboardSummary {
  session_count: number;
  question_count: number;
  attempted_count: number;
  accuracy: number | null;
  completed_session_count: number;
  topic_stats: { focus_area: string; correct: number; total: number }[];
  recent_sessions: {
    session_id: string;
    role: string;
    experience: string;
    created_at: string;
    requested_question_count: number;
    attempted_count: number;
    accuracy: number | null;
  }[];
}

export interface RoundSummary {
  setup: PracticeSetup;
  round_number: number;
  question_count: number;
  requested_question_count: number;
  review_count: number;
  correct_count: number;
  incorrect_count: number;
  attempted_count: number;
  accuracy: number;
  score_total: number;
  items: {
    question_id: string;
    question: string;
    focus_area: string;
    options: Record<string, string>;
    option_explanations: Record<string, string>;
    format: string;
    question_type: string;
    selected_option: string;
    candidate_answer: string;
    correct_option: string;
    is_correct: boolean;
    score: number;
    explanation: string;
    expected_answer: string;
    intentional_retry: boolean;
    strengths: string[];
    growth_areas: string[];
  }[];
  focus_stats: { focus_area: string; correct: number; total: number }[];
  improvement_areas: string[];
  feedback: string;
  next_steps: string[];
  integrity?: {
    violations: number;
    tabSwitches: number;
    faceLostEvents: number;
    riskScore: number;
    riskLevel: 'Clean' | 'Low Risk' | 'Suspicious' | 'High Risk';
  };
}

export interface ProctorSettings {
  antiCheatEnabled: boolean;
  cameraEnabled: boolean;
  fullscreenEnforced: boolean;
  tabSwitchDetection: boolean;
  voiceAnswerEnabled: boolean;
  readQuestionsAloud: boolean;
  voiceMailEnabled: boolean;
}

export interface ProctorViolation {
  id: string;
  type: 'tab_switch' | 'face_lost' | 'fullscreen_exit';
  message: string;
  timestamp: string;
}

export interface CandidateFeedback {
  id: string;
  author: string;
  role: string;
  isUseful: boolean;
  rating: number; // 1 to 5
  thumbs: 'up' | 'down';
  teacherEmoji: string; // e.g. "🏆 Outstanding", "👏 Good", "🎯 Solid", "🤔 Needs Work", "⚠️ Poor"
  comment: string;
  createdAt: string;
  likes: number;
  dislikes: number;
  userReaction?: 'up' | 'down';
}
