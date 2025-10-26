import { useEffect, useState } from 'react';
import socket from '../socket';

function AlertBox({ threshold }) {
  const [currentCount, setCurrentCount] = useState(0);
  const [risk, setRisk] = useState({ color: '#00d26a', text: '✅ Safe', level: 'SAFE' });
  const [recentAlerts, setRecentAlerts] = useState([]);

  useEffect(() => {
    socket.on('crowd_update', (data) => {
      setCurrentCount(data.count);
      updateRiskLevel(data.count);
    });

    socket.on('alert_event', (alertData) => {
      const newAlert = {
        ...alertData,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now()
      };
      setRecentAlerts((prev) => [newAlert, ...prev].slice(0, 3));
    });

    return () => {
      socket.off('crowd_update');
      socket.off('alert_event');
    };
  }, [threshold]);

  // 🧠 Function to set risk level based on crowd count
  const updateRiskLevel = (count) => {
    if (count > threshold * 2) {
      setRisk({
        color: '#ff1c1c',
        text: '🚨 Critical Overcrowding',
        level: 'CRITICAL'
      });
    } else if (count > threshold * 1.5) {
      setRisk({
        color: '#ff8c00',
        text: '⚠️ High Density',
        level: 'HIGH'
      });
    } else if (count > threshold) {
      setRisk({
        color: '#ffd700',
        text: '⚡ Slightly Crowded',
        level: 'MEDIUM'
      });
    } else {
      setRisk({
        color: '#00d26a',
        text: '✅ Safe',
        level: 'SAFE'
      });
    }
  };

  return (
    <div>
      {/* Main Alert Box */}
      <div
        style={{
          backgroundColor: risk.color,
          color: 'white',
          padding: '14px 28px',
          borderRadius: '12px',
          fontSize: '1.5rem',
          fontWeight: 'bold',
          textAlign: 'center',
          boxShadow: `0 0 20px ${risk.color}`,
          animation: risk.level === 'CRITICAL' ? 'pulse 1s infinite alternate' : 'none'
        }}
      >
        {risk.text} — Current Count: {currentCount}
      </div>

      {/* Recent Alerts */}
      {recentAlerts.length > 0 && (
        <div
          style={{
            marginTop: '20px',
            background: '#1A1A1A',
            border: '1px solid #444',
            borderRadius: '10px',
            padding: '15px'
          }}
        >
          <div
            style={{
              fontSize: '1rem',
              color: '#ff8c00',
              fontWeight: 'bold',
              marginBottom: '10px'
            }}
          >
            📋 Recent Alerts
          </div>

          {recentAlerts.map((alertItem) => (
            <div
              key={alertItem.id}
              style={{
                background: '#252525',
                padding: '10px',
                borderRadius: '6px',
                marginBottom: '8px',
                borderLeft: '3px solid #ff8c00'
              }}
            >
              <div style={{ fontSize: '0.9rem', color: '#FFF', fontWeight: '500' }}>
                {alertItem.type === 'crowd_surge' && '📈 Crowd Surge'}
                {alertItem.type === 'crowd_threshold_exceeded' && '⚠️ Threshold Exceeded'}
              </div>
              <div
                style={{
                  fontSize: '0.8rem',
                  color: '#AAA',
                  marginTop: '4px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}
              >
                <span>Count: {alertItem.count}</span>
                <span>{alertItem.timestamp}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Animation CSS */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export default AlertBox;