import { useEffect, useState } from 'react';
import socket from '../socket';

function StampedeAlert() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    // Listen for stampede alerts
    socket.on('stampede_alert', (alert) => {
      const newAlert = {
        ...alert,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now()
      };

      setAlerts((prev) => [newAlert, ...prev].slice(0, 5)); // Keep last 5

      // Browser notification
      if (Notification.permission === 'granted') {
        new Notification('🚨 Stampede Alert!', {
          body: alert.message,
          icon: '🚨'
        });
      }
    });

    // Request notification permission on mount
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      socket.off('stampede_alert');
    };
  }, []);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return '#ff1c1c';
      case 'high':
        return '#ff8c00';
      case 'medium':
        return '#ffd700';
      default:
        return '#00d26a';
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'panic_movement':
        return '😱';
      case 'potential_stampede':
        return '🏃‍♂️💨';
      case 'critical_density':
        return '🔴';
      case 'sudden_dispersal':
        return '💥';
      default:
        return '⚠️';
    }
  };

  return (
    <div
      style={{
        background: '#1A1A1A',
        border: '2px solid #ff1c1c',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 0 30px rgba(255, 28, 28, 0.4)'
      }}
    >
      <h3
        style={{
          fontSize: '1.5rem',
          color: '#ff1c1c',
          marginBottom: '15px',
          textAlign: 'center'
        }}
      >
        🚨 Stampede Detection
      </h3>

      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {alerts.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: '#00d26a',
              padding: '30px 10px',
              fontSize: '1.1rem'
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>✅</div>
            <div>No stampede alerts</div>
            <div style={{ fontSize: '0.9rem', color: '#888', marginTop: '5px' }}>
              System monitoring for dangerous patterns
            </div>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              style={{
                background: `${getSeverityColor(alert.severity)}22`,
                borderLeft: `4px solid ${getSeverityColor(alert.severity)}`,
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '12px',
                animation: 'slideIn 0.3s ease-out'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'start', gap: '10px' }}>
                <span style={{ fontSize: '2rem' }}>{getAlertIcon(alert.type)}</span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 'bold',
                      color: 'white',
                      fontSize: '1rem',
                      marginBottom: '5px',
                      textTransform: 'uppercase'
                    }}
                  >
                    {alert.type.replace(/_/g, ' ')}
                  </div>
                  <div
                    style={{
                      color: '#DDD',
                      fontSize: '0.9rem',
                      marginBottom: '8px'
                    }}
                  >
                    {alert.message}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                      color: '#AAA'
                    }}
                  >
                    <span>⏰ {alert.timestamp}</span>
                    <span>👥 Count: {alert.count}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}

export default StampedeAlert;