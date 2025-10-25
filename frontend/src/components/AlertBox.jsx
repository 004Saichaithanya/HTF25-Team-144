import { useEffect, useState, useRef } from 'react';
import socket from '../socket';

// AlertBox now prefers receiving live `count` as a prop from Dashboard.
// If `count` is not provided, it falls back to listening on socket 'crowd_update'.
function AlertBox({ count: propCount, threshold = 10 }) {
  const [currentCount, setCurrentCount] = useState(propCount ?? 0);
  const [alert, setAlert] = useState(false);
  const prevAlertRef = useRef(false);

  // Hysteresis values to avoid flicker: turn alert on when > threshold, turn off when <= threshold - 2
  const OFF_MARGIN = 2;

  // play a short beep when entering alert state
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.value = 0.05;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(() => {
        o.stop();
        ctx.close();
      }, 200);
    } catch (e) {
      // ignore if audio context not allowed
    }
  };

  // Update from propCount (preferred)
  useEffect(() => {
    if (typeof propCount === 'number') {
      setCurrentCount(propCount);
      const shouldAlert = propCount > threshold;
      const shouldClear = propCount <= (threshold - OFF_MARGIN);
      if (shouldAlert && !prevAlertRef.current) {
        setAlert(true);
        playBeep();
        prevAlertRef.current = true;
      } else if (shouldClear && prevAlertRef.current) {
        setAlert(false);
        prevAlertRef.current = false;
      }
    }
  }, [propCount, threshold]);

  // Fallback: if parent doesn't provide count prop, listen to socket
  useEffect(() => {
    if (typeof propCount === 'number') return undefined;
    const handler = data => {
      const c = data?.count ?? 0;
      setCurrentCount(c);
      const shouldAlert = c > threshold;
      const shouldClear = c <= (threshold - OFF_MARGIN);
      if (shouldAlert && !prevAlertRef.current) {
        setAlert(true);
        playBeep();
        prevAlertRef.current = true;
      } else if (shouldClear && prevAlertRef.current) {
        setAlert(false);
        prevAlertRef.current = false;
      }
    };

    socket.on('crowd_update', handler);
    return () => socket.off('crowd_update', handler);
  }, [propCount, threshold]);

  return (
    <div style={{ marginTop: '30px', textAlign: 'center' }}>
      {alert ? (
        <div style={{
          background: 'linear-gradient(90deg,#ff4d4d,#ff1c1c)',
          color: 'white',
          padding: '14px 26px',
          borderRadius: '12px',
          fontSize: '1.35rem',
          fontWeight: 700,
          boxShadow: '0 0 18px rgba(255,77,77,0.6)',
          transform: 'translateY(0)',
          transition: 'transform 160ms ease'
        }}>
          ⚠️ Overcrowding Detected — Current Count: {currentCount}
        </div>
      ) : (
        <div style={{
          backgroundColor: '#0b5f3a',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '10px',
          fontSize: '1.1rem',
          fontWeight: 600,
          display: 'inline-block',
          boxShadow: '0 0 10px rgba(0,255,150,0.12)'
        }}>
          ✅ Safe — Current Count: {currentCount}
        </div>
      )}
    </div>
  );
}

export default AlertBox;
