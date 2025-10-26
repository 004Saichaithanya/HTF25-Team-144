import { useEffect, useState } from 'react';
import socket from '../socket';
import AlertBox from './AlertBox';
import CrowdGraph from './CrowdGraph';
import StampedeAlert from './StampedeAlert';

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
  const [alerts, setAlerts] = useState(0);
  const [stampede, setStampede] = useState(false); // For critical stampede
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
        const activeAlerts = data.filter(alert => new Date(alert.timestamp) > fiveMinutesAgo && alert.type !== 'stampede');
        setAlerts(activeAlerts.length);

        // Check for stampede alerts
        const stampedeAlert = data.some(alert => alert.type === 'stampede');
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
        setAvgDensity((data.count / 100).toFixed(2)); // Assuming 100 sq meters
      }
    };
    socket.on('crowd_update', handler);
    return () => socket.off('crowd_update', handler);
  }, []);

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
    <div style={{ minHeight: '100vh', padding: 20, background: '#0b0f17', color: '#eee', fontFamily: 'Segoe UI, sans-serif' }}>
      
      {/* Critical Stampede Banner */}
      {stampede && (
        <div style={{
          width: '100%',
          background: '#ff1c1c',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: '1.2rem',
          textAlign: 'center',
          padding: 12,
          borderRadius: 6,
          marginBottom: 16,
          animation: 'blink 1s infinite'
        }}>
          ⚠️ CRITICAL STAMPEDE ALERT! ⚠️
        </div>
      )}

      <style>{`
        @keyframes blink {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>

      {/* Top bar */}
      <div className="topbar card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, padding: '10px 16px', background: '#11151f', borderRadius: 10, boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
        <div className="brand" style={{ fontWeight: 'bold', fontSize: '1.3rem' }}>
          🧭 CrowdGuard CSIS 
          <span style={{ fontSize: '0.8em', color: connected ? '#4caf50' : '#ff5252', marginLeft: 8 }}>
            {connected ? '● Connected' : '● Disconnected'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="stat-box card" style={{ textAlign: 'center', padding: '8px 12px', borderRadius: 8, background: '#141b26' }}>
            <div className="stat-label" style={{ fontSize: '0.8rem', color: '#9fb8c9' }}>Live People</div>
            <AnimatedCount value={count} />
          </div>
          <div className="stat-box card" style={{ textAlign: 'center', padding: '8px 12px', borderRadius: 8, background: '#141b26' }}>
            <div className="stat-label" style={{ fontSize: '0.8rem', color: '#9fb8c9' }}>Avg Density</div>
            <div className="stat-value">{avgDensity}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: '0.75em', color: '#9fb8c9' }}>Threshold</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="range" min={1} max={200} value={threshold} onChange={(e) => { const v = Number(e.target.value); setThreshold(v); updateThreshold(v); }} />
              <div style={{ minWidth: 36, textAlign: 'center', color: '#9fb8c9' }}>{threshold}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Rest of dashboard remains the same */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card" style={{ padding: 16, borderRadius: 12, background: '#11151f', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
            <h3 style={{ margin: 0, marginBottom: 12 }}>📹 Live Feed</h3>

            <form onSubmit={handleUpload} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <input type="file" name="video" accept="video/*" required style={{ flex: 1 }} />
              <button type="submit" style={{ background: '#1f6feb', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer' }}>Upload</button>
            </form>

            <div style={{ position: 'relative' }}>
              <img src="http://localhost:5000/video_feed" alt="Live" style={{ width: '100%', borderRadius: 10, border: '2px solid #1f6feb', boxShadow: '0 0 15px rgba(31,111,235,0.3)' }} />
              <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(31,111,235,0.9)', padding: '4px 8px', borderRadius: 4, fontSize: '0.85em', color: 'white' }}>LIVE</div>
            </div>

            {previewURL && <video src={previewURL} controls width="100%" style={{ marginTop: 16, borderRadius: 10 }} />}
            {uploadedVideo && !previewURL && <video src={`http://localhost:5000/uploads/${encodeURIComponent(uploadedVideo)}`} controls width="100%" style={{ marginTop: 16, borderRadius: 10 }} autoPlay />}
          </div>

          <div className="card" style={{ padding: 16, borderRadius: 12, background: '#11151f', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
            <CrowdGraph count={count} />
          </div>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card" style={{ padding: 16, borderRadius: 12, background: '#11151f', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
            <h4 style={{ marginTop: 0 }}>Live Alerts</h4>
            <AlertBox threshold={threshold} currentCount={count} />
          </div>
          <div className="card" style={{ padding: 16, borderRadius: 12, background: '#11151f', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
            <h4 style={{ marginTop: 0 }}>🏃 Stampede Detection</h4>
            <StampedeAlert />
          </div>
        </aside>
      </div>
    </div>
  );
}
