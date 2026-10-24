import React, { useState } from 'react';
import { CandidateFeedback } from '../types';
import { getStoredFeedbacks, saveCandidateFeedback, toggleFeedbackReaction } from '../services/storage';

interface FeedbackViewProps {
  onShowToast: (msg: string) => void;
  onNavigateToPractice: () => void;
}

const TEACHER_EMOJIS = [
  { emoji: '🏆 Outstanding', type: 'good', desc: 'Mastery & deep reasoning' },
  { emoji: '👏 Great Effort', type: 'good', desc: 'Sound trade-off analysis' },
  { emoji: '🎯 Spot On', type: 'good', desc: 'Direct, accurate response' },
  { emoji: '🌟 Highly Recommended', type: 'good', desc: 'Ready for real hiring loops' },
  { emoji: '🤔 Needs Work', type: 'bad', desc: 'Concept gaps identified' },
  { emoji: '⚠️ High Risk', type: 'bad', desc: 'Struggled with core basics' },
  { emoji: '❌ Unprepared', type: 'bad', desc: 'Requires full concept review' },
  { emoji: '📚 Needs Revision', type: 'bad', desc: 'Re-study system documentation' },
];

export const FeedbackView: React.FC<FeedbackViewProps> = ({
  onShowToast,
  onNavigateToPractice,
}) => {
  const [feedbacks, setFeedbacks] = useState<CandidateFeedback[]>(getStoredFeedbacks());
  const [filter, setFilter] = useState<'all' | 'teacher' | 'candidate' | 'useful'>('all');

  // Form state
  const [authorName, setAuthorName] = useState('');
  const [userRole, setUserRole] = useState('Senior Interview Coach / Teacher');
  const [isUseful, setIsUseful] = useState(true);
  const [rating, setRating] = useState(5);
  const [thumbs, setThumbs] = useState<'up' | 'down'>('up');
  const [selectedEmoji, setSelectedEmoji] = useState('🏆 Outstanding');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      onShowToast('Please provide your comments before submitting.');
      return;
    }

    setIsSubmitting(true);
    const author = authorName.trim() || 'Anonymous Reviewer';
    const newEntry = saveCandidateFeedback({
      author,
      role: userRole,
      isUseful,
      rating,
      thumbs,
      teacherEmoji: selectedEmoji,
      comment: comment.trim(),
    });

    setFeedbacks(getStoredFeedbacks());
    setComment('');
    setAuthorName('');
    setIsSubmitting(false);
    onShowToast('Thank you! Your feedback and rating have been recorded.');
  };

  const handleReaction = (id: string, reaction: 'up' | 'down') => {
    const updated = toggleFeedbackReaction(id, reaction);
    setFeedbacks(updated);
  };

  const filteredFeedbacks = feedbacks.filter((item) => {
    if (filter === 'teacher') return item.role.toLowerCase().includes('teacher') || item.role.toLowerCase().includes('coach') || item.role.toLowerCase().includes('faculty') || item.role.toLowerCase().includes('evaluator') || item.role.toLowerCase().includes('mentor');
    if (filter === 'candidate') return item.role.toLowerCase().includes('candidate') || item.role.toLowerCase().includes('developer') || item.role.toLowerCase().includes('student');
    if (filter === 'useful') return item.isUseful === true;
    return true;
  });

  return (
    <div className="app-page">
      <div className="page-intro">
        <span className="eyebrow">COMMUNITY &amp; TEACHER EVALUATION</span>
        <h3>Interview Feedback &amp; Ratings</h3>
        <p>
          Help us improve the interview simulation. Share whether your session was useful, rate your experience, and let
          teachers leave feedback emojis for student answers.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)', gap: '28px', marginTop: '24px' }}>
        {/* Feedback Submission Form */}
        <section
          style={{
            background: '#15171c',
            border: '1px solid #282d38',
            borderRadius: '12px',
            padding: '24px',
          }}
        >
          <div style={{ borderBottom: '1px solid #232733', paddingBottom: '14px', marginBottom: '20px' }}>
            <span style={{ fontSize: '11px', fontFamily: 'var(--mono)', color: '#60a5fa' }}>SUBMIT YOUR REVIEW</span>
            <h4 style={{ margin: '6px 0 0', fontSize: '18px', color: '#f1f5f9' }}>Rate Your Interview Session</h4>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Author & Role */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label className="field-label" style={{ fontSize: '12px' }}>Your Name</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="e.g. Dr. Alex Mercer"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  style={{ background: '#1c1f26', padding: '0 12px', borderRadius: '6px', border: '1px solid #2e3544' }}
                />
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '12px' }}>Role / Capacity</label>
                <select
                  className="select-input"
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  style={{ background: '#1c1f26', padding: '0 12px', borderRadius: '6px', border: '1px solid #2e3544' }}
                >
                  <option value="Senior Interview Coach / Teacher">Senior Coach / Teacher</option>
                  <option value="University Faculty / Professor">University Professor</option>
                  <option value="Technical Hiring Manager">Technical Hiring Manager</option>
                  <option value="Software Engineer Candidate">Software Engineer Candidate</option>
                  <option value="DevOps / Cloud Candidate">DevOps / Cloud Candidate</option>
                  <option value="Student Practicing for Placements">Student Practicing</option>
                </select>
              </div>
            </div>

            {/* Was it useful toggle */}
            <div style={{ marginBottom: '18px' }}>
              <label className="field-label" style={{ fontSize: '12px' }}>Was this interview practice useful?</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsUseful(true);
                    setThumbs('up');
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: `1px solid ${isUseful ? '#10b981' : '#282d38'}`,
                    background: isUseful ? '#0f291e' : '#181b22',
                    color: isUseful ? '#86efac' : '#94a3b8',
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <span>👍</span>
                  <span>Yes, Very Useful</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsUseful(false);
                    setThumbs('down');
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: `1px solid ${!isUseful ? '#ef4444' : '#282d38'}`,
                    background: !isUseful ? '#3b1219' : '#181b22',
                    color: !isUseful ? '#fca5a5' : '#94a3b8',
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <span>👎</span>
                  <span>No, Needs Improvement</span>
                </button>
              </div>
            </div>

            {/* Rating Stars & Thumbs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px', marginBottom: '18px' }}>
              <div>
                <label className="field-label" style={{ fontSize: '12px' }}>Rating (1 to 5 Stars)</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '24px',
                        cursor: 'pointer',
                        color: star <= rating ? '#fbbf24' : '#334155',
                        padding: '0 2px',
                        transition: 'transform 0.1s',
                      }}
                    >
                      ★
                    </button>
                  ))}
                  <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '6px' }}>({rating}/5)</span>
                </div>
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '12px' }}>Thumbs Verdict</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setThumbs('up')}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: `1px solid ${thumbs === 'up' ? '#3b82f6' : '#282d38'}`,
                      background: thumbs === 'up' ? '#1e293b' : '#181b22',
                      color: thumbs === 'up' ? '#60a5fa' : '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    👍 Thumbs Up
                  </button>
                  <button
                    type="button"
                    onClick={() => setThumbs('down')}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: `1px solid ${thumbs === 'down' ? '#ef4444' : '#282d38'}`,
                      background: thumbs === 'down' ? '#351219' : '#181b22',
                      color: thumbs === 'down' ? '#fca5a5' : '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    👎 Thumbs Down
                  </button>
                </div>
              </div>
            </div>

            {/* Teacher Rating Emojis */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="field-label" style={{ margin: 0, fontSize: '12px' }}>
                  Teacher / Evaluator Emoji Badge (Good or Bad)
                </label>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>Select grading tag</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {TEACHER_EMOJIS.map((item) => {
                  const isSelected = selectedEmoji === item.emoji;
                  const isGood = item.type === 'good';
                  return (
                    <button
                      key={item.emoji}
                      type="button"
                      onClick={() => setSelectedEmoji(item.emoji)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: `1px solid ${isSelected ? (isGood ? '#10b981' : '#f87171') : '#232936'}`,
                        background: isSelected ? (isGood ? '#122c22' : '#331217') : '#181b22',
                        color: isSelected ? '#ffffff' : '#cbd5e1',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>{item.emoji}</span>
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comment */}
            <div style={{ marginBottom: '20px' }}>
              <label className="field-label" style={{ fontSize: '12px' }}>Feedback Comments &amp; Observations</label>
              <textarea
                className="text-input"
                rows={4}
                placeholder="Share specific observations about the question quality, proctoring camera, voice answering, or candidate preparedness..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                style={{
                  height: 'auto',
                  minHeight: '90px',
                  background: '#1c1f26',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #2e3544',
                  resize: 'vertical',
                }}
              />
            </div>

            <button
              type="submit"
              className="button button-dark"
              disabled={isSubmitting}
              style={{ width: '100%', height: '44px', fontWeight: 600 }}
            >
              {isSubmitting ? 'Recording Feedback...' : 'Submit Feedback & Rating'}
            </button>
          </form>
        </section>

        {/* Live Feedback Feed / Community */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', fontFamily: 'var(--mono)', color: '#94a3b8' }}>
              REVIEWS &amp; RATINGS ({feedbacks.length})
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['all', 'teacher', 'candidate', 'useful'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  style={{
                    background: filter === tab ? '#2563eb' : '#1c1f26',
                    border: '1px solid #2e3544',
                    color: filter === tab ? '#ffffff' : '#94a3b8',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '720px', overflowY: 'auto', paddingRight: '4px' }}>
            {filteredFeedbacks.length === 0 ? (
              <p className="empty-state">No feedback matching this filter.</p>
            ) : (
              filteredFeedbacks.map((item) => (
                <article
                  key={item.id}
                  style={{
                    background: '#15171c',
                    border: '1px solid #282d38',
                    borderRadius: '10px',
                    padding: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '13px', color: '#f1f5f9' }}>{item.author}</strong>
                        <span
                          style={{
                            fontSize: '9px',
                            fontFamily: 'var(--mono)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: item.isUseful ? '#142820' : '#331418',
                            color: item.isUseful ? '#86efac' : '#fca5a5',
                            border: `1px solid ${item.isUseful ? '#285a49' : '#6b1d24'}`,
                          }}
                        >
                          {item.isUseful ? '✓ Useful' : '✕ Not Useful'}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        {item.role} · {item.createdAt}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: '#fbbf24', fontSize: '13px' }}>
                        {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
                      </span>
                    </div>
                  </div>

                  {/* Teacher Emoji Tag */}
                  <div style={{ marginBottom: '10px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: '#1e2430',
                        border: '1px solid #333f54',
                        color: '#93c5fd',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      Teacher Rating: {item.teacherEmoji}
                    </span>
                  </div>

                  {/* Comment */}
                  <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#d1d5db', lineHeight: 1.55 }}>
                    "{item.comment}"
                  </p>

                  {/* Reaction Buttons (Thumbs Up / Thumbs Down Voting) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderTop: '1px solid #232733', paddingTop: '10px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Helpful?</span>

                    <button
                      type="button"
                      onClick={() => handleReaction(item.id, 'up')}
                      style={{
                        background: item.userReaction === 'up' ? '#1e3a5f' : '#1c1f26',
                        border: `1px solid ${item.userReaction === 'up' ? '#3b82f6' : '#2e3544'}`,
                        color: item.userReaction === 'up' ? '#93c5fd' : '#94a3b8',
                        padding: '3px 9px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                      title="Vote this feedback as helpful"
                    >
                      <span>👍</span>
                      <span>{item.likes}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReaction(item.id, 'down')}
                      style={{
                        background: item.userReaction === 'down' ? '#3b1219' : '#1c1f26',
                        border: `1px solid ${item.userReaction === 'down' ? '#ef4444' : '#2e3544'}`,
                        color: item.userReaction === 'down' ? '#fca5a5' : '#94a3b8',
                        padding: '3px 9px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                      title="Vote this feedback as unhelpful"
                    >
                      <span>👎</span>
                      <span>{item.dislikes}</span>
                    </button>

                    <button
                      type="button"
                      onClick={onNavigateToPractice}
                      style={{
                        marginLeft: 'auto',
                        background: 'none',
                        border: 'none',
                        color: '#60a5fa',
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      Practise Now →
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
