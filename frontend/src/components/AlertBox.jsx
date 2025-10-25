import { useEffect, useState } from 'react';
import socket from '../socket';

function AlertBox({ threshold }) {
  const [currentCount, setCurrentCount] = useState(0);
  const [alert, setAlert] = useState(false);

  useEffect(() => {
    socket.on('crowd_update', (data) => {
      setCurrentCount(data.count);
      setAlert(data.count > threshold);
    });

    return () => {
      socket.off('crowd_update');
    };
  }, [threshold]);

  return (
    <div style={{ marginTop: '30px', textAlign: 'center' }}>
      {alert ? (
        <div style={{
          backgroundColor: '#ff1c1c',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '10px',
          fontSize: '1.4rem',
          fontWeight: '600',
          boxShadow: '0 0 15px #ff4d4d',
          animation: 'pulse 1s infinite alternate'
        }}>
          ⚠️ Overcrowding Detected! Current Count: {currentCount}
        </div>
      ) : (
        <div style={{
          backgroundColor: '#00d26a',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '8px',
          fontSize: '1.2rem',
          fontWeight: '500',
          display: 'inline-block',
          boxShadow: '0 0 8px #00ff99'
        }}>
          ✅ Safe: Current Count {currentCount}
        </div>
      )}
    </div>
  );
}

export default AlertBox;
