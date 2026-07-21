import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { formatBytes } from '../lib/format';

const COLORS = ['url(#goldGrad)', 'rgba(255,255,255,0.08)'];

export default function DonutChart({ used, free }) {
  const data = [
    { name: 'Used', value: used },
    { name: 'Free', value: free },
  ];
  const total = used + free;

  return (
    <div style={{ position: 'relative', width: 200, height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f4e2a6" />
              <stop offset="100%" stopColor="#a9821f" />
            </linearGradient>
          </defs>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={70}
            outerRadius={92}
            paddingAngle={2}
            startAngle={90}
            endAngle={-270}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 21, fontWeight: 700 }}>{formatBytes(used)}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>
          of {formatBytes(total)} used
        </div>
      </div>
    </div>
  );
}
