import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeftRight,
  Award,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ReferenceLine,
  Cell,
} from 'recharts';
import { useStore } from '@/store/useStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { getSubjectName } from '@/shared/subjects';
import { isSecondarySubject } from '@/shared/assignmentScore';
import { calculateExamAssignedScores, getEffectiveScore, getEffectiveTotalScore } from '@/utils/scoreCalc';
import type { Exam } from '@/shared/types';

const COLORS = ['#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

function getTotalScore(exam: Exam) {
  return getEffectiveTotalScore(exam);
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

function estimateRank(totalScore: number): number {
  if (totalScore >= 700) return Math.max(1, Math.round(100 - (totalScore - 700) * 20));
  if (totalScore >= 650) return Math.round(500 - (totalScore - 650) * 8);
  if (totalScore >= 600) return Math.round(3000 - (totalScore - 600) * 50);
  if (totalScore >= 550) return Math.round(10000 - (totalScore - 550) * 140);
  if (totalScore >= 500) return Math.round(25000 - (totalScore - 500) * 300);
  if (totalScore >= 450) return Math.round(50000 - (totalScore - 450) * 500);
  return Math.round(80000 - (totalScore - 400) * 600);
}

export default function Compare() {
  const { exams, fetchExams, loading } = useStore();
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [compareA, setCompareA] = useState<string>('');
  const [compareB, setCompareB] = useState<string>('');

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const sortedExams = useMemo(
    () => exams.map(calculateExamAssignedScores).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [exams]
  );

  const allSubjectKeys = useMemo(() => {
    const keys = new Set<string>();
    sortedExams.forEach((e) => e.subjects.forEach((s) => keys.add(s.subject)));
    return Array.from(keys);
  }, [sortedExams]);

  useEffect(() => {
    if (allSubjectKeys.length > 0 && selectedSubjects.size === 0) {
      setSelectedSubjects(new Set(allSubjectKeys.slice(0, 3)));
    }
  }, [allSubjectKeys, selectedSubjects.size]);

  useEffect(() => {
    if (sortedExams.length >= 2) {
      if (!compareA) setCompareA(sortedExams[sortedExams.length - 2].id);
      if (!compareB) setCompareB(sortedExams[sortedExams.length - 1].id);
    }
  }, [sortedExams, compareA, compareB]);

  const toggleSubject = (key: string) => {
    setSelectedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Total score trend data
  const totalTrendData = useMemo(
    () =>
      sortedExams.map((exam) => ({
        name: exam.name,
        总分: getEffectiveTotalScore(exam),
      })),
    [sortedExams]
  );

  // Subject trend data
  const subjectTrendData = useMemo(
    () =>
      sortedExams.map((exam) => {
        const row: Record<string, string | number> = { name: exam.name };
        exam.subjects.forEach((s) => {
          if (selectedSubjects.has(s.subject)) {
            const label = getSubjectName(s.subject) + (isSecondarySubject(s.subject) ? '(赋分)' : '');
            row[label] = getEffectiveScore(s);
          }
        });
        return row;
      }),
    [sortedExams, selectedSubjects]
  );

  const subjectTrendLines = useMemo(
    () =>
      Array.from(selectedSubjects).map((key, i) => ({
        dataKey: getSubjectName(key) + (isSecondarySubject(key) ? '(赋分)' : ''),
        color: COLORS[i % COLORS.length],
        name: getSubjectName(key) + (isSecondarySubject(key) ? '(赋分)' : ''),
      })),
    [selectedSubjects]
  );

  // Comparison data
  const examA = sortedExams.find((e) => e.id === compareA);
  const examB = sortedExams.find((e) => e.id === compareB);

  const comparisonData = useMemo(() => {
    if (!examA || !examB) return [];
    const allKeys = new Set<string>();
    examA.subjects.forEach((s) => allKeys.add(s.subject));
    examB.subjects.forEach((s) => allKeys.add(s.subject));
    return Array.from(allKeys).map((key) => {
      const scoreA = getEffectiveScore(examA.subjects.find((s) => s.subject === key)!);
      const scoreB = getEffectiveScore(examB.subjects.find((s) => s.subject === key)!);
      const label = getSubjectName(key) + (isSecondarySubject(key) ? '(赋分)' : '');
      return {
        name: label,
        差值: scoreB - scoreA,
        [examA.name]: scoreA,
        [examB.name]: scoreB,
      };
    });
  }, [examA, examB]);

  // Latest rank
  const latestExam = sortedExams[sortedExams.length - 1];
  const latestTotal = latestExam ? getTotalScore(latestExam) : 0;
  const estimatedRank = estimateRank(latestTotal);

  if (loading) return <Loading />;

  if (sortedExams.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState title="暂无考试数据" description="请先录入考试成绩" />
      </div>
    );
  }

  return (
    <motion.div
      className="p-6 space-y-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold gradient-text">历史比对分析</h1>
        <p className="mt-1 text-sm text-white/40">追踪成绩变化趋势，发现提升空间</p>
      </motion.div>

      {/* Total Score Trend */}
      <motion.div variants={item}>
        <GlassCard className="p-5" glow>
          <h3 className="mb-4 text-sm font-medium text-white/70">总分趋势</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={totalTrendData}>
              <defs>
                <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="总分"
                stroke="#3B82F6"
                fill="url(#totalGrad)"
                strokeWidth={2}
                isAnimationActive
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>
      </motion.div>

      {/* Subject Selector */}
      <motion.div variants={item}>
        <GlassCard className="p-5">
          <h3 className="mb-3 text-sm font-medium text-white/70">科目选择</h3>
          <div className="flex flex-wrap gap-2">
            {allSubjectKeys.map((key, i) => {
              const isActive = selectedSubjects.has(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleSubject(key)}
                  className={`rounded-lg px-3 py-1.5 text-xs transition-all ${
                    isActive
                      ? 'text-white border'
                      : 'text-white/40 bg-white/5 border border-transparent hover:text-white/60'
                  }`}
                  style={
                    isActive
                      ? { borderColor: COLORS[i % COLORS.length], color: COLORS[i % COLORS.length], background: `${COLORS[i % COLORS.length]}15` }
                      : undefined
                  }
                >
                  {getSubjectName(key)}
                </button>
              );
            })}
          </div>
        </GlassCard>
      </motion.div>

      {/* Single Subject Trend */}
      {selectedSubjects.size > 0 && (
        <motion.div variants={item}>
          <GlassCard className="p-5" glow>
            <h3 className="mb-4 text-sm font-medium text-white/70">单科趋势</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={subjectTrendData}>
                <defs>
                  {subjectTrendLines.map((line, i) => (
                    <linearGradient key={i} id={`subGrad_${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={line.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={line.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                />
                {subjectTrendLines.map((line, i) => (
                  <Area
                    key={i}
                    type="monotone"
                    dataKey={line.dataKey}
                    name={line.name}
                    stroke={line.color}
                    fill={`url(#subGrad_${i})`}
                    strokeWidth={2}
                    isAnimationActive
                    animationDuration={800}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </GlassCard>
        </motion.div>
      )}

      {/* Exam Comparison */}
      <motion.div variants={item}>
        <GlassCard className="p-5" glow>
          <div className="mb-4 flex items-center gap-3">
            <h3 className="text-sm font-medium text-white/70">考试对比</h3>
            <ArrowLeftRight className="h-4 w-4 text-white/30" />
          </div>
          <div className="mb-4 flex flex-wrap gap-3">
            <select value={compareA} onChange={(e) => setCompareA(e.target.value)} className="flex-1 min-w-[150px]">
              <option value="">选择考试A</option>
              {sortedExams.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
            <span className="text-white/30 self-center">VS</span>
            <select value={compareB} onChange={(e) => setCompareB(e.target.value)} className="flex-1 min-w-[150px]">
              <option value="">选择考试B</option>
              {sortedExams.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          {comparisonData.length > 0 && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                <Bar dataKey="差值" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={800}>
                  {comparisonData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.差值 >= 0 ? '#10B981' : '#EF4444'}
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </GlassCard>
      </motion.div>

      {/* Rank Simulation */}
      <motion.div variants={item}>
        <GlassCard className="p-5" glow>
          <div className="flex items-center gap-3 mb-4">
            <Award className="h-5 w-5 text-amber-400" />
            <h3 className="text-sm font-medium text-white/70">省排名估算</h3>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-white/40 mb-1">基于最新总分</p>
              <AnimatedNumber value={latestTotal} className="text-3xl font-bold text-white" />
              <span className="text-sm text-white/30 ml-1">分</span>
            </div>
            <div className="h-12 w-px bg-white/10" />
            <div>
              <p className="text-xs text-white/40 mb-1">估算省排名</p>
              <AnimatedNumber value={estimatedRank} className="text-3xl font-bold gradient-text" />
              <span className="text-sm text-white/30 ml-1">名</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-white/20">* 排名为估算值，仅供参考</p>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
