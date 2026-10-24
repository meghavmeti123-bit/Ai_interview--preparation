import React from 'react';
import { ProctorSettings, ProctorViolation } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ProctorSettings;
  onUpdateSettings: (newSettings: ProctorSettings) => void;
  violations: ProctorViolation[];
  onClearViolations: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  violations,
  onClearViolations,
}) => {
  if (!isOpen) return null;

  const handleChange = (key: keyof ProctorSettings, value: boolean) => {
    onUpdateSettings({
      ...settings,
      [key]: value,
    });
  };

  const handleFullscreenToggle = (enabled: boolean) => {
    handleChange('fullscreenEnforced', enabled);
    if (enabled && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (!enabled && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">INTERVIEW INTEGRITY & PREFERENCES</span>
            <h3>Interview & Proctoring Settings</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div style={{ display: 'grid', gap: '4px' }}>
          <div className="setting-row">
            <div>
              <div className="setting-label">🛡️ Anti-Cheat Proctoring Engine</div>
              <div className="setting-desc">
                Monitors interview integrity, focus changes, and external assistance during question rounds.
              </div>
            </div>
            <label className="switch-toggle">
              <input
                type="checkbox"
                checked={settings.antiCheatEnabled}
                onChange={(e) => handleChange('antiCheatEnabled', e.target.checked)}
              />
              <span className="switch-slider"></span>
            </label>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">📷 Candidate Webcam Stream</div>
              <div className="setting-desc">
                Enables live webcam preview and face-in-frame presence monitoring to prevent proxy interviewing.
              </div>
            </div>
            <label className="switch-toggle">
              <input
                type="checkbox"
                checked={settings.cameraEnabled}
                onChange={(e) => handleChange('cameraEnabled', e.target.checked)}
              />
              <span className="switch-slider"></span>
            </label>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">📑 Tab-Switch & Focus Detection</div>
              <div className="setting-desc">
                Detects if candidate navigates to other browser tabs or applications to look up answers.
              </div>
            </div>
            <label className="switch-toggle">
              <input
                type="checkbox"
                checked={settings.tabSwitchDetection}
                onChange={(e) => handleChange('tabSwitchDetection', e.target.checked)}
              />
              <span className="switch-slider"></span>
            </label>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">🔲 Enforce Fullscreen Mode</div>
              <div className="setting-desc">
                Locks browser window in fullscreen mode during the interview round to deter multitasking.
              </div>
            </div>
            <label className="switch-toggle">
              <input
                type="checkbox"
                checked={settings.fullscreenEnforced}
                onChange={(e) => handleFullscreenToggle(e.target.checked)}
              />
              <span className="switch-slider"></span>
            </label>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">🎙️ Voice Answer Integration</div>
              <div className="setting-desc">
                Allows candidate to state answers verbally using microphone speech recognition.
              </div>
            </div>
            <label className="switch-toggle">
              <input
                type="checkbox"
                checked={settings.voiceAnswerEnabled}
                onChange={(e) => handleChange('voiceAnswerEnabled', e.target.checked)}
              />
              <span className="switch-slider"></span>
            </label>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">🔊 Read Questions Aloud (TTS)</div>
              <div className="setting-desc">
                AI interviewer automatically speaks questions and options aloud when each question loads.
              </div>
            </div>
            <label className="switch-toggle">
              <input
                type="checkbox"
                checked={settings.readQuestionsAloud}
                onChange={(e) => handleChange('readQuestionsAloud', e.target.checked)}
              />
              <span className="switch-slider"></span>
            </label>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">⏺️ Voice Mail / Audio Reasoning</div>
              <div className="setting-desc">
                Enables recording spoken explanations of your thought process for teacher &amp; coach evaluation.
              </div>
            </div>
            <label className="switch-toggle">
              <input
                type="checkbox"
                checked={settings.voiceMailEnabled ?? true}
                onChange={(e) => handleChange('voiceMailEnabled', e.target.checked)}
              />
              <span className="switch-slider"></span>
            </label>
          </div>
        </div>

        {violations.length > 0 && (
          <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="field-label">RECENT PROCTOR LOGS ({violations.length})</span>
              <button
                type="button"
                className="text-action"
                style={{ fontSize: '11px' }}
                onClick={onClearViolations}
              >
                Clear logs
              </button>
            </div>
            <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'grid', gap: '6px' }}>
              {violations.slice(-5).map((v) => (
                <div
                  key={v.id}
                  style={{
                    fontSize: '11px',
                    padding: '6px 10px',
                    background: '#1d1d22',
                    borderRadius: '5px',
                    color: '#fca5a5',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>⚠️ {v.message}</span>
                  <span style={{ color: '#71717a' }}>{v.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" className="button button-dark" onClick={onClose}>
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
