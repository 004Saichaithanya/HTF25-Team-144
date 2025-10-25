import { useEffect, useState } from 'react';
import socket from '../socket';
import AlertBox from './AlertBox';
import CrowdGraph from './CrowdGraph';

// Smooth animated counter
function AnimatedCount({ value }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const duration = 300;
    const increment = (value - displayValue) / 10;
    let frame = 0;

    const counter = setInterval(() => {
      setDisplayValue((prev) => prev + increment);
      frame++;
      if (frame >= 10) {
        setDisplayValue(value);
        clearInterval(counter);
      }
    }, duration / 10);

    return () => clearInterval(counter);
  }, [value]);

  return <span>{Math.round(displayValue)}</span>;
}

function Dashboard() {
  const [count, setCount] = useState(0);
  const threshold = 15;

  useEffect(() => {
    socket.on('crowd_update', (data) => {
      setCount(data.count);
    });

    return () => {
      socket.off('crowd_update');
    };
  }, []);

  return (
    <div
      style={{
        background: '#0F0F0F',
        minHeight: '100vh',
        padding: '30px',
        color: '#EEE',
        fontFamily: 'Segoe UI, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: '30px'
      }}
    >
      {/* Header */}
      <header
        style={{
          textAlign: 'center',
          fontSize: '3.5rem',
          fontWeight: 'bold',
          color: '#00F0FF',
          textShadow: '0 0 20px #00F0FF'
        }}
      >
        🧑‍🤝‍🧑 CrowdGuard Dashboard
      </header>

      {/* Main Content */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '30px',
          justifyContent: 'center',
          alignItems: 'flex-start'
        }}
      >
        {/* Left: Stats + Alert */}
        <div style={{ flex: '0 1 350px' }}>
          {/* People Counter */}
          <div
            style={{
              background: '#1A1A1A',
              border: '2px solid #00F0FF',
              borderRadius: '16px',
              padding: '40px 20px',
              textAlign: 'center',
              boxShadow: '0 0 30px rgba(0, 255, 255, 0.4)'
            }}
          >
            <div style={{ fontSize: '4rem', marginBottom: '12px' }}>
              <AnimatedCount value={count} /> 👥
            </div>
            <div style={{ fontSize: '1.2rem', color: '#CCC' }}>
              Live Detected People
            </div>
          </div>

          {/* AlertBox */}
          <div style={{ marginTop: '20px' }}>
            <AlertBox count={count} threshold={threshold} />
          </div>
        </div>

        {/* Right: Video Feed */}
        <div style={{ flex: '1 1 750px' }}>
          <h2
            style={{
              fontSize: '2rem',
              color: '#00F0FF',
              textShadow: '0 0 12px #00F0FF',
              marginBottom: '12px'
            }}
          >
            📹 Live Crowd Detection Video
          </h2>
          <img
            src="http://localhost:5000/video_feed"
            alt="Live Video Stream"
            style={{
              border: '3px solid #00F0FF',
              borderRadius: '12px',
              width: '100%',
              height: 'auto',
              boxShadow: '0 0 24px rgba(0, 255, 255, 0.3)'
            }}
          />
        </div>
      </div>

      {/* Graph */}
      <div style={{ marginTop: '30px' }}>
        <CrowdGraph />
      </div>
    </div>
  );
}

export default Dashboard;
