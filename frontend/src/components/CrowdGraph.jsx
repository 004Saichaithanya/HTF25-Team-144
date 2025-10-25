import { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

function CrowdGraph() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchCounts = async () => {
      const res = await axios.get('http://localhost:5000/api/recent_counts');
      setData(res.data.reverse()); // oldest to latest
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 5000); // refresh every 5 sec

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ marginTop: '40px' }}>
      <h2 style={{ fontSize: '1.8rem', marginBottom: '15px' }}>📈 Historical People Count</h2>
      <LineChart
        width={800}
        height={300}
        data={data}
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
