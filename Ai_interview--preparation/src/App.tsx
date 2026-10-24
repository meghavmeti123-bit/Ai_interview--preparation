import React, { useState, useEffect, useRef } from 'react';
import {
  PracticeSetup,
  Question,
  DashboardSummary,
  RoundSummary,
  ProctorSettings,
  ProctorViolation,
} from './types';
import {
  getProctorSettings,
  saveProctorSettings,
  getProctorViolations,
  createSession,
  requestNextQuestion,
  submitReview,
  retryQuestion,
  getSessionSummary,
  getDashboardSummary,
  getTopicAvailability,
  readRoadmapCompleted,
  toggleRoadmapItem,
  readPlanner,
  togglePlannerTask,
  resetPlanner,
} from './services/storage';
import { countAvailableQuestions } from './services/questionBank';
import { ProctorCamera } from './components/ProctorCamera';
import { VoiceAssistant } from './components/VoiceAssistant';
import { SettingsModal } from './components/SettingsModal';
import { FeedbackView } from './components/FeedbackView';
import { LoginPage } from './components/LoginPage';
import { UserProfile, getStoredUser, saveStoredUser } from './services/auth';
import { ROADMAP_TOPIC_DATA } from './components/RoadmapTopicDetails';

type ViewMode = 'dashboard' | 'hub' | 'practice' | 'roadmap' | 'mock' | 'progress' | 'feedback' | 'login';
type PracticeStage = 'setup' | 'practice' | 'review' | 'reset';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(getStoredUser());
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [expandedRoadmapTopic, setExpandedRoadmapTopic] = useState<string | null>(null);
  const [stage, setStage] = useState<PracticeStage>('setup');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [setup, setSetup] = useState<PracticeSetup>({
    role: 'Software engineer',
    experience: 'Mid-level (4-7 years)',
    interview_type: 'Mixed practice',
    focus_areas: ['Communication', 'Problem solving', 'Technical depth'],
    question_count: 5,
  });

  const [otherRole, setOtherRole] = useState('');
  const [customCount, setCustomCount] = useState<number | ''>('');
  const [selectedCountChoice, setSelectedCountChoice] = useState('5');
  const [capacityNote, setCapacityNote] = useState('Choose your setup to check how many unseen questions are available.');
  const [capacityWarning, setCapacityWarning] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [isSubmittingSetup, setIsSubmittingSetup] = useState(false);

  // Practice state
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [reviewResult, setReviewResult] = useState<any>(null);
  const [roundNumber, setRoundNumber] = useState(1);
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null);
  const [roundComplete, setRoundComplete] = useState(false);
  const [retryMode, setRetryMode] = useState(false);
  const [previousQuestion, setPreviousQuestion] = useState<Question | null>(null);
  const [retryFocus, setRetryFocus] = useState<string[]>([]);
  const [practiceError, setPracticeError] = useState('');
  const [isCheckingAnswer, setIsCheckingAnswer] = useState(false);

  // Dashboard & Views state
  const [dashboardData, setDashboardData] = useState<DashboardSummary>(getDashboardSummary());
  const [topicAvailability, setTopicAvailability] = useState(getTopicAvailability());
  const [hubSearch, setHubSearch] = useState('');
  const [roadmapCompleted, setRoadmapCompleted] = useState<string[]>(readRoadmapCompleted());
  const [plannerChecked, setPlannerChecked] = useState<string[]>(readPlanner());

  // Proctoring & Settings
  const [settings, setSettings] = useState<ProctorSettings>(getProctorSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [violations, setViolations] = useState<ProctorViolation[]>(getProctorViolations());
  const [aiStatus, setAiStatus] = useState<{ ai_available: boolean; model: string }>({
    ai_available: false,
    model: 'gemini-3.8-flash',
  });

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3500);
  };

  // Check backend AI status on mount
  useEffect(() => {
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.ai_available === 'boolean') {
          setAiStatus(data);
        }
      })
      .catch(() => {});
  }, []);

  // Update capacity calculation when setup inputs change
  useEffect(() => {
    const activeRole = setup.role === 'Other' ? otherRole.trim() : setup.role;
    if (!activeRole || !setup.experience || !setup.interview_type || setup.focus_areas.length === 0) {
      setCapacityNote('Choose your setup to check how many unseen questions are available.');
      setCapacityWarning(false);
      return;
    }

    const available = countAvailableQuestions(
      {
        ...setup,
        role: activeRole,
      },
      []
    );

    const isUnlimited = selectedCountChoice === 'unlimited';
    const count = isUnlimited
      ? 999
      : selectedCountChoice === 'custom'
      ? Number(customCount) || 0
      : Number(selectedCountChoice);

    if (isUnlimited) {
      setCapacityNote('Unlimited AI Practice Mode: questions are generated dynamically on the spot.');
      setCapacityWarning(false);
    } else if (aiStatus.ai_available) {
      setCapacityNote(`AI question generation is active (Gemini 3.8 Flash). Request up to 40 dynamic questions.`);
      setCapacityWarning(false);
    } else {
      const exceeds = count > available;
      setCapacityWarning(exceeds);
      if (exceeds) {
        setCapacityNote(`Only ${available} unseen MCQs match this setup in demo mode. Choose Custom and enter ${available} or fewer, or enable Gemini.`);
      } else {
        setCapacityNote(`${available} unseen MCQs match this setup.`);
      }
    }
  }, [setup, otherRole, selectedCountChoice, customCount, aiStatus.ai_available]);

  // Handle Setup Form Submit
  const handleStartPractice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');

    const targetRole = setup.role === 'Other' ? otherRole.trim() : setup.role;
    if (!targetRole) {
      setSetupError('Please enter your role or job title.');
      return;
    }
    if (setup.focus_areas.length === 0) {
      setSetupError('Please select at least one focus area.');
      return;
    }

    const isUnlimited = selectedCountChoice === 'unlimited';
    const count = isUnlimited
      ? 999
      : selectedCountChoice === 'custom'
      ? Number(customCount)
      : Number(selectedCountChoice);

    if (!isUnlimited && (!count || count < 1 || count > 40)) {
      setSetupError('Please choose between 1 and 40 questions or select Unlimited.');
      return;
    }

    setIsSubmittingSetup(true);

    try {
      const newSetup: PracticeSetup = {
        ...setup,
        role: targetRole,
        question_count: count,
        is_unlimited: isUnlimited,
      };
      setSetup(newSetup);

      const session = createSession(newSetup);
      setSessionId(session.session_id);
      setRoundNumber(1);
      setRoundComplete(false);
      setRetryMode(false);
      setReviewResult(null);

      // Fetch first question
      const q = await requestNextQuestion(session.session_id, 1, newSetup.focus_areas);
      setCurrentQuestion(q);
      setSelectedOption('');
      setStage('practice');
      showToast(isUnlimited ? 'Unlimited practice mode started! Questions generated on the spot.' : 'Interview session started. Proctoring active.');
    } catch (err: any) {
      setSetupError(err.message || 'Failed to start interview.');
      showToast(err.message || 'Setup error');
    } finally {
      setIsSubmittingSetup(false);
    }
  };

  // Check Answer
  const handleCheckAnswer = () => {
    if (!selectedOption || !currentQuestion || !sessionId) {
      setPracticeError('Choose one option before checking your answer.');
      return;
    }

    setPracticeError('');
    setIsCheckingAnswer(true);

    try {
      const res = submitReview(sessionId, currentQuestion.question_id, selectedOption, roundNumber);
      setReviewResult(res);

      const isLast = !setup.is_unlimited && (retryMode || (currentQuestion.question_number || 1) >= (currentQuestion.question_count || 5));
      setRoundComplete(isLast);
      setStage('review');

      if (isLast && !retryMode) {
        const summary = getSessionSummary(sessionId, roundNumber);
        setRoundSummary(summary);
        setRetryFocus(summary.improvement_areas);
        setDashboardData(getDashboardSummary());
      }
    } catch (err: any) {
      setPracticeError(err.message || 'Failed to evaluate answer.');
    } finally {
      setIsCheckingAnswer(false);
    }
  };

  // Explicitly finish unlimited session and view full report
  const handleFinishUnlimitedSession = () => {
    if (!sessionId) return;
    try {
      const summary = getSessionSummary(sessionId, roundNumber);
      setRoundSummary(summary);
      setRetryFocus(summary.improvement_areas);
      setDashboardData(getDashboardSummary());
      setRoundComplete(true);
      setStage('review');
      showToast('Session complete! Your full readiness report is ready.');
    } catch {
      showToast('Answer at least one question before generating summary.');
    }
  };

  // Continue Practice / Next Question
  const handleContinuePractice = async () => {
    if (retryMode) {
      setRetryMode(false);
      setCurrentQuestion(previousQuestion);
      setPreviousQuestion(null);
      setStage('review');
      return;
    }

    if (roundComplete) {
      setStage('reset');
      return;
    }

    if (!sessionId) return;

    try {
      const nextQ = await requestNextQuestion(sessionId, roundNumber, setup.focus_areas);
      setCurrentQuestion(nextQ);
      setSelectedOption('');
      setReviewResult(null);
      setStage('practice');
    } catch (err: any) {
      setPracticeError(err.message || 'Could not load next question.');
    }
  };

  // Intentional Retry
  const handleRetryQuestion = (questionId: string) => {
    if (!sessionId) return;
    try {
      const retryQ = retryQuestion(sessionId, questionId, roundNumber);
      setPreviousQuestion(currentQuestion);
      setCurrentQuestion(retryQ);
      setRetryMode(true);
      setSelectedOption('');
      setReviewResult(null);
      setStage('practice');
      showToast('Retrying question. Explain your reasoning carefully.');
    } catch (err: any) {
      showToast(err.message);
    }
  };

  // Practice Again / Reset
  const handlePracticeAgain = async () => {
    if (!sessionId) return;
    const nextRound = roundNumber + 1;
    setRoundNumber(nextRound);
    setRoundComplete(false);
    setReviewResult(null);
    setRoundSummary(null);

    const focusToUse = retryFocus.length > 0 ? retryFocus : setup.focus_areas;

    try {
      const q = await requestNextQuestion(sessionId, nextRound, focusToUse);
      setCurrentQuestion(q);
      setSelectedOption('');
      setStage('practice');
      showToast(`Round ${nextRound} started focusing on ${focusToUse.join(', ')}.`);
    } catch (err: any) {
      showToast(err.message);
    }
  };

  // Configure Preset Practice (from Prep Hub, Roadmap, or Mock)
  const configureAndStart = (options: { focusAreas?: string[]; interviewType?: string; role?: string }) => {
    setSetup((prev) => ({
      ...prev,
      role: options.role || prev.role || 'Software engineer',
      interview_type: options.interviewType || 'Mixed practice',
      focus_areas: options.focusAreas && options.focusAreas.length > 0 ? options.focusAreas : prev.focus_areas,
    }));
    setCurrentView('practice');
    setStage('setup');
    showToast(`Configured practice for ${options.interviewType || 'Interview'}.`);
  };

  // Update Settings
  const handleUpdateSettings = (newSettings: ProctorSettings) => {
    setSettings(newSettings);
    saveProctorSettings(newSettings);
    showToast('Proctoring and interview settings updated.');
  };

  const handleViolation = (v: ProctorViolation) => {
    setViolations((prev) => [...prev, v]);
  };

  const clearViolations = () => {
    localStorage.removeItem('interviewready-proctor-logs');
    setViolations([]);
    showToast('Proctor logs cleared.');
  };

  const renderRoadmapTopic = (topic: { id: string; title: string; desc: string; practiceFocus?: string }) => {
    const isDone = roadmapCompleted.includes(topic.id);
    const isExpanded = expandedRoadmapTopic === topic.id;
    const details = ROADMAP_TOPIC_DATA[topic.id];

    return (
      <article
        key={topic.id}
        className={isDone ? 'is-complete' : ''}
        style={{
          display: 'block',
          border: isExpanded ? '1px solid #3b82f6' : undefined,
          background: isExpanded ? '#151924' : undefined,
          transition: 'all 0.2s ease',
          marginBottom: '10px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px' }}>
          <div style={{ flex: 1 }}>
            <h4>{topic.title}</h4>
            <p>{topic.desc}</p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setExpandedRoadmapTopic(isExpanded ? null : topic.id)}
                style={{
                  background: isExpanded ? '#1e293b' : 'transparent',
                  border: '1px solid #3b82f6',
                  color: isExpanded ? '#ffffff' : '#60a5fa',
                  borderRadius: '4px',
                  padding: '4px 9px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>{isExpanded ? '▲ Hide Details & Diagram' : '▼ View Deep Details & Architecture Diagram'}</span>
              </button>

              {topic.practiceFocus && (
                <button
                  type="button"
                  onClick={() => configureAndStart({ focusAreas: [topic.practiceFocus!] })}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#93c5fd',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Practise topic →
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            className="button button-light"
            style={{ fontSize: '11px', height: '32px', padding: '0 10px', flexShrink: 0 }}
            onClick={() => setRoadmapCompleted(toggleRoadmapItem(topic.id))}
          >
            {isDone ? 'Completed · undo' : 'Mark complete'}
          </button>
        </div>

        {/* Deep Details & Architecture Diagram */}
        {isExpanded && details && (
          <div
            style={{
              marginTop: '16px',
              padding: '16px',
              background: '#0e1118',
              border: '1px solid #232b3d',
              borderRadius: '8px',
            }}
          >
            {/* SVG Diagram Card */}
            <div
              style={{
                marginBottom: '14px',
                background: '#090b10',
                borderRadius: '6px',
                padding: '12px',
                border: '1px solid #1a2233',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--mono)',
                  color: '#38bdf8',
                  marginBottom: '8px',
                  fontWeight: 600,
                }}
              >
                📐 ARCHITECTURE &amp; CONCEPT DIAGRAM
              </div>
              {details.diagramSvg}
            </div>

            <p style={{ fontSize: '12px', color: '#e2e8f0', margin: '0 0 14px', fontStyle: 'italic', lineHeight: 1.5 }}>
              "{details.summary}"
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '14px' }}>
              {/* Engineering Mechanics */}
              <div style={{ background: '#131822', padding: '12px', borderRadius: '6px', border: '1px solid #1e2638' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#86efac', display: 'block', marginBottom: '6px' }}>
                  ✓ Core Technical Mechanics:
                </span>
                <ul style={{ margin: 0, paddingLeft: '16px', color: '#cbd5e1', fontSize: '11px', lineHeight: 1.6 }}>
                  {details.bulletPoints.map((bp, idx) => (
                    <li key={idx}>{bp}</li>
                  ))}
                </ul>
              </div>

              {/* Typical Interview Questions */}
              <div style={{ background: '#131822', padding: '12px', borderRadius: '6px', border: '1px solid #1e2638' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#fde68a', display: 'block', marginBottom: '6px' }}>
                  💬 Real Interview Questions Asked:
                </span>
                <ul style={{ margin: 0, paddingLeft: '16px', color: '#cbd5e1', fontSize: '11px', lineHeight: 1.6 }}>
                  {details.keyQuestions.map((kq, idx) => (
                    <li key={idx} style={{ fontStyle: 'italic' }}>{kq}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Pitfalls */}
            <div style={{ background: '#241417', padding: '10px 14px', borderRadius: '6px', border: '1px solid #4a1d24' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#fca5a5', display: 'block', marginBottom: '4px' }}>
                ⚠️ Common Candidate Pitfalls &amp; Traps:
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', color: '#fca5a5', fontSize: '11px', lineHeight: 1.6 }}>
                {details.commonPitfalls.map((cp, idx) => (
                  <li key={idx}>{cp}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </article>
    );
  };

  // Headings
  const pageHeadings: Record<ViewMode, [string, string]> = {
    dashboard: ['YOUR PREPARATION SPACE', 'Dashboard'],
    hub: ['PREPARATION LIBRARY', 'Prep Hub'],
    roadmap: ['A STRUCTURED PATH', 'Learning Roadmap'],
    mock: ['TEXT-BASED PRACTICE', 'Mock Interviews'],
    progress: ['SAVED WORKBOOK DATA', 'Progress Tracker'],
    feedback: ['COMMUNITY & TEACHER REVIEWS', 'Session Feedback & Rating'],
    login: ['WORKSPACE CREDENTIALS', 'Sign In to Workspace'],
    practice:
      stage === 'setup'
        ? ['STEP 01 / SET UP', 'Build your practice']
        : stage === 'practice'
        ? [`ROUND ${String(roundNumber).padStart(2, '0')} / PRACTICE`, 'Choose the best answer']
        : stage === 'review'
        ? ['ANSWER CHECK', roundComplete ? 'Your readiness report' : 'See how you did']
        : ['PRACTICE AGAIN', 'Choose what comes next'],
  };

  const currentHeading = pageHeadings[currentView];

  return (
    <>
      {/* Topbar */}
      <header className="topbar">
        <button
          className="brand"
          type="button"
          onClick={() => {
            setCurrentView('dashboard');
            setStage('setup');
          }}
          aria-label="InterviewReady AI dashboard"
        >
          <span className="brand-mark">IR</span>
          <span>
            InterviewReady<span className="brand-period"> AI</span>
          </span>
        </button>

        <div className="topbar-right">
          <span className="privacy-note">
            <span className="status-dot"></span>
            Private practice space
          </span>

          <span className="mode-pill" id="mode-pill">
            {aiStatus.ai_available ? 'AI COACH (GEMINI)' : 'DEMO MODE'}
          </span>

          {/* User Profile / Login Button */}
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="topbar-tool-btn"
                onClick={() => setCurrentView('login')}
                style={{ background: '#1c2638', borderColor: '#3b82f6', color: '#93c5fd' }}
                title="View account details"
              >
                <span>👤</span>
                <span>{currentUser.name.split(' ')[0]} ({currentUser.role === 'teacher' ? 'Coach' : 'Candidate'})</span>
              </button>
              <button
                type="button"
                className="topbar-tool-btn"
                onClick={() => {
                  saveStoredUser(null);
                  setCurrentUser(null);
                  showToast('Signed out of workspace.');
                }}
                style={{ fontSize: '10px', padding: '6px 8px' }}
                title="Sign out"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="topbar-tool-btn"
              onClick={() => setCurrentView('login')}
              style={{ background: '#1c2638', borderColor: '#3b82f6', color: '#60a5fa' }}
            >
              <span>🔑</span>
              <span>Sign In</span>
            </button>
          )}

          <button
            type="button"
            className="topbar-tool-btn"
            onClick={() => setIsSettingsOpen(true)}
            title="Configure Camera, Anti-Cheat, and Voice settings"
          >
            <span>⚙️</span>
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <main className="layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-intro">
            <span className="eyebrow">YOUR INTERVIEW WORKSPACE</span>
            <h1>
              Prepare smarter.
              <br />
              Interview better.
            </h1>
            <p>Build confidence with focused practice and honest feedback.</p>
          </div>

          <nav className="primary-nav" aria-label="Main navigation">
            <button
              className={`primary-link ${currentView === 'dashboard' ? 'active' : ''}`}
              type="button"
              onClick={() => setCurrentView('dashboard')}
            >
              <span className="nav-symbol">⌂</span>Dashboard
            </button>
            <button
              className={`primary-link ${currentView === 'hub' ? 'active' : ''}`}
              type="button"
              onClick={() => setCurrentView('hub')}
            >
              <span className="nav-symbol">◈</span>Prep Hub
            </button>
            <button
              className={`primary-link ${currentView === 'practice' ? 'active' : ''}`}
              type="button"
              onClick={() => setCurrentView('practice')}
            >
              <span className="nav-symbol">◉</span>Practice
            </button>
            <button
              className={`primary-link ${currentView === 'roadmap' ? 'active' : ''}`}
              type="button"
              onClick={() => setCurrentView('roadmap')}
            >
              <span className="nav-symbol">▤</span>Learning Roadmap
            </button>
            <button
              className={`primary-link ${currentView === 'mock' ? 'active' : ''}`}
              type="button"
              onClick={() => setCurrentView('mock')}
            >
              <span className="nav-symbol">◎</span>Mock Interviews
            </button>
            <button
              className={`primary-link ${currentView === 'progress' ? 'active' : ''}`}
              type="button"
              onClick={() => {
                setDashboardData(getDashboardSummary());
                setCurrentView('progress');
              }}
            >
              <span className="nav-symbol">↗</span>Progress Tracker
            </button>
            <button
              className={`primary-link ${currentView === 'feedback' ? 'active' : ''}`}
              type="button"
              onClick={() => setCurrentView('feedback')}
            >
              <span className="nav-symbol">💬</span>Feedback
            </button>
            <button
              className={`primary-link ${currentView === 'login' ? 'active' : ''}`}
              type="button"
              onClick={() => setCurrentView('login')}
            >
              <span className="nav-symbol">🔑</span>{currentUser ? 'My Account' : 'Sign In'}
            </button>
          </nav>

          {currentView === 'practice' && (
            <nav className="stage-nav" aria-label="Interview practice stages">
              <button
                className={`stage-link ${stage === 'setup' ? 'active' : ''}`}
                type="button"
                onClick={() => setStage('setup')}
              >
                <span className="stage-number">01</span>
                <span>Set up</span>
                {stage === 'setup' && <span className="stage-state">NOW</span>}
              </button>

              <button
                className={`stage-link ${stage === 'practice' ? 'active' : ''}`}
                type="button"
                disabled={!currentQuestion}
                onClick={() => setStage('practice')}
              >
                <span className="stage-number">02</span>
                <span>Practice</span>
                {stage === 'practice' && <span className="stage-state">NOW</span>}
              </button>

              <button
                className={`stage-link ${stage === 'review' ? 'active' : ''}`}
                type="button"
                disabled={!reviewResult}
                onClick={() => setStage('review')}
              >
                <span className="stage-number">03</span>
                <span>Review</span>
                {stage === 'review' && <span className="stage-state">NOW</span>}
              </button>

              <button
                className={`stage-link ${stage === 'reset' ? 'active' : ''}`}
                type="button"
                disabled={!roundComplete}
                onClick={() => setStage('reset')}
              >
                <span className="stage-number">04</span>
                <span>Reset & repeat</span>
                {stage === 'reset' ? (
                  <span className="stage-state">NOW</span>
                ) : (
                  <span className="optional-label">OPTIONAL</span>
                )}
              </button>
            </nav>
          )}

          <div className="sidebar-foot">
            <span className="foot-rule"></span>
            <p>
              Good interviews aren't memorized.
              <br />
              They're understood.
            </p>
            <span className="foot-index">PANEL BRIEF 01</span>
          </div>
        </aside>

        {/* Workspace */}
        <section className="workspace">
          <div className="workspace-head">
            <div>
              <span className="eyebrow">{currentHeading[0]}</span>
              <h2>{currentHeading[1]}</h2>
            </div>
            <div className="workspace-tools">
              <span className="session-count">
                {currentView === 'practice' && stage === 'practice' && currentQuestion
                  ? `${currentQuestion.question_number || 1} / ${currentQuestion.question_count || setup.question_count} QUESTIONS`
                  : 'READY WHEN YOU ARE'}
              </span>

              {currentView === 'practice' && stage !== 'setup' && (
                <button
                  className="button button-light stage-back"
                  type="button"
                  onClick={() => {
                    if (stage === 'practice') setStage('setup');
                    else if (stage === 'review') setStage('practice');
                    else if (stage === 'reset') setStage('review');
                  }}
                >
                  ← Back
                </button>
              )}
            </div>
          </div>

          {/* VIEW: DASHBOARD */}
          {currentView === 'dashboard' && (
            <div className="app-page">
              <section className="home-dashboard" aria-label="InterviewReady AI dashboard">
                <div className="dashboard-welcome">
                  <span className="eyebrow">YOUR NEXT STEP STARTS HERE</span>
                  <h3>
                    Prepare Smarter.
                    <br />
                    Interview Better.
                  </h3>
                  <p>
                    Discover your strengths, practise real interview questions, and improve your readiness with focused
                    feedback and proctored assessment.
                  </p>
                  <div className="welcome-actions">
                    <button
                      className="button button-dark"
                      type="button"
                      onClick={() => {
                        setCurrentView('practice');
                        setStage('setup');
                      }}
                    >
                      Start Practising <span aria-hidden="true">→</span>
                    </button>
                    <button
                      className="button button-light"
                      type="button"
                      onClick={() => setCurrentView('hub')}
                    >
                      Explore Preparation Topics
                    </button>
                  </div>
                </div>

                <div className="dashboard-stats">
                  <div>
                    <span>{dashboardData.session_count}</span>
                    <small>SESSIONS</small>
                  </div>
                  <div>
                    <span>{dashboardData.attempted_count}</span>
                    <small>ANSWERS CHECKED</small>
                  </div>
                  <div>
                    <span>{dashboardData.accuracy === null ? '—' : `${dashboardData.accuracy}%`}</span>
                    <small>OVERALL ACCURACY</small>
                  </div>
                </div>

                <div className="recent-sessions">
                  <div className="recent-heading">
                    <span className="field-label">RECENT PRACTICE</span>
                    <span>
                      {dashboardData.recent_sessions.length
                        ? `${dashboardData.recent_sessions.length} RECENT`
                        : 'NO HISTORY'}
                    </span>
                  </div>
                  <div id="recent-session-list">
                    {dashboardData.recent_sessions.length === 0 ? (
                      <p className="dashboard-empty">Your preparation journey starts here.</p>
                    ) : (
                      dashboardData.recent_sessions.map((s) => (
                        <div key={s.session_id} className="recent-session">
                          <strong>{s.role}</strong>
                          <span>
                            {s.accuracy === null
                              ? `${s.attempted_count} of ${s.requested_question_count} answered · In progress`
                              : `${s.attempted_count} of ${s.requested_question_count} answered · ${s.accuracy}% accuracy`}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>

              <section className="content-section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">LEARN WITH INTENTION</span>
                    <h3>Explore popular topics</h3>
                    <p>Counts use the default Software Engineer setup; questions adapt to your selected profile.</p>
                  </div>
                  <button className="text-action" type="button" onClick={() => setCurrentView('hub')}>
                    View all topics <span aria-hidden="true">→</span>
                  </button>
                </div>

                <div className="topic-grid">
                  <article className="topic-card">
                    <span className="topic-icon">✦</span>
                    <h4>HR Interview Questions</h4>
                    <p>Communication, collaboration, and people-focused scenarios.</p>
                    <span className="topic-count">Matching questions available</span>
                    <button
                      type="button"
                      className="topic-action"
                      onClick={() => configureAndStart({ focusAreas: ['Communication'], interviewType: 'Behavioral' })}
                    >
                      Explore topic →
                    </button>
                  </article>

                  <article className="topic-card">
                    <span className="topic-icon">⌘</span>
                    <h4>Technical Interview Questions</h4>
                    <p>Engineering decisions, trade-offs, and technical reasoning.</p>
                    <span className="topic-count">Matching questions available</span>
                    <button
                      type="button"
                      className="topic-action"
                      onClick={() => configureAndStart({ focusAreas: ['Technical depth'], interviewType: 'Technical' })}
                    >
                      Explore topic →
                    </button>
                  </article>

                  <article className="topic-card">
                    <span className="topic-icon">{'{ }'}</span>
                    <h4>Programming Fundamentals</h4>
                    <p>Work through problem-solving questions and system reliability.</p>
                    <span className="topic-count">Matching questions available</span>
                    <button
                      type="button"
                      className="topic-action"
                      onClick={() => configureAndStart({ focusAreas: ['Problem solving'] })}
                    >
                      Explore topic →
                    </button>
                  </article>

                  <article className="topic-card">
                    <span className="topic-icon">⌁</span>
                    <h4>Data Structures &amp; Algorithms</h4>
                    <p>Overview and architectural algorithmic trade-off principles.</p>
                    <span className="topic-count is-muted">Overview topic</span>
                    <button
                      type="button"
                      className="topic-action"
                      onClick={() => setCurrentView('roadmap')}
                    >
                      View in roadmap →
                    </button>
                  </article>

                  <article className="topic-card">
                    <span className="topic-icon">↗</span>
                    <h4>Coding &amp; Problem-Solving</h4>
                    <p>Practise clear problem analysis with existing engineering scenarios.</p>
                    <span className="topic-count">Matching questions available</span>
                    <button
                      type="button"
                      className="topic-action"
                      onClick={() => configureAndStart({ focusAreas: ['Problem solving'] })}
                    >
                      Explore topic →
                    </button>
                  </article>

                  <article className="topic-card">
                    <span className="topic-icon">◌</span>
                    <h4>Communication Skills</h4>
                    <p>Strengthen how you explain trade-offs, align with stakeholders, and lead.</p>
                    <span className="topic-count">Matching questions available</span>
                    <button
                      type="button"
                      className="topic-action"
                      onClick={() => configureAndStart({ focusAreas: ['Communication', 'Leadership'] })}
                    >
                      Explore topic →
                    </button>
                  </article>
                </div>
              </section>

              <section className="resource-strip">
                <div>
                  <span className="eyebrow">KEEP BUILDING MOMENTUM</span>
                  <h3>Choose a useful next step</h3>
                </div>
                <button type="button" className="resource-link" onClick={() => setCurrentView('roadmap')}>
                  Follow the learning roadmap <span>→</span>
                </button>
                <button
                  type="button"
                  className="resource-link"
                  onClick={() => {
                    setDashboardData(getDashboardSummary());
                    setCurrentView('progress');
                  }}
                >
                  Review your progress <span>→</span>
                </button>
                <button type="button" className="resource-link" onClick={() => setCurrentView('mock')}>
                  Set up a mock interview <span>→</span>
                </button>
              </section>
            </div>
          )}

          {/* VIEW: PRACTICE */}
          {currentView === 'practice' && (
            <div className="app-page">
              {/* STAGE 1: SETUP */}
              {stage === 'setup' && (
                <section className="stage-panel visible">
                  <p className="section-lede">
                    Tune your interview round. Questions dynamically adapt to your role, experience level, and areas of
                    focus.
                  </p>

                  <form onSubmit={handleStartPractice}>
                    <label className="field-label" htmlFor="role">
                      ROLE OR JOB TITLE
                    </label>
                    <select
                      className="select-input"
                      id="role"
                      value={setup.role}
                      onChange={(e) => setSetup({ ...setup, role: e.target.value })}
                      required
                    >
                      <option value="Software engineer">Software engineer</option>
                      <option value="Application engineer">Application engineer</option>
                      <option value="Quality engineer">Quality engineer</option>
                      <option value="Architect">Architect</option>
                      <option value="DevOps engineer">DevOps engineer</option>
                      <option value="Other">Other</option>
                    </select>

                    {setup.role === 'Other' && (
                      <input
                        className="text-input other-role"
                        style={{ marginTop: '10px' }}
                        value={otherRole}
                        onChange={(e) => setOtherRole(e.target.value)}
                        placeholder="Enter your job title (e.g. Data Engineer, Security Architect)"
                        maxLength={100}
                        required
                      />
                    )}

                    <div className="field-grid">
                      <div>
                        <label className="field-label" htmlFor="experience">
                          EXPERIENCE LEVEL
                        </label>
                        <select
                          className="select-input"
                          id="experience"
                          value={setup.experience}
                          onChange={(e) => setSetup({ ...setup, experience: e.target.value })}
                          required
                        >
                          <option value="Entry level">Entry level</option>
                          <option value="Early career (1-3 years)">Early career (1-3 years)</option>
                          <option value="Mid-level (4-7 years)">Mid-level (4-7 years)</option>
                          <option value="Senior (8+ years)">Senior (8+ years)</option>
                          <option value="Career change">Career change</option>
                        </select>
                      </div>

                      <div>
                        <label className="field-label" htmlFor="interview-type">
                          INTERVIEW TYPE
                        </label>
                        <select
                          className="select-input"
                          id="interview-type"
                          value={setup.interview_type}
                          onChange={(e) => setSetup({ ...setup, interview_type: e.target.value })}
                          required
                        >
                          <option value="Behavioral">Behavioral</option>
                          <option value="Technical">Technical</option>
                          <option value="Situational">Situational</option>
                          <option value="Hiring manager">Hiring manager</option>
                          <option value="Mixed practice">Mixed practice</option>
                        </select>
                      </div>
                    </div>

                    <fieldset className="count-fieldset" style={{ border: 'none', padding: 0, marginTop: '24px' }}>
                      <legend className="field-label">HOW MANY QUESTIONS WOULD YOU LIKE TO ATTEMPT?</legend>
                      <div className="count-options">
                        <label className="count-option" style={{ minWidth: '120px' }}>
                          <input
                            type="radio"
                            name="question-count-choice"
                            value="unlimited"
                            checked={selectedCountChoice === 'unlimited'}
                            onChange={() => setSelectedCountChoice('unlimited')}
                          />
                          <span style={{ fontWeight: 700, color: '#38bdf8' }}>∞ Unlimited</span>
                        </label>
                        {['3', '5', '10'].map((val) => (
                          <label key={val} className="count-option">
                            <input
                              type="radio"
                              name="question-count-choice"
                              value={val}
                              checked={selectedCountChoice === val}
                              onChange={() => setSelectedCountChoice(val)}
                            />
                            <span>{val.padStart(2, '0')}</span>
                          </label>
                        ))}
                        <label className="count-option custom-count-choice">
                          <input
                            type="radio"
                            name="question-count-choice"
                            value="custom"
                            checked={selectedCountChoice === 'custom'}
                            onChange={() => setSelectedCountChoice('custom')}
                          />
                          <span>Custom</span>
                        </label>

                        {selectedCountChoice === 'custom' && (
                          <input
                            className="count-input"
                            type="number"
                            min="1"
                            max="40"
                            placeholder="Enter count (1-40)"
                            value={customCount}
                            onChange={(e) => setCustomCount(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                            required
                          />
                        )}
                      </div>

                      <p
                        className={`capacity-note ${capacityWarning ? 'capacity-warning' : ''}`}
                        style={{ marginTop: '8px', fontSize: '12px' }}
                      >
                        {capacityNote}
                      </p>
                    </fieldset>

                    <fieldset className="focus-fieldset">
                      <legend className="field-label">
                        FOCUS AREAS <span className="field-hint">Choose at least one</span>
                      </legend>
                      <div className="focus-options">
                        {[
                          'Communication',
                          'Problem solving',
                          'Leadership',
                          'Technical depth',
                          'Impact & results',
                          'Collaboration',
                        ].map((area) => (
                          <label key={area} className="focus-option">
                            <input
                              type="checkbox"
                              name="focus"
                              value={area}
                              checked={setup.focus_areas.includes(area)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSetup({ ...setup, focus_areas: [...setup.focus_areas, area] });
                                } else {
                                  setSetup({ ...setup, focus_areas: setup.focus_areas.filter((f) => f !== area) });
                                }
                              }}
                            />
                            <span>{area}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    {setupError && (
                      <p className="inline-error" role="alert">
                        {setupError}
                      </p>
                    )}

                    <div className="form-bottom">
                      <span className="form-note">
                        Your answers are scored privately. Proctoring and voice options can be adjusted in Settings.
                      </span>
                      <button
                        className="button button-dark"
                        type="submit"
                        disabled={isSubmittingSetup || (capacityWarning && !aiStatus.ai_available)}
                      >
                        <span>{isSubmittingSetup ? 'Starting interview...' : 'Start interview'}</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </form>
                </section>
              )}

              {/* STAGE 2: PRACTICE */}
              {stage === 'practice' && currentQuestion && (
                <section className="stage-panel visible">
                  {/* Proctoring Camera & Anti-Cheat HUD */}
                  <ProctorCamera
                    settings={settings}
                    sessionId={sessionId}
                    onViolation={handleViolation}
                    active={stage === 'practice'}
                  />

                  <div className="question-meta" style={{ marginTop: '12px' }}>
                    <span className="tag">{currentQuestion.focus_area.toUpperCase()}</span>
                    <span className="question-index">
                      {retryMode
                        ? `INTENTIONAL RETRY · ROUND ${roundNumber}`
                        : setup.is_unlimited
                        ? `QUESTION ${currentQuestion.question_number || 1} · ∞ UNLIMITED AI MODE`
                        : `QUESTION ${currentQuestion.question_number || 1} OF ${currentQuestion.question_count || setup.question_count}`}
                    </span>
                  </div>

                  {!setup.is_unlimited && (
                    <div className="progress-track" role="progressbar">
                      <span
                        style={{
                          width: `${(((currentQuestion.question_number || 1) - 1) / (currentQuestion.question_count || setup.question_count)) * 100}%`,
                        }}
                      ></span>
                    </div>
                  )}

                  <div className="question-block">
                    <span className="quote-mark">“</span>
                    <h3>{currentQuestion.question}</h3>
                  </div>

                  <div className="question-type-line">
                    <span className="question-type">{(currentQuestion.question_type || 'Scenario').toUpperCase()}</span>
                    <span className="question-difficulty">{(currentQuestion.difficulty || 'Intermediate').toUpperCase()}</span>
                    {currentQuestion.source === 'gemini-ai' && (
                      <span
                        className="question-difficulty"
                        style={{ background: '#1d2a45', color: '#93c5fd', borderColor: '#3b82f6' }}
                      >
                        ✨ GEMINI AI GENERATED
                      </span>
                    )}
                  </div>

                  {/* Voice Integration (Voice Answer, Voice Mail, Read Aloud) */}
                  <VoiceAssistant
                    question={currentQuestion}
                    onSelectOption={(opt) => {
                      setSelectedOption(opt);
                      showToast(`Selected option ${opt} via voice.`);
                    }}
                    voiceAnswerEnabled={settings.voiceAnswerEnabled}
                    autoReadAloud={settings.readQuestionsAloud}
                    voiceMailEnabled={settings.voiceMailEnabled}
                  />

                  <fieldset className="answer-fieldset" style={{ border: 'none', padding: 0, marginTop: '18px' }}>
                    <legend className="field-label">CHOOSE ONE ANSWER</legend>
                    <div className="answer-options" role="radiogroup">
                      {['A', 'B', 'C', 'D'].map((key) => {
                        const optText = currentQuestion.options[key];
                        if (!optText) return null;
                        const isSelected = selectedOption === key;

                        return (
                          <label
                            key={key}
                            className={`answer-option ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => setSelectedOption(key)}
                          >
                            <input
                              type="radio"
                              name="selected-option"
                              value={key}
                              checked={isSelected}
                              onChange={() => setSelectedOption(key)}
                            />
                            <span className="option-key">{key}</span>
                            <span className="option-text">{optText}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  {practiceError && <p className="inline-error">{practiceError}</p>}

                  <div className="form-bottom practice-bottom">
                    <span className="form-note">
                      {setup.is_unlimited
                        ? 'Unlimited mode: question generated on the spot. Finish anytime to view report.'
                        : 'Select an option above or answer verbally'}
                    </span>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {setup.is_unlimited && (
                        <button
                          className="button button-light"
                          type="button"
                          onClick={handleFinishUnlimitedSession}
                          title="Finish practice session and generate readiness score report"
                        >
                          Complete &amp; Review Report
                        </button>
                      )}
                      <button
                        className="button button-dark"
                        type="button"
                        disabled={!selectedOption || isCheckingAnswer}
                        onClick={handleCheckAnswer}
                      >
                        <span>{isCheckingAnswer ? 'Checking answer...' : 'Check answer'}</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* STAGE 3: REVIEW */}
              {stage === 'review' && reviewResult && (
                <section className="stage-panel visible">
                  <div className={`answer-verdict ${reviewResult.review.is_correct ? 'is-correct' : 'is-incorrect'}`}>
                    <span className="verdict-mark">{reviewResult.review.is_correct ? '✓' : '×'}</span>
                    <div>
                      <span className="eyebrow">{reviewResult.review.is_correct ? 'CORRECT ANSWER' : 'ANSWER REVIEW'}</span>
                      <h3>{reviewResult.review.is_correct ? 'Correct answer!' : 'Incorrect answer'}</h3>
                    </div>
                  </div>

                  <p className="review-summary">
                    {reviewResult.review.is_correct
                      ? `You selected ${reviewResult.review.selected_option}: ${reviewResult.selected_text}`
                      : `Your answer (${reviewResult.review.selected_option}) was suboptimal. ${reviewResult.review.option_explanations?.[reviewResult.review.selected_option] || reviewResult.review.explanation}`}
                  </p>

                  <div className="answer-explanation">
                    <span className="field-label">ANSWER EXPLANATION</span>
                    <p className="answer-comparison">
                      {reviewResult.review.is_correct
                        ? `Why it is best: ${reviewResult.correct_text}`
                        : `Correct answer: Option ${reviewResult.review.correct_option}. ${reviewResult.correct_text}. ${reviewResult.review.explanation}`}
                    </p>

                    {reviewResult.review.option_explanations && (
                      <ul className="option-explanations">
                        {['A', 'B', 'C', 'D'].map((key) => {
                          const isCorrect = key === reviewResult.review.correct_option;
                          const isSelected = key === reviewResult.review.selected_option;
                          const reason = reviewResult.review.option_explanations[key];
                          if (!reason) return null;

                          return (
                            <li
                              key={key}
                              className={
                                isCorrect
                                  ? 'explanation-correct'
                                  : isSelected
                                  ? 'explanation-incorrect'
                                  : ''
                              }
                            >
                              <strong>
                                {key}
                                {isSelected && !isCorrect ? ' · Your answer' : isCorrect ? ' · Best Choice' : ''}:{' '}
                              </strong>
                              {reason}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {/* ROUND RESULTS REPORT */}
                  {roundComplete && roundSummary && (
                    <section className="round-review">
                      <div className="round-score-line">
                        <div>
                          <span className="eyebrow">INTERVIEW READINESS REPORT</span>
                          <h3>Your Round Results</h3>
                        </div>
                        <div
                          className={`round-score ${
                            roundSummary.accuracy < 60
                              ? 'score-low'
                              : roundSummary.accuracy === 100
                              ? 'score-perfect'
                              : ''
                          }`}
                        >
                          {roundSummary.correct_count} / {roundSummary.requested_question_count}
                        </div>
                      </div>

                      <div className="results-metrics">
                        <div>
                          <span>{roundSummary.attempted_count}</span>
                          <small>ATTEMPTED</small>
                        </div>
                        <div>
                          <span>{roundSummary.correct_count}</span>
                          <small>CORRECT</small>
                        </div>
                        <div>
                          <span>{roundSummary.incorrect_count}</span>
                          <small>INCORRECT</small>
                        </div>
                        <div>
                          <span>{roundSummary.accuracy}%</span>
                          <small>ACCURACY</small>
                        </div>
                      </div>

                      {/* Anti-Cheat Integrity Assessment Banner */}
                      {roundSummary.integrity && (
                        <div
                          style={{
                            padding: '14px 18px',
                            borderRadius: '8px',
                            margin: '18px 0',
                            border: `1px solid ${roundSummary.integrity.violations === 0 ? '#285a49' : '#7f1d1d'}`,
                            background: roundSummary.integrity.violations === 0 ? '#142820' : '#2e1013',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <span style={{ font: '600 11px "DM Mono", monospace', color: '#93c5fd' }}>
                              🛡️ INTERVIEW INTEGRITY AUDIT
                            </span>
                            <div style={{ fontSize: '13px', color: '#f4f4f5', marginTop: '3px' }}>
                              Status:{' '}
                              <strong
                                style={{
                                  color: roundSummary.integrity.violations === 0 ? '#86efac' : '#fca5a5',
                                }}
                              >
                                {roundSummary.integrity.riskLevel}
                              </strong>{' '}
                              ({roundSummary.integrity.violations} flagged anomalies, {roundSummary.integrity.tabSwitches} tab switches)
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '10px', color: '#a1a1aa' }}>INTEGRITY SCORE</span>
                            <div
                              style={{
                                font: '700 20px var(--display)',
                                color: roundSummary.integrity.violations === 0 ? '#86efac' : '#fca5a5',
                              }}
                            >
                              {100 - roundSummary.integrity.riskScore}%
                            </div>
                          </div>
                        </div>
                      )}

                      <p className="round-feedback">{roundSummary.feedback}</p>

                      <div className="focus-summary">
                        <span className="field-label">FOCUS AREA BREAKDOWN</span>
                        <ul>
                          {roundSummary.focus_stats.map((item) => (
                            <li
                              key={item.focus_area}
                              className={item.correct < item.total ? 'focus-needs-work' : 'focus-mastered'}
                            >
                              {item.focus_area}: {item.correct} / {item.total} correct
                            </li>
                          ))}
                        </ul>
                      </div>

                      {roundSummary.improvement_areas.length > 0 && (
                        <div className="next-steps">
                          <span className="field-label">AREAS TO IMPROVE</span>
                          <ul>
                            {roundSummary.improvement_areas.map((area) => (
                              <li key={area} style={{ color: '#fca5a5' }}>
                                Focus on {area}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="next-steps">
                        <span className="field-label">YOUR NEXT MOVES</span>
                        <ol>
                          {roundSummary.next_steps.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ol>
                      </div>

                      <div className="question-recap">
                        <span className="field-label">ANSWER-BY-ANSWER RECAP</span>
                        <div id="round-results">
                          {roundSummary.items.map((item, idx) => (
                            <article
                              key={item.question_id + idx}
                              className={`recap-item ${item.is_correct ? 'recap-correct' : 'recap-incorrect'}`}
                            >
                              <div className="recap-heading">
                                <span>
                                  Q{idx + 1} · {item.focus_area}
                                </span>
                                <strong>{item.is_correct ? 'RIGHT' : 'WRONG'}</strong>
                              </div>
                              <p className="recap-question">{item.question}</p>
                              <p className="recap-answer">
                                Your choice: {item.selected_option}. {item.options[item.selected_option]}
                              </p>
                              <p className="recap-answer">
                                Correct: {item.correct_option}. {item.options[item.correct_option]}
                              </p>
                              <p className="recap-why">{item.explanation}</p>

                              {!item.is_correct && !item.intentional_retry && (
                                <button
                                  type="button"
                                  className="button button-light retry-question"
                                  onClick={() => handleRetryQuestion(item.question_id)}
                                >
                                  Retry this question ↻
                                </button>
                              )}
                            </article>
                          ))}
                        </div>
                      </div>
                    </section>
                  )}

                  <div className="form-bottom">
                    <span className="form-note">
                      {roundComplete
                        ? 'All requested answers evaluated. Your interview readiness report is ready.'
                        : setup.is_unlimited
                        ? `Question ${currentQuestion?.question_number || 1} checked. Click Next Question to generate another on the spot!`
                        : `Question ${currentQuestion?.question_number || 1} of ${currentQuestion?.question_count || setup.question_count} checked.`}
                    </span>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {setup.is_unlimited && !roundComplete && (
                        <button
                          className="button button-light"
                          type="button"
                          onClick={handleFinishUnlimitedSession}
                        >
                          Complete &amp; Review Final Report
                        </button>
                      )}
                      <button className="button button-dark" type="button" onClick={handleContinuePractice}>
                        <span>
                          {retryMode
                            ? 'Back to Results'
                            : roundComplete
                            ? 'View Next Steps'
                            : setup.is_unlimited
                            ? 'Next Question (On the Spot) →'
                            : 'Next Question →'}
                        </span>
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* STAGE 4: RESET / REPEAT */}
              {stage === 'reset' && roundSummary && (
                <section className="stage-panel visible">
                  <span className="eyebrow">ROUND COMPLETE</span>
                  <h3 className="reset-title">Ready to strengthen your weak spots?</h3>
                  <p className="reset-copy">
                    {roundSummary.improvement_areas.length > 0
                      ? `Your next round will focus on ${roundSummary.improvement_areas.join(', ')}.`
                      : 'You scored 100%! Ready for a fresh set of challenging questions?'}
                  </p>

                  <div className="stat-strip">
                    <div>
                      <span className="stat-number">
                        {roundSummary.correct_count} / {roundSummary.requested_question_count}
                      </span>
                      <span className="stat-label">CORRECT</span>
                    </div>
                    <div>
                      <span className="stat-number">{String(roundNumber).padStart(2, '0')}</span>
                      <span className="stat-label">ROUND</span>
                    </div>
                    <div>
                      <span className="stat-number">{roundSummary.improvement_areas.length}</span>
                      <span className="stat-label">AREAS TO REVIEW</span>
                    </div>
                  </div>

                  <div className="reset-focus">
                    <span className="field-label">NEXT ROUND FOCUS</span>
                    <div id="retry-focus-list">
                      {(roundSummary.improvement_areas.length > 0
                        ? roundSummary.improvement_areas
                        : setup.focus_areas
                      ).map((area) => (
                        <span key={area} className="retry-focus-tag">
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="reset-actions" style={{ marginTop: '24px' }}>
                    <button className="button button-dark" type="button" onClick={handlePracticeAgain}>
                      <span>Practice again</span>
                      <span aria-hidden="true">↻</span>
                    </button>
                    <button
                      className="button button-light"
                      type="button"
                      onClick={() => {
                        setSessionId(null);
                        setCurrentQuestion(null);
                        setReviewResult(null);
                        setStage('setup');
                      }}
                    >
                      Start over
                    </button>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* VIEW: PREP HUB */}
          {currentView === 'hub' && (
            <div className="app-page">
              <div className="page-intro">
                <span className="eyebrow">PREPARATION LIBRARY</span>
                <h3>Prep Hub</h3>
                <p>Explore what the question bank and AI generator support. Search by skill, topic, or role.</p>
              </div>

              <label className="search-field" htmlFor="topic-search">
                <span aria-hidden="true">⌕</span>
                <input
                  id="topic-search"
                  type="search"
                  placeholder="Search preparation topics (e.g. Communication, System design, Linux)"
                  value={hubSearch}
                  onChange={(e) => setHubSearch(e.target.value)}
                />
              </label>

              <div className="topic-grid">
                {[
                  {
                    name: 'HR Interview Questions',
                    desc: 'Communication, collaboration, and people-focused scenarios.',
                    focus: 'Communication',
                    count: 'Available',
                  },
                  {
                    name: 'Technical Interview Questions',
                    desc: 'Engineering decisions, trade-offs, and technical reasoning.',
                    focus: 'Technical depth',
                    count: 'Available',
                  },
                  {
                    name: 'Programming Fundamentals',
                    desc: 'Work through problem-solving questions from the question bank.',
                    focus: 'Problem solving',
                    count: 'Available',
                  },
                  {
                    name: 'Data Structures and Algorithms',
                    desc: 'Algorithmic efficiency, Big-O trade-offs, and memory complexity.',
                    focus: 'Technical depth',
                    count: 'Roadmap overview',
                  },
                  {
                    name: 'Object-Oriented Programming',
                    desc: 'Polymorphism, abstraction, domain modeling, and design patterns.',
                    focus: 'Problem solving',
                    count: 'Available',
                  },
                  {
                    name: 'Database Management Systems',
                    desc: 'ACID transactions, idempotency, isolation levels, and indexing.',
                    focus: 'Reliability',
                    count: 'Available',
                  },
                  {
                    name: 'Operating Systems & Linux',
                    desc: 'Process scheduling, memory, sockets, file descriptors, and disk I/O.',
                    focus: 'Problem solving',
                    count: 'Available',
                  },
                  {
                    name: 'Computer Networks & DNS',
                    desc: 'DNS resolution, TCP/UDP, TLS handshakes, load balancing, and routing.',
                    focus: 'Reliability',
                    count: 'Available',
                  },
                  {
                    name: 'Cloud Infrastructure & DevOps',
                    desc: 'Kubernetes scheduling, probes, Terraform drift, canary rollouts, and CI/CD.',
                    focus: 'Reliability',
                    count: 'Available',
                  },
                ]
                  .filter(
                    (t) =>
                      t.name.toLowerCase().includes(hubSearch.toLowerCase()) ||
                      t.desc.toLowerCase().includes(hubSearch.toLowerCase()) ||
                      t.focus.toLowerCase().includes(hubSearch.toLowerCase())
                  )
                  .map((t) => (
                    <article key={t.name} className="topic-card">
                      <span className="topic-icon">⌘</span>
                      <h4>{t.name}</h4>
                      <p>{t.desc}</p>
                      <span className="topic-count">{t.count}</span>
                      <button
                        type="button"
                        className="topic-action"
                        onClick={() => configureAndStart({ focusAreas: [t.focus] })}
                      >
                        Explore topic →
                      </button>
                    </article>
                  ))}
              </div>
            </div>
          )}

          {/* VIEW: LEARNING ROADMAP */}
          {currentView === 'roadmap' && (
            <div className="app-page">
              <div className="page-intro">
                <span className="eyebrow">A STRUCTURED PATH</span>
                <h3>Learning Roadmap</h3>
                <p>
                  A structured interview-preparation progression. Check off items as you study to track your mastery.
                </p>
              </div>

              <div className="roadmap-progress">
                <div>
                  <strong>{roadmapCompleted.length}</strong>
                  <span>topics marked complete by you</span>
                </div>
                <div className="mini-progress">
                  <span style={{ width: `${Math.min(100, (roadmapCompleted.length / 15) * 100)}%` }}></span>
                </div>
              </div>

              {/* Module 1 */}
              <details className="roadmap-module" open>
                <summary>
                  <span>01</span> Interview Fundamentals
                </summary>
                <div className="roadmap-topics">
                  {[
                    { id: 'interview-basics', title: 'Interview preparation basics', desc: 'Set a role target, plan focused practice, and review gaps.' },
                    { id: 'resume', title: 'Resume-based questions', desc: 'Prepare clear explanations of your work and measurable impact.' },
                    { id: 'self-introduction', title: 'Self-introduction', desc: 'Build a concise introduction connecting background to the target role.' },
                    {
                      id: 'communication',
                      title: 'Communication and HR preparation',
                      desc: 'Use structured STAR examples and communicate trade-offs clearly.',
                      practiceFocus: 'Communication',
                    },
                  ].map(renderRoadmapTopic)}
                </div>
              </details>

              {/* Module 2 */}
              <details className="roadmap-module" open>
                <summary>
                  <span>02</span> Programming Fundamentals
                </summary>
                <div className="roadmap-topics">
                  {[
                    { id: 'variables', title: 'Variables and data types', desc: 'Review representation, typing, and boundary condition handling.' },
                    { id: 'conditions-loops', title: 'Conditions and loops', desc: 'Practise control flow, edge cases, and readable iteration.' },
                    {
                      id: 'functions',
                      title: 'Functions and problem-solving',
                      desc: 'Break down a complex problem into testable, idempotent steps.',
                      practiceFocus: 'Problem solving',
                    },
                  ].map(renderRoadmapTopic)}
                </div>
              </details>

              {/* Module 3 */}
              <details className="roadmap-module" open>
                <summary>
                  <span>03</span> Data Structures and Algorithms
                </summary>
                <div className="roadmap-topics">
                  {[
                    { id: 'arrays-strings', title: 'Arrays and strings', desc: 'Two-pointer methods, sliding windows, and amortized complexity.' },
                    { id: 'search-sort', title: 'Searching and sorting', desc: 'Binary search invariants, quicksort, mergesort, and partition logic.' },
                    { id: 'hashing-lists', title: 'Hashing and linked lists', desc: 'Hash collisions, pointer manipulation, and cycle detection.' },
                  ].map(renderRoadmapTopic)}
                </div>
              </details>

              {/* Module 4 */}
              <details className="roadmap-module" open>
                <summary>
                  <span>04</span> Core Computer Science & Systems
                </summary>
                <div className="roadmap-topics">
                  {[
                    { id: 'oop', title: 'Object-oriented architecture', desc: 'Encapsulation, SOLID principles, and loose coupling.' },
                    { id: 'databases', title: 'Database management systems', desc: 'Indexes, query plans, locks, and expand-contract migrations.' },
                    { id: 'operating-systems', title: 'Operating systems & Linux', desc: 'Kernel namespaces, thread synchronization, and virtual memory.' },
                  ].map(renderRoadmapTopic)}
                </div>
              </details>

              {/* Module 5 */}
              <details className="roadmap-module" open>
                <summary>
                  <span>05</span> Real-world Interview Simulation
                </summary>
                <div className="roadmap-topics">
                  {[
                    {
                      id: 'technical-practice',
                      title: 'Technical and architectural rounds',
                      desc: 'Practice trade-offs, concurrency, and reliability questions.',
                      practiceFocus: 'Technical depth',
                    },
                    {
                      id: 'behavioral-practice',
                      title: 'Behavioral & Leadership scenarios',
                      desc: 'Conflict resolution, incident management, and ownership stories.',
                      practiceFocus: 'Leadership',
                    },
                  ].map(renderRoadmapTopic)}
                </div>
              </details>
            </div>
          )}

          {/* VIEW: MOCK INTERVIEWS */}
          {currentView === 'mock' && (
            <div className="app-page">
              <div className="page-intro">
                <span className="eyebrow">INTERVIEW SIMULATION</span>
                <h3>Mock Interviews</h3>
                <p>
                  Choose a supported interview format. Sessions enforce strict proctoring and provide instant scoring.
                </p>
              </div>

              <div className="mock-grid">
                <article className="mock-card">
                  <span className="topic-icon">◌</span>
                  <h4>HR & Behavioral Interview</h4>
                  <p>Practise behavioural scenarios, stakeholder communication, and conflict resolution.</p>
                  <button
                    type="button"
                    onClick={() =>
                      configureAndStart({
                        interviewType: 'Behavioral',
                        focusAreas: ['Communication', 'Collaboration'],
                      })
                    }
                  >
                    Configure HR practice <span>→</span>
                  </button>
                </article>

                <article className="mock-card">
                  <span className="topic-icon">⌘</span>
                  <h4>Technical Deep-Dive</h4>
                  <p>Work through role-specific technical decisions, concurrency, caching, and database locks.</p>
                  <button
                    type="button"
                    onClick={() =>
                      configureAndStart({
                        interviewType: 'Technical',
                        focusAreas: ['Technical depth', 'Problem solving'],
                      })
                    }
                  >
                    Configure technical practice <span>→</span>
                  </button>
                </article>

                <article className="mock-card">
                  <span className="topic-icon">{'{ }'}</span>
                  <h4>Programming & Troubleshooting</h4>
                  <p>Diagnose production outages, flaky tests, and distributed system anomalies.</p>
                  <button
                    type="button"
                    onClick={() =>
                      configureAndStart({
                        interviewType: 'Situational',
                        focusAreas: ['Problem solving'],
                      })
                    }
                  >
                    Configure practice <span>→</span>
                  </button>
                </article>

                <article className="mock-card">
                  <span className="topic-icon">◎</span>
                  <h4>Full-Panel Mixed Round</h4>
                  <p>Combines behavioral, systems architecture, and technical evaluation in one rigorous session.</p>
                  <button
                    type="button"
                    onClick={() =>
                      configureAndStart({
                        interviewType: 'Mixed practice',
                        focusAreas: ['Communication', 'Technical depth', 'Problem solving', 'Leadership'],
                      })
                    }
                  >
                    Configure mixed practice <span>→</span>
                  </button>
                </article>
              </div>

              <p className="inline-note" style={{ marginTop: '20px' }}>
                Proctoring camera and voice input can be enabled in Settings for authentic exam conditions.
              </p>
            </div>
          )}

          {/* VIEW: PROGRESS TRACKER */}
          {currentView === 'progress' && (
            <div className="app-page">
              <div className="page-intro">
                <span className="eyebrow">BASED ON SAVED WORKBOOK DATA</span>
                <h3>Progress Tracker</h3>
                <p>Performance figures are calculated from stored practice sessions and answer reviews.</p>
              </div>

              <div className="progress-metrics">
                <article>
                  <span>{dashboardData.attempted_count}</span>
                  <small>ANSWERS REVIEWED</small>
                </article>
                <article>
                  <span>{dashboardData.accuracy === null ? '—' : `${dashboardData.accuracy}%`}</span>
                  <small>ACCURACY</small>
                </article>
                <article>
                  <span>{dashboardData.completed_session_count}</span>
                  <small>COMPLETED SESSIONS</small>
                </article>
              </div>

              <section className="content-section">
                <div className="section-heading">
                  <div>
                    <h3>Topic performance</h3>
                    <p>Intentional retries are excluded from these topic totals.</p>
                  </div>
                </div>

                <div id="topic-performance">
                  {dashboardData.topic_stats.length === 0 ? (
                    <p className="empty-state">No reviewed topic data yet.</p>
                  ) : (
                    dashboardData.topic_stats.map((t) => {
                      const pct = t.total ? Math.round((t.correct / t.total) * 100) : 0;
                      return (
                        <div key={t.focus_area} className="topic-performance-row">
                          <span>{t.focus_area}</span>
                          <div className="topic-progress-track" role="progressbar">
                            <span style={{ width: `${pct}%` }}></span>
                          </div>
                          <strong>
                            {t.correct}/{t.total} · {pct}%
                          </strong>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="content-section">
                <div className="section-heading">
                  <div>
                    <h3>Recent activity</h3>
                    <p>Saved practice sessions and accuracy scores.</p>
                  </div>
                </div>

                <div id="progress-activity">
                  {dashboardData.recent_sessions.length === 0 ? (
                    <p className="empty-state">No practice sessions saved yet.</p>
                  ) : (
                    dashboardData.recent_sessions.map((s) => (
                      <div key={s.session_id} className="activity-row">
                        <strong>{s.role}</strong>
                        <span>
                          {s.accuracy === null
                            ? `${s.attempted_count}/${s.requested_question_count} answered · In progress`
                            : `${s.attempted_count}/${s.requested_question_count} answered · ${s.accuracy}% accuracy`}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="content-section planner-section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">DAILY PLANNER</span>
                    <h3>Plan your next study block</h3>
                    <p>Checklist status is saved in this browser for today's date.</p>
                  </div>
                  <button
                    className="text-action"
                    type="button"
                    onClick={() => {
                      resetPlanner();
                      setPlannerChecked([]);
                      showToast("Today's checklist has been reset.");
                    }}
                  >
                    Reset today's checklist
                  </button>
                </div>

                <div className="planner-list">
                  {[
                    { key: 'practice', label: 'Practise interview questions' },
                    { key: 'review', label: 'Review incorrect answers' },
                    { key: 'weak-topic', label: 'Study a topic that needs more practice' },
                    { key: 'mock', label: 'Complete a mock interview practice' },
                  ].map((task) => {
                    const isChecked = plannerChecked.includes(task.key);
                    return (
                      <label key={task.key}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            setPlannerChecked(togglePlannerTask(task.key, e.target.checked));
                          }}
                        />
                        <span>{task.label}</span>
                      </label>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {/* VIEW: FEEDBACK (Replaces experiences & resources) */}
          {currentView === 'feedback' && (
            <FeedbackView
              onShowToast={showToast}
              onNavigateToPractice={() => {
                setCurrentView('practice');
                setStage('setup');
              }}
            />
          )}

          {/* VIEW: LOGIN & AUTH */}
          {currentView === 'login' && (
            <LoginPage
              currentUser={currentUser}
              onLoginSuccess={(user) => {
                setCurrentUser(user);
                setCurrentView('dashboard');
                showToast(`Welcome back, ${user.name}!`);
              }}
              onNavigateHome={() => setCurrentView('dashboard')}
            />
          )}
        </section>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        violations={violations}
        onClearViolations={clearViolations}
      />

      {/* Toast */}
      <div className={`toast ${toastMessage ? 'show' : ''}`} role="status">
        {toastMessage}
      </div>
    </>
  );
};
