import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { GlassCard } from '@/components/ui/GlassCard';

interface TrendDataItem {
  name: string;
  [key: string]: string | number;
}

interface TrendChartProps {
  data: TrendDataItem[];
  lines: { dataKey: string; color: string; name: string }[];
  title?: string;
  gradientId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 backdrop-blur-xl">
      <p className="mb-1 text-xs text-white/60">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export function TrendChart({ data, lines, title, gradientId = 'trendGradient' }: TrendChartProps) {
  return (
    <GlassCard className="p-5" glow>
      {title && <h3 className="mb-4 text-sm font-medium text-white/70">{title}</h3>}
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            {lines.map((line, i) => (
              <linearGradient
                key={i}
                id={`${gradientId}_${i}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={line.color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={line.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={false} />
          <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          {lines.map((line, i) => (
            <Area
              key={i}
              type="monotone"
              dataKey={line.dataKey}
              name={line.name}
              stroke={line.color}
              fill={`url(#${gradientId}_${i})`}
              strokeWidth={2}
              isAnimationActive
              animationDuration={800}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </GlassCard>
  );
}
