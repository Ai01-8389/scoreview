import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';
import { GlassCard } from '@/components/ui/GlassCard';

interface BarDataItem {
  name: string;
  value: number;
  fill?: string;
}

interface GradientBarChartProps {
  data: BarDataItem[];
  title?: string;
  referenceLine?: number;
  referenceLabel?: string;
  layout?: 'horizontal' | 'vertical';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 backdrop-blur-xl">
      <p className="text-xs text-white/60">{item.payload.name}</p>
      <p className="text-sm font-bold text-cyan-400">{item.value}</p>
    </div>
  );
}

const COLORS = ['#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];

export function GradientBarChart({
  data,
  title,
  referenceLine,
  referenceLabel,
  layout = 'horizontal',
}: GradientBarChartProps) {
  return (
    <GlassCard className="p-5" glow>
      {title && <h3 className="mb-4 text-sm font-medium text-white/70">{title}</h3>}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout={layout === 'vertical' ? 'vertical' : 'horizontal'}>
          <defs>
            <linearGradient id="barGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
            <linearGradient id="barGradientV" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          {layout === 'vertical' ? (
            <>
              <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={false} width={60} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={false} />
            </>
          )}
          <Tooltip content={<CustomTooltip />} />
          {referenceLine !== undefined && (
            <ReferenceLine
              {...(layout === 'vertical'
                ? { x: referenceLine }
                : { y: referenceLine })}
              stroke="#F59E0B"
              strokeDasharray="5 5"
              label={referenceLabel ? { value: referenceLabel, fill: '#F59E0B', fontSize: 12 } : undefined}
            />
          )}
          <Bar
            dataKey="value"
            fill={layout === 'vertical' ? 'url(#barGradientV)' : 'url(#barGradient)'}
            radius={layout === 'vertical' ? [0, 6, 6, 0] : [6, 6, 0, 0]}
            isAnimationActive
            animationDuration={800}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </GlassCard>
  );
}
