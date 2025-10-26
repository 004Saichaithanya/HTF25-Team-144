import { useEffect, useState, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function CrowdGraph({ count }) {
  const [data, setData] = useState([]);
  const containerRef = useRef(null);

  // Update data when count changes
  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString();
    setData(prevData => {
      const newData = [...prevData, { timestamp, count }];
      // Keep only last 20 data points
      return newData.slice(-20);
    });
  }, [count]);

  // Fetch initial historical data
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/recent_counts');
        const historicalData = await res.json();
        console.log(historicalData);
        
        if (Array.isArray(historicalData)) {
          setData(historicalData);
        }
      } catch (error) {
        console.error('Error fetching historical data:', error);
      }
    };

    fetchCounts();
  }, []);

  return (
    <div style={{ marginTop: '20px' }} ref={containerRef}>
      <h2 style={{ fontSize: '1.4rem', marginBottom: '15px', color: '#9fb8c9' }}>📈 Historical People Count</h2>
      <div style={{ width: '100%', height: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="timestamp"
              stroke="#9fb8c9"
              tick={{ fill: '#9fb8c9' }}
            />
            <YAxis 
              stroke="#9fb8c9"
              tick={{ fill: '#9fb8c9' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#0d1b2a',
                border: '1px solid #1f6feb',
                borderRadius: '4px'
              }}
              labelStyle={{ color: '#9fb8c9' }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="count" 
              name="People Count"
              stroke="#1f6feb" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: '#1f6feb' }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default CrowdGraph;
