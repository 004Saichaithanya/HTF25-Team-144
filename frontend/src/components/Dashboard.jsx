import { useEffect, useState } from 'react';
import socket from '../socket';
import AlertBox from './AlertBox';
import CrowdGraph from './CrowdGraph';
import StampedeAlert from './StampedeAlert';
import '../styles/Dashboard.css';

function AnimatedCount({ value }) {
  const [displayValue, setDisplayValue] = useState(value || 0);

  useEffect(() => {
    const start = displayValue;
    const end = value || 0;
    const frames = 12;
    let frame = 0;
    const id = setInterval(() => {
      frame++;
      const progress = frame / frames;
      const val = Math.round(start + (end - start) * progress);
      setDisplayValue(val);
      if (frame >= frames) clearInterval(id);
    }, 20);
    return () => clearInterval(id);
  }, [value]);

  return <span className="stat-value">{displayValue}</span>;
}

export default function Dashboard() {
  const [count, setCount] = useState(0);
  const [avgDensity, setAvgDensity] = useState(0);
  const [avgVelocity, setAvgVelocity] = useState(0);
  const [alerts, setAlerts] = useState(0);
  const [stampede, setStampede] = useState(false);
  const [uploadedVideo, setUploadedVideo] = useState(null);
  const [previewURL, setPreviewURL] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [threshold, setThreshold] = useState(25);
  const [connected, setConnected] = useState(false);

  // Socket connection monitoring
  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  // Send threshold update to backend
  const updateThreshold = async (val) => {
    try {
      await fetch('http://localhost:5000/api/set_threshold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: Number(val) }),
      });
    } catch (err) {
      console.error('Failed to update threshold on server', err);
    }
  };

  // Fetch normal alerts (non-stampede)
  useEffect(() => {
    async function fetchAlerts() {
      try {
        const res = await fetch("http://localhost:5000/api/recent_alerts");
        const data = await res.json();
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const stampedeTypes = ['panic_movement','stampede_risk','critical_density','crowd_surge'];
        const activeAlerts = data.filter(alert => new Date(alert.timestamp) > fiveMinutesAgo && !stampedeTypes.includes(alert.type));
        setAlerts(activeAlerts.length);

        const stampedeAlert = data.some(alert => stampedeTypes.includes(alert.type));
        setStampede(stampedeAlert);
      } catch (err) {
        console.error(err);
      }
    }
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 2000);
    return () => clearInterval(interval);
  }, []);

  // Listen for crowd updates
  useEffect(() => {
    const handler = (data) => {
      if (data && typeof data.count === 'number') {
        setCount(data.count);
        setAvgDensity((data.count / 100).toFixed(2));
        if (data.velocity !== undefined) setAvgVelocity(Number(data.velocity));
      }
    };
    socket.on('crowd_update', handler);
    return () => socket.off('crowd_update', handler);
  }, []);

  // Listen for stampede alerts directly from the server and update header state
  useEffect(() => {
    const onStampede = (alert) => {
      // mark stampede active and increment an alerts counter
      setStampede(true);
      setAlerts((prev) => prev + 1);

      // auto-clear stampede after 20s unless new alerts arrive
      setTimeout(() => {
        setStampede(false);
      }, 20000);
    };

    socket.on('stampede_alert', onStampede);
    return () => socket.off('stampede_alert', onStampede);
  }, []);

  // Local velocity-based stampede detection (supplement server-side alerts)
  const velocityThreshold = 30; // mirror backend
  const panicVelocityThreshold = 60;
  useEffect(() => {
    if (avgVelocity > panicVelocityThreshold) {
      setStampede(true);
    } else if (avgVelocity > velocityThreshold && count > threshold) {
      setStampede(true);
    } else {
      // only clear stampede when velocity is below thresholds
      setStampede(false);
    }
  }, [avgVelocity, count, threshold]);

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

  // Meter sub-component (kept inside file for simplicity)
  function MeterSVG({ count, threshold }) {
    // Define a working scale where 0..(threshold*2) maps to -120deg..+120deg
    const maxScale = Math.max(1, threshold * 2);
    const pct = Math.min(1, count / maxScale);
    const angle = -120 + pct * 240; // -120..+120

    // Determine status and color (match earlier levels)
    let status = 'Safe';
    let color = '#10b981'; // green
    if (count > threshold * 1.5) {
      status = 'Critical';
      color = '#ef4444';
    } else if (count > threshold) {
      status = 'Caution';
      color = '#f59e0b';
    }

    // ticks to render along the arc (0..1)
    const ticks = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];

    return (
      <div className="meter" style={{ '--meter-color': color, '--needle-angle': `${angle}deg`, '--active-deg': `${pct * 240}deg` }}>
        <div className="dial">
          <div className="dial-bg" aria-hidden="true"></div>
          <div className="dial-active" aria-hidden="true"></div>
          {/* ticks */}
          {ticks.map((t, i) => {
            const a = -120 + t * 240;
            return <div className="tick" key={i} style={{ transform: `rotate(${a}deg)` }} />;
          })}
          {/* Needle */}
          <div
            className="needle"
            style={{ transform: `rotate(${angle}deg)` }}
            aria-hidden="true"
          >
            <div className="needle-core"></div>
          </div>
          {/* center cap */}
          <div className="cap" style={{ background: color }}></div>
        </div>

        <div className="meter-labels">
          <div className="meter-count">{count}</div>
          <div className="meter-status" style={{ color }}>{status}</div>
          <div className="meter-scale-labels">
            <span>0</span>
            <span>{threshold}</span>
            <span>{Math.round(maxScale)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper">
      {/* Animated Background Orbs */}
      <div className="background-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
        <div className="orb orb-4"></div>
      </div>

      {/* Grid Pattern Overlay */}
      <div className="grid-pattern"></div>

      {/* Critical Stampede Banner */}
      {stampede && (
        <div className="stampede-banner">
          <span>⚠️ CRITICAL STAMPEDE ALERT DETECTED ⚠️</span>
        </div>
      )}

      <div className="dashboard-container">
        {/* Futuristic Header */}
        <div className="dashboard-header">
          <div className="header-glow"></div>
          <div className="header-content">
            <div className="brand-section">
              <div className="brand-icon-wrapper">
                <div className="brand-icon-glow"></div>
                <div className="brand-icon">
                  <svg className="icon" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                  </svg>
                </div>
              </div>
              <div className="brand-info">
                <h1 className="brand-title">CrowdGuard CSIS</h1>
                <div className="connection-status">
                  <div className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></div>
                  <span className={`status-text ${connected ? 'connected' : 'disconnected'}`}>
                    {connected ? 'System Online' : 'System Offline'}
                  </span>
                </div>
              </div>
            </div>

            {/* Alert Meter (speedometer-like) placed centered in header */}
            <div className="alert-meter" role="img" aria-label={`Alert meter showing ${count} people`}>
              {/* compute percentage and needle rotation in-line using current count/threshold */}
              {/** The needle rotation is controlled by inline style using computed angle below */}
              <MeterSVG count={count} threshold={threshold} />
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
              <div className="stat-card stat-cyan">
                <div className="stat-glow"></div>
                <div className="stat-content">
                  <div className="stat-label">Live Count</div>
                  <div className="stat-value">
                    <AnimatedCount value={count} />
                  </div>
                </div>
              </div>

              <div className="stat-card stat-purple">
                <div className="stat-glow"></div>
                <div className="stat-content">
                  <div className="stat-label">Density</div>
                  <div className="stat-value">{avgDensity}</div>
                </div>
              </div>

              <div className="stat-card stat-blue">
                <div className="stat-glow"></div>
                <div className="stat-content">
                  <div className="stat-label">Avg Velocity</div>
                  <div className="stat-value">{Number(avgVelocity).toFixed(1)}</div>
                </div>
              </div>

              <div className="stat-card stat-orange">
                <div className="stat-glow"></div>
                <div className="stat-content">
                  <div className="stat-label">Active Alerts</div>
                  <div className="stat-value">{alerts}</div>
                </div>
              </div>

              <div className="stat-card stat-emerald">
                <div className="stat-glow"></div>
                <div className="stat-content">
                  <div className="stat-label">Threshold</div>
                  <input 
                    type="range" 
                    min="1" 
                    max="200" 
                    value={threshold}
                    onChange={(e) => { const v = Number(e.target.value); setThreshold(v); updateThreshold(v); }}
                    className="threshold-slider"
                    style={{
                      background: `linear-gradient(to right, #10b981 0%, #14b8a6 ${(threshold/200)*100}%, #1e3a3a ${(threshold/200)*100}%, #1e3a3a 100%)`
                    }}
                  />
                  <div className="stat-value">{threshold}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="main-grid">
          {/* Left Column - Video Feed */}
          <div className="left-column">
            <div className="card video-card">
              <div className="card-glow card-glow-multi"></div>
              <div className="card-content">
                <div className="card-header">
                  <h3 className="card-title">📹 Live Surveillance Feed</h3>
                  <div className="live-badge">
                    <div className="live-dot"></div>
                    <span className="live-text">LIVE</span>
                  </div>
                </div>

                <form onSubmit={handleUpload} className="upload-form">
                  <input 
                    type="file" 
                    name="video"
                    accept="video/*"
                    required
                    className="file-input"
                  />
                  <button type="submit" className="upload-button">
                    Upload
                  </button>
                </form>

                <div className="video-container">
                  <img 
                    src="http://localhost:5000/video_feed" 
                    alt="Live Feed"
                    className="video-feed"
                  />
                  <div className="video-overlay"></div>
                  <div className="video-badge">REAL-TIME ANALYSIS</div>
                  <div className="scan-line"></div>
                </div>

                {previewURL && <video src={previewURL} controls className="uploaded-video" />}
                {uploadedVideo && !previewURL && <video src={`http://localhost:5000/uploads/${encodeURIComponent(uploadedVideo)}`} controls className="uploaded-video" autoPlay />}
              </div>
            </div>

            <div className="card analytics-card">
              <div className="card-glow card-glow-cyan"></div>
              <div className="card-content">
                <h3 className="card-title">📊 Real-Time Analytics</h3>
                <CrowdGraph count={count} />
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="right-column">
            <div className="card alerts-card">
              <div className="card-glow card-glow-orange"></div>
              <div className="card-content">
                <div className="card-header-icon">
                  <div className="icon-badge icon-badge-orange">
                    <svg className="icon" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L1 21h22L12 2zm0 4l7.5 13h-15L12 6zm-1 5h2v4h-2v-4zm0 5h2v2h-2v-2z"/>
                    </svg>
                  </div>
                  <h3 className="card-title">Live Alerts</h3>
                </div>
                <AlertBox threshold={threshold} currentCount={count} />
              </div>
            </div>

            <div className="card stampede-card">
              <div className="card-glow card-glow-pink"></div>
              <div className="card-content">
                <div className="card-header-icon">
                  <div className="icon-badge icon-badge-pink">
                    <svg className="icon" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M13 10h-2V8h2v2zm0 2h-2v6h2v-6zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                    </svg>
                  </div>
                  <h3 className="card-title">Stampede AI</h3>
                </div>
                <StampedeAlert />
              </div>
            </div>

            <div className="card status-card">
              <div className="card-glow card-glow-cyan"></div>
              <div className="card-content">
                <h3 className="card-title card-title-small">System Status</h3>
                <div className="status-list">
                  <div className="status-item">
                    <span className="status-item-label">Camera Status</span>
                    <span className="status-item-value status-active">● Active</span>
                  </div>
                  <div className="status-item">
                    <span className="status-item-label">AI Processing</span>
                    <span className="status-item-value status-active">● Online</span>
                  </div>
                  <div className="status-item">
                    <span className="status-item-label">Alert System</span>
                    <span className="status-item-value status-active">● Ready</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}