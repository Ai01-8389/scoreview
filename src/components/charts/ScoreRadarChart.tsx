import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from 'recharts';
import { GlassCard } from '@/components/ui/GlassCard';

interface RadarDataItem {
  subject: string;
  scoreRate: number;
  fullMark?: number;
}

interface ScoreRadarChartProps {
  data: RadarDataItem[];
  title?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 backdrop-blur-xl">
      <p className="text-xs text-white/60">{item.payload.subject}</p>
      <p className="text-sm font-bold text-cyan-400">{(item.value * 100).toFixed(1)}%</p>
    </div>
  );
}

export function ScoreRadarChart({ data, title }: ScoreRadarChartProps) {
  const chartData = data.map((d) => ({ ...d, fullMark: d.fullMark ?? 1 }));

  return (
    <GlassCard className="p-5" glow>
      {title && <h3 className="mb-4 text-sm font-medium text-white/70">{title}</h3>}
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="75%">
          <defs>
            <linearGradient id="radarFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <PolarGrid stroke="rgba(255,255,255,0.06)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 1]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="得分率"
            dataKey="scoreRate"
            stroke="#3B82F6"
            fill="url(#radarFill)"
            strokeWidth={2}
            isAnimationActive
            animationDuration={800}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </GlassCard>
  );
}
