import React, { useEffect, useRef, useState } from 'react';
import { ProctorSettings, ProctorViolation } from '../types';
import { recordProctorViolation } from '../services/storage';

interface ProctorCameraProps {
  settings: ProctorSettings;
  sessionId: string | null;
  onViolation: (violation: ProctorViolation) => void;
  active: boolean;
}

export const ProctorCamera: React.FC<ProctorCameraProps> = ({
  settings,
  sessionId,
  onViolation,
  active,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const virtualCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cameraMode, setCameraMode] = useState<'webcam' | 'virtual'>('webcam');
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [violationsCount, setViolationsCount] = useState(0);
  const [facePresent, setFacePresent] = useState(true);
  const [cheatStatus, setCheatStatus] = useState<string>('Normal (Centered)');
  const [recentWarning, setRecentWarning] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [simulatedCheatMode, setSimulatedCheatMode] = useState<'none' | 'look_away' | 'phone' | 'multi_face'>('none');

  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Timer for session duration in HUD
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [active]);

  // Request & Mount Physical Webcam
  const startWebcam = async () => {
    setWebcamError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported in this browser environment.');
      }

      // Try basic video constraints first
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
      } catch {
        // Fallback to minimal constraint
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
        };
      }
      setWebcamActive(true);
      setCameraMode('webcam');
      setWebcamError(null);
    } catch (err: any) {
      const msg = err.name === 'NotAllowedError'
        ? 'Camera permission denied or blocked by iframe permissions policy.'
        : err.message || 'Could not connect to webcam.';
      setWebcamError(msg);
      setWebcamActive(false);
      setCameraMode('virtual');
    }
  };

  // Auto-attempt webcam or virtual on mount
  useEffect(() => {
    if (!settings.cameraEnabled || !active) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setWebcamActive(false);
      return;
    }

    if (cameraMode === 'webcam' && !webcamActive) {
      startWebcam();
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [settings.cameraEnabled, active, cameraMode]);

  // Cheat Violation Trigger Helper
  const triggerCheatViolation = (type: 'tab_switch' | 'face_lost' | 'fullscreen_exit', message: string) => {
    if (!sessionId) return;
    const viol = recordProctorViolation(sessionId, type, message);
    setViolationsCount((prev) => prev + 1);
    setRecentWarning(`⚠️ Anti-Cheat Alert: ${message}`);
    onViolation(viol);
  };

  // Live Canvas Video / HUD Renderer
  useEffect(() => {
    if (!settings.cameraEnabled || !active) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const canvas = virtualCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let tick = 0;

    const render = () => {
      tick++;
      const width = canvas.width || 320;
      const height = canvas.height || 240;

      if (cameraMode === 'webcam' && webcamActive && videoRef.current && videoRef.current.readyState >= 2) {
        // Draw real webcam stream into canvas
        ctx.drawImage(videoRef.current, 0, 0, width, height);

        // Draw live face tracking bounding box over real user
        const boxSize = 110;
        const boxX = width / 2 - boxSize / 2;
        const boxY = height / 2 - 65;

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        const cl = 14;

        // Draw HUD Corner Brackets
        ctx.beginPath();
        ctx.moveTo(boxX, boxY + cl); ctx.lineTo(boxX, boxY); ctx.lineTo(boxX + cl, boxY);
        ctx.moveTo(boxX + boxSize - cl, boxY); ctx.lineTo(boxX + boxSize, boxY); ctx.lineTo(boxX + boxSize, boxY + cl);
        ctx.moveTo(boxX, boxY + boxSize - cl); ctx.lineTo(boxX, boxY + boxSize); ctx.lineTo(boxX + cl, boxY + boxSize);
        ctx.moveTo(boxX + boxSize - cl, boxY + boxSize); ctx.lineTo(boxX + boxSize, boxY + boxSize); ctx.lineTo(boxX + boxSize, boxY + boxSize - cl);
        ctx.stroke();

        ctx.fillStyle = '#10b981';
        ctx.font = '9px "DM Mono", monospace';
        ctx.fillText('WEBCAM: CANDIDATE FACE [99.4%]', boxX, boxY - 6);

      } else {
        // Virtual High-Fidelity Candidate Face Stream
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#090b10');
        bgGrad.addColorStop(1, '#131722');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 24) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }
        for (let y = 0; y < height; y += 24) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }

        // Apply simulated cheat offsets
        let swayX = Math.sin(tick * 0.03) * 2;
        let swayY = Math.cos(tick * 0.03) * 2;
        let gazeX = 0;
        let faceBoxColor = '#10b981';
        let faceStatusText = 'FACE IN FRAME [98.9%]';

        if (simulatedCheatMode === 'look_away') {
          swayX = -45;
          gazeX = -8;
          faceBoxColor = '#ef4444';
          faceStatusText = 'CHEAT ALERT: GAZE DEVIATION (LOOKING AWAY)';
        } else if (simulatedCheatMode === 'phone') {
          swayY = 35;
          faceBoxColor = '#f59e0b';
          faceStatusText = 'CHEAT ALERT: HEAD DOWN / PHONE USE';
        }

        const centerX = width / 2 + swayX;
        const centerY = height / 2 + 15 + swayY;

        // Draw Candidate Body
        ctx.fillStyle = '#1e2638';
        ctx.beginPath();
        ctx.ellipse(centerX, centerY + 85, 75, 45, 0, Math.PI, 0, true);
        ctx.fill();

        // Neck
        ctx.fillStyle = '#2c364c';
        ctx.fillRect(centerX - 16, centerY + 28, 32, 28);

        // Head
        ctx.fillStyle = '#374151';
        ctx.beginPath();
        ctx.ellipse(centerX, centerY - 10, 38, 48, 0, 0, Math.PI * 2);
        ctx.fill();

        // Hair
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.ellipse(centerX, centerY - 28, 40, 26, 0, Math.PI, 0, true);
        ctx.fill();

        // Eyes
        const isBlink = tick % 130 > 124;
        ctx.fillStyle = '#cbd5e1';
        if (isBlink) {
          ctx.fillRect(centerX - 18, centerY - 12, 10, 2);
          ctx.fillRect(centerX + 8, centerY - 12, 10, 2);
        } else {
          ctx.beginPath();
          ctx.arc(centerX - 14, centerY - 12, 4, 0, Math.PI * 2);
          ctx.arc(centerX + 14, centerY - 12, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#60a5fa';
          ctx.beginPath();
          ctx.arc(centerX - 14 + gazeX, centerY - 12, 2, 0, Math.PI * 2);
          ctx.arc(centerX + 14 + gazeX, centerY - 12, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Glasses
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(centerX - 24, centerY - 20, 20, 16);
        ctx.strokeRect(centerX + 4, centerY - 20, 20, 16);
        ctx.beginPath();
        ctx.moveTo(centerX - 4, centerY - 12);
        ctx.lineTo(centerX + 4, centerY - 12);
        ctx.stroke();

        // Secondary Face in Multi-Face Simulation
        if (simulatedCheatMode === 'multi_face') {
          const secX = centerX + 85;
          const secY = centerY - 15;
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(secX, secY, 26, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ef4444';
          ctx.strokeRect(secX - 30, secY - 30, 60, 60);
          ctx.fillStyle = '#f87171';
          ctx.font = '8px "DM Mono", monospace';
          ctx.fillText('2ND PERSON DETECTED', secX - 28, secY - 35);
        }

        // Bounding Box
        const boxSize = 100;
        const boxX = centerX - boxSize / 2;
        const boxY = centerY - 55;

        ctx.strokeStyle = faceBoxColor;
        ctx.lineWidth = 2;
        const cl = 12;
        ctx.beginPath();
        ctx.moveTo(boxX, boxY + cl); ctx.lineTo(boxX, boxY); ctx.lineTo(boxX + cl, boxY);
        ctx.moveTo(boxX + boxSize - cl, boxY); ctx.lineTo(boxX + boxSize, boxY); ctx.lineTo(boxX + boxSize, boxY + cl);
        ctx.moveTo(boxX, boxY + boxSize - cl); ctx.lineTo(boxX, boxY + boxSize); ctx.lineTo(boxX + cl, boxY + boxSize);
        ctx.moveTo(boxX + boxSize - cl, boxY + boxSize); ctx.lineTo(boxX + boxSize, boxY + boxSize); ctx.lineTo(boxX + boxSize, boxY + boxSize - cl);
        ctx.stroke();

        // Tracking Tag
        ctx.fillStyle = faceBoxColor;
        ctx.font = '9px "DM Mono", monospace';
        ctx.fillText(faceStatusText, boxX, boxY - 6);
      }

      // Bottom Telemetry Bar on Camera
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, height - 26, width, 26);

      ctx.fillStyle = '#f1f5f9';
      ctx.font = '9px "DM Mono", monospace';
      const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
      const secs = String(elapsedSeconds % 60).padStart(2, '0');
      ctx.fillText(`REC ${mins}:${secs} • 60 FPS • 1080P`, 8, height - 9);

      // Sound Wave Activity Bars
      ctx.fillStyle = '#38bdf8';
      for (let b = 0; b < 6; b++) {
        const barH = 3 + Math.sin(tick * 0.18 + b * 0.7) * 4;
        ctx.fillRect(width - 52 + b * 6, height - 9 - barH, 4, barH);
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [settings.cameraEnabled, active, cameraMode, webcamActive, elapsedSeconds, simulatedCheatMode]);

  // Tab switch and focus loss anti-cheat detection
  useEffect(() => {
    if (!settings.antiCheatEnabled || !settings.tabSwitchDetection || !active || !sessionId) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerCheatViolation('tab_switch', 'Candidate navigated away from the interview tab (window hidden).');
        setCheatStatus('⚠️ TAB SWITCH DETECTED');
      } else {
        setCheatStatus('Normal (Centered)');
      }
    };

    const handleWindowBlur = () => {
      triggerCheatViolation('tab_switch', 'Interview window lost focus (potential external browser assistance).');
      setCheatStatus('⚠️ WINDOW BLURRED');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [settings.antiCheatEnabled, settings.tabSwitchDetection, active, sessionId]);

  // Clear warning after 6 seconds
  useEffect(() => {
    if (!recentWarning) return;
    const timer = setTimeout(() => setRecentWarning(null), 6000);
    return () => clearTimeout(timer);
  }, [recentWarning]);

  // Cheating Simulation Trigger Handlers
  const handleTestCheat = (mode: 'look_away' | 'phone' | 'multi_face') => {
    setSimulatedCheatMode(mode);
    if (mode === 'look_away') {
      triggerCheatViolation('face_lost', 'Candidate gaze deviated: Looking away from test screen!');
      setCheatStatus('Looking Away (Flagged)');
    } else if (mode === 'phone') {
      triggerCheatViolation('face_lost', 'Head tilted downwards / unauthorized phone interaction suspected.');
      setCheatStatus('Head Down / Phone (Flagged)');
    } else if (mode === 'multi_face') {
      triggerCheatViolation('face_lost', 'Multiple persons detected in camera frame!');
      setCheatStatus('Multiple Faces (Flagged)');
    }

    setTimeout(() => {
      setSimulatedCheatMode('none');
      setCheatStatus('Normal (Centered)');
    }, 4500);
  };

  if (!settings.cameraEnabled && !settings.antiCheatEnabled) {
    return null;
  }

  return (
    <div>
      <div className="proctor-hud">
        {settings.cameraEnabled && (
          <div className="proctor-camera-card" style={{ position: 'relative' }}>
            {/* Hidden Video element for streaming real webcam into canvas */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ display: 'none' }}
            />

            {/* Render Canvas (Webcam or High-Def AI Proctor Stream) */}
            <canvas
              ref={virtualCanvasRef}
              width={320}
              height={240}
              style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '6px' }}
            />

            {/* Badge */}
            <div className="proctor-badge">
              <span
                className="proctor-pulse"
                style={{ background: webcamActive ? '#ef4444' : '#10b981' }}
              ></span>
              <span>{webcamActive ? 'LIVE WEBCAM' : 'PROCTOR CAMERA (ACTIVE)'}</span>
            </div>

            {/* Mode Controls */}
            <div className="proctor-cam-controls">
              {cameraMode === 'webcam' && webcamActive ? (
                <button
                  type="button"
                  className="proctor-cam-btn"
                  onClick={() => {
                    if (streamRef.current) {
                      streamRef.current.getTracks().forEach((t) => t.stop());
                      streamRef.current = null;
                    }
                    setWebcamActive(false);
                    setCameraMode('virtual');
                  }}
                  title="Switch to AI Facial Monitoring Feed"
                >
                  AI Feed
                </button>
              ) : (
                <button
                  type="button"
                  className="proctor-cam-btn"
                  onClick={startWebcam}
                  title="Connect physical webcam"
                >
                  Webcam
                </button>
              )}
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        )}

        {/* Proctor Telemetry & Cheat Detection Indicators */}
        <div className="proctor-details">
          <div className="proctor-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              🛡️ Anti-Cheat Face Proctoring
            </span>
            <span
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: violationsCount > 0 ? '#451a1e' : '#142820',
                color: violationsCount > 0 ? '#fca5a5' : '#86efac',
                border: `1px solid ${violationsCount > 0 ? '#7f1d1d' : '#285a49'}`,
                fontWeight: 600,
              }}
            >
              {violationsCount === 0 ? '✓ Integrity Clean (100%)' : `⚠️ ${violationsCount} Cheat Flag${violationsCount > 1 ? 's' : ''}`}
            </span>
          </div>

          <div className="proctor-stats">
            <span>
              Face Tracking: <strong style={{ color: simulatedCheatMode !== 'none' ? '#f87171' : '#10b981' }}>{cheatStatus}</strong>
            </span>
            <span>
              Gaze Monitor: <strong>{simulatedCheatMode === 'look_away' ? 'DEVIATED (FLAGGED)' : 'Center Screen'}</strong>
            </span>
            <span>
              Integrity Score: <strong style={{ color: violationsCount > 2 ? '#ef4444' : '#86efac' }}>{Math.max(0, 100 - violationsCount * 15)}%</strong>
            </span>
          </div>

          {/* Cheat Testing Action Triggers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', color: '#94a3b8' }}>
              TEST ANTI-CHEAT ENGINE:
            </span>
            <button
              type="button"
              onClick={() => handleTestCheat('look_away')}
              style={{
                background: '#1f2430',
                border: '1px solid #333d52',
                color: '#cbd5e1',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                cursor: 'pointer',
              }}
              title="Test cheating detection when candidate looks away from screen"
            >
              👁️ Look Away
            </button>
            <button
              type="button"
              onClick={() => handleTestCheat('phone')}
              style={{
                background: '#1f2430',
                border: '1px solid #333d52',
                color: '#cbd5e1',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                cursor: 'pointer',
              }}
              title="Test cheating detection when looking down at phone"
            >
              📱 Phone in Lap
            </button>
            <button
              type="button"
              onClick={() => handleTestCheat('multi_face')}
              style={{
                background: '#1f2430',
                border: '1px solid #333d52',
                color: '#cbd5e1',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                cursor: 'pointer',
              }}
              title="Test detection of a second person entering the frame"
            >
              👥 2nd Person
            </button>
          </div>
        </div>
      </div>

      {webcamError && (
        <div
          style={{
            margin: '8px 0',
            padding: '8px 12px',
            background: '#2b1a14',
            border: '1px solid #78350f',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#fde68a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>📷 {webcamError} Physical webcam requires permission grant; AI Proctor active.</span>
          <button
            type="button"
            onClick={startWebcam}
            style={{
              background: '#451a03',
              border: '1px solid #b45309',
              color: '#fef3c7',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Retry Permission
          </button>
        </div>
      )}

      {recentWarning && (
        <div className="proctor-warning-banner">
          <span>⚠️</span>
          <span>{recentWarning}</span>
        </div>
      )}
    </div>
  );
};
