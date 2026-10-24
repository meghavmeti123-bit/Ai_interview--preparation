import React, { useState } from 'react';
import { UserProfile, saveStoredUser } from '../services/auth';

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
  onNavigateHome: () => void;
  currentUser: UserProfile | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onNavigateHome,
  currentUser,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState(currentUser?.email || 'meghavmeti123@gmail.com');
  const [password, setPassword] = useState('••••••••••••');
  const [name, setName] = useState(currentUser?.name || 'Megha V');
  const [role, setRole] = useState<'candidate' | 'teacher'>('candidate');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    const user: UserProfile = {
      id: 'usr-' + Math.random().toString(36).substring(2, 9),
      name: name || email.split('@')[0],
      email: email.trim(),
      role: role,
      joinedDate: 'Joined Oct 2026',
    };

    saveStoredUser(user);
    setSuccessMsg('Signed in successfully! Redirecting to workspace...');
    setTimeout(() => {
      onLoginSuccess(user);
    }, 400);
  };

  const handleQuickLogin = (demoRole: 'candidate' | 'teacher') => {
    let demoUser: UserProfile;
    if (demoRole === 'candidate') {
      demoUser = {
        id: 'usr-cand-1',
        name: 'Megha V',
        email: 'meghavmeti123@gmail.com',
        role: 'candidate',
        joinedDate: 'Active Candidate',
      };
    } else {
      demoUser = {
        id: 'usr-teach-1',
        name: 'Dr. Julian Vance',
        email: 'jvance.cs@university.edu',
        role: 'teacher',
        joinedDate: 'Senior Faculty & Interview Coach',
      };
    }

    saveStoredUser(demoUser);
    onLoginSuccess(demoUser);
  };

  return (
    <div className="app-page">
      <div className="page-intro">
        <span className="eyebrow">SECURE WORKSPACE ACCESS</span>
        <h3>InterviewReady AI Account</h3>
        <p>
          Sign in to preserve your mock interview sessions, anti-cheat proctoring logs, and learning roadmap progress.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.9fr)',
          gap: '32px',
          marginTop: '24px',
          alignItems: 'start',
        }}
      >
        {/* Login / Register Card */}
        <div
          style={{
            background: '#15171c',
            border: '1px solid #282d38',
            borderRadius: '12px',
            padding: '28px',
          }}
        >
          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid #272c38',
              marginBottom: '24px',
              gap: '16px',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError('');
              }}
              style={{
                background: 'none',
                border: 'none',
                paddingBottom: '10px',
                fontSize: '14px',
                fontWeight: 600,
                color: mode === 'signin' ? '#60a5fa' : '#94a3b8',
                borderBottom: mode === 'signin' ? '2px solid #3b82f6' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
              }}
              style={{
                background: 'none',
                border: 'none',
                paddingBottom: '10px',
                fontSize: '14px',
                fontWeight: 600,
                color: mode === 'signup' ? '#60a5fa' : '#94a3b8',
                borderBottom: mode === 'signup' ? '2px solid #3b82f6' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              Create Account
            </button>
          </div>

          {/* Quick Demo Logins */}
          <div style={{ marginBottom: '22px' }}>
            <span style={{ fontSize: '11px', fontFamily: 'var(--mono)', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
              ONE-CLICK DEMO ACCESS:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => handleQuickLogin('candidate')}
                style={{
                  background: '#1a2233',
                  border: '1px solid #2f3e5c',
                  color: '#93c5fd',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  justifyContent: 'center',
                }}
              >
                <span>👨‍💻</span>
                <span>Candidate Demo</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('teacher')}
                style={{
                  background: '#192823',
                  border: '1px solid #285443',
                  color: '#86efac',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  justifyContent: 'center',
                }}
              >
                <span>👩‍🏫</span>
                <span>Teacher / Coach</span>
              </button>
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              textAlign: 'center',
              margin: '20px 0',
            }}
          >
            <div style={{ borderTop: '1px solid #232733' }}></div>
            <span
              style={{
                position: 'absolute',
                top: '-9px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#15171c',
                padding: '0 10px',
                fontSize: '10px',
                fontFamily: 'var(--mono)',
                color: '#64748b',
              }}
            >
              OR WITH EMAIL
            </span>
          </div>

          <form onSubmit={handleSignIn}>
            {mode === 'signup' && (
              <div style={{ marginBottom: '16px' }}>
                <label className="field-label" style={{ fontSize: '12px' }}>Full Name</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="e.g. Megha V"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ background: '#1c1f26', padding: '0 12px', borderRadius: '6px', border: '1px solid #2e3544' }}
                  required
                />
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label className="field-label" style={{ fontSize: '12px' }}>Email Address</label>
              <input
                type="email"
                className="text-input"
                placeholder="meghavmeti123@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ background: '#1c1f26', padding: '0 12px', borderRadius: '6px', border: '1px solid #2e3544' }}
                required
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="field-label" style={{ fontSize: '12px' }}>Password</label>
              <input
                type="password"
                className="text-input"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ background: '#1c1f26', padding: '0 12px', borderRadius: '6px', border: '1px solid #2e3544' }}
                required
              />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label className="field-label" style={{ fontSize: '12px' }}>Account Role</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setRole('candidate')}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: `1px solid ${role === 'candidate' ? '#3b82f6' : '#282d38'}`,
                    background: role === 'candidate' ? '#1e293b' : '#181b22',
                    color: role === 'candidate' ? '#93c5fd' : '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  Candidate (Job Seeker)
                </button>
                <button
                  type="button"
                  onClick={() => setRole('teacher')}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: `1px solid ${role === 'teacher' ? '#10b981' : '#282d38'}`,
                    background: role === 'teacher' ? '#0f291e' : '#181b22',
                    color: role === 'teacher' ? '#86efac' : '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  Teacher / Evaluator
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember my session
              </label>
              <span style={{ fontSize: '11px', color: '#60a5fa', cursor: 'pointer' }}>Privacy Protected</span>
            </div>

            {error && (
              <p className="inline-error" style={{ marginBottom: '14px' }}>
                {error}
              </p>
            )}

            {successMsg && (
              <p style={{ color: '#86efac', fontSize: '12px', marginBottom: '14px' }}>
                ✓ {successMsg}
              </p>
            )}

            <button
              type="submit"
              className="button button-dark"
              style={{ width: '100%', height: '44px', fontWeight: 600 }}
            >
              {mode === 'signin' ? 'Sign In to Workspace →' : 'Complete Registration →'}
            </button>
          </form>
        </div>

        {/* Security & Features Overview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              background: '#15171c',
              border: '1px solid #282d38',
              borderRadius: '12px',
              padding: '22px',
            }}
          >
            <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', color: '#10b981' }}>
              AUTHENTICATED PRIVILEGES
            </span>
            <h4 style={{ margin: '6px 0 12px', fontSize: '16px', color: '#f1f5f9' }}>
              Full Practice Environment
            </h4>

            <ul style={{ margin: 0, paddingLeft: '18px', color: '#cbd5e1', fontSize: '12px', lineHeight: 1.8 }}>
              <li><strong>Live Anti-Cheat Camera:</strong> Face orientation and eye tracking detection to certify honest performance.</li>
              <li><strong>Continuous AI Questions:</strong> Gemini 3.8 Flash creates unlimited questions on the spot.</li>
              <li><strong>Voice Answering &amp; Voice Mail:</strong> Record audio explanations and submit speech answers directly.</li>
              <li><strong>Learning Roadmap with Diagrams:</strong> Master the 15 core interview modules with system architecture diagrams.</li>
              <li><strong>Teacher Evaluation Emojis:</strong> Receive feedback badges from professors and hiring panels.</li>
            </ul>
          </div>

          {currentUser && (
            <div
              style={{
                background: '#131b26',
                border: '1px solid #24344d',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', color: '#93c5fd' }}>CURRENTLY LOGGED IN</span>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                  {currentUser.name} ({currentUser.email})
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Role: {currentUser.role === 'teacher' ? 'Teacher / Evaluator' : 'Interview Candidate'}
                </div>
              </div>
              <button
                type="button"
                className="button button-light"
                onClick={onNavigateHome}
                style={{ fontSize: '11px', height: '34px', padding: '0 12px' }}
              >
                Go to Workspace →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
