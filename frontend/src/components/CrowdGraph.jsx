import { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

function CrowdGraph({ data: propData }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    // Only poll the backend when parent doesn't provide live data via props
    if (propData && propData.length) return;

    let mounted = true;
    const fetchCounts = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/recent_counts');
        if (!mounted) return;
        setData(Array.isArray(res.data) ? res.data.slice().reverse() : []); // oldest to latest
      } catch (e) {
        // ignore errors while backend may be down
      }
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 5000); // refresh every 5 sec
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [propData]);

  const displayed = propData && propData.length ? propData : data;

  return (
    <div style={{ marginTop: '40px' }}>
      <h2 style={{ fontSize: '1.8rem', marginBottom: '15px' }}>📈 Historical People Count</h2>
      <LineChart
        width={800}
        height={300}
        data={displayed}
        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="timestamp" label={{ value: 'Time', position: 'insideBottomRight', offset: -5 }} />
        <YAxis label={{ value: 'People', angle: -90, position: 'insideLeft' }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="count" stroke="#00ff88" activeDot={{ r: 8 }} />
      </LineChart>
    </div>
  );
}

export default CrowdGraph;
