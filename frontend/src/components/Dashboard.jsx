import { useEffect, useState, useRef } from 'react';
import socket from '../socket';
import AlertBox from './AlertBox';
import CrowdGraph from './CrowdGraph';
import StampedeAlert from './StampedeAlert';
import '../styles/Dashboard.css';

function AnimatedCount({ value }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const duration = 300;
    const steps = 10;
    const increment = (value - displayValue) / steps;
    let frame = 0;

    const timer = setInterval(() => {
      setDisplayValue(prev => prev + increment);
      frame++;
      if (frame >= steps) {
        setDisplayValue(value);
        clearInterval(timer);
      }
    }, duration / steps);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span>{Math.round(displayValue)}</span>;
}

function Dashboard() {
  const [count, setCount] = useState(0);
  const [threshold, setThreshold] = useState(15);
  const [file, setFile] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [showServerFeed, setShowServerFeed] = useState(false);
  const thresholdRef = useRef(threshold);

  useEffect(() => {
    // live socket updates
    const handler = data => {
      if (!data) return;
      const value = typeof data.count === 'number' ? data.count : 0;
      setCount(value);
      setChartData(prev => {
        const next = [...prev, { timestamp: new Date().toLocaleTimeString(), count: value }];
        // keep last 120 points to avoid unlimited growth
        return next.slice(-120);
      });
    };

    socket.on('crowd_update', handler);
    return () => socket.off('crowd_update', handler);
  }, []);

  // Create an object URL to preview/play the selected video locally
  const [localVideoUrl, setLocalVideoUrl] = useState(null);
  const [serverFeedUrl, setServerFeedUrl] = useState('http://localhost:5000/video_feed');
  useEffect(() => {
    if (!file) {
      setLocalVideoUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalVideoUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setLocalVideoUrl(null);
    };
  }, [file]);

  const handleDrop = e => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer?.files?.[0];
    if (f) setFile(f);
  };

  const handleFileSelect = e => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    const file = e.target.elements.video.files[0];
    if (!file) return alert("Please select a video file.");
    const localURL = URL.createObjectURL(file);
    setPreviewURL(localURL);

    const formData = new FormData();
    formData.append("file", file);

    try {
      setCount(0);
      setAvgDensity(0);
      setAlerts(0);
      setStampede(false);
      setIsMonitoring(false);

      const res = await fetch("http://localhost:5000/upload_media", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.filename) {
        setUploadedVideo(data.filename);
        setIsMonitoring(true);
      }
    } catch (err) {
      console.error(err);
      alert("Upload failed.");
    }
  };

  return (
    <div
      style={{
        background: '#0F0F0F',
        minHeight: '100vh',
        padding: '30px',
        color: '#EEE',
        fontFamily: 'Segoe UI, sans-serif',
      }}
    >
      <header
        style={{
          textAlign: 'center',
          fontSize: '3.5rem',
          fontWeight: 'bold',
          color: '#00F0FF',
          textShadow: '0 0 20px #00F0FF',
        }}
      >
        🧑‍🤝‍🧑 CrowdGuard Dashboard
      </header>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '30px',
          justifyContent: 'center',
          alignItems: 'flex-start',
          marginTop: '30px',
        }}
      >
        {/* Left Panel */}
        <div style={{ flex: '0 1 420px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              background: '#1A1A1A',
              border: '2px solid #00F0FF',
              borderRadius: '16px',
              padding: '40px 20px',
              textAlign: 'center',
              boxShadow: '0 0 30px rgba(0, 255, 255, 0.4)',
            }}
          >
            <div style={{ fontSize: '4rem', marginBottom: '12px' }}>
              <AnimatedCount value={count} /> 👥
            </div>
            <div style={{ fontSize: '1.2rem', color: '#CCC' }}>Live Detected People</div>
          </div>

          <AlertBox count={count} threshold={Number(threshold)} />

          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            style={{
              border: '2px dashed #00F0FF',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: '#111',
            }}
            aria-label="video-dropzone"
          >
            <p style={{ marginBottom: '10px' }}>{file ? `Selected: ${file.name}` : 'Drag & Drop Video Here'}</p>
            <input type="file" accept="video/*" onChange={handleFileSelect} style={{ marginBottom: '10px' }} />
            <br />
            <input
              type="number"
              value={threshold}
              onChange={e => {
                const v = e.target.value;
                setThreshold(v);
                thresholdRef.current = Number(v);
              }}
              placeholder="Threshold"
              style={{
                width: '100px',
                marginBottom: '10px',
                padding: '6px',
                borderRadius: '6px',
                border: '1px solid #00F0FF',
                background: '#0F0F0F',
                color: '#EEE',
              }}
            />
            <br />
            <button
              onClick={handleUpload}
              style={{
                padding: '10px 20px',
                background: '#00F0FF',
                border: 'none',
                borderRadius: '8px',
                color: '#000',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Upload & Start
            </button>
          </div>
        </div>

        {/* Right Panel: Live Video */}
        <div style={{ flex: '1 1 720px' }}>
          <h2 style={{ fontSize: '2rem', color: '#00F0FF', textShadow: '0 0 12px #00F0FF', marginBottom: '12px' }}>
            📹 Live Crowd Detection Video
          </h2>

          <div style={{ border: '3px solid #00F0FF', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 0 24px rgba(0,255,255,0.25)', background: '#000' }}>
            {showServerFeed ? (
              // show server processed feed (hashmap) after upload
              <img
                src={serverFeedUrl}
                alt="Processed Video Stream"
                style={{ width: '100%', height: 'auto', display: 'block', background: '#000' }}
              />
            ) : localVideoUrl ? (
              <video
                key={localVideoUrl}
                src={localVideoUrl}
                controls
                autoPlay
                muted
                loop
                style={{ width: '100%', height: 'auto', display: 'block', background: '#000' }}
              />
            ) : (
              <img
                src="http://localhost:5000/video_feed"
                alt="Live Video Stream"
                style={{ width: '100%', height: 'auto', display: 'block', background: '#000' }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Chart Panel */}
      <div style={{ marginTop: '30px' }}>
        <CrowdGraph data={chartData} />
      </div>
    </div>
  );
}

export default Dashboard;
