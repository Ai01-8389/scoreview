import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Flame,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
} from 'lucide-react';
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
  AreaChart,
  Area,
} from 'recharts';
import { useStore } from '@/store/useStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { getSubjectName, SUBJECT_CONFIG } from '@/shared/subjects';
import { isSecondarySubject, estimateAssignedScore, getLevelTextClass, SUBJECT_DISTRIBUTIONS } from '@/shared/assignmentScore';
import { calculateExamAssignedScores } from '@/utils/scoreCalc';

const COLORS = ['#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 backdrop-blur-xl">
      <p className="mb-1 text-xs text-white/60">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' ? `${(entry.value * 100).toFixed(1)}%` : entry.value}
        </p>
      ))}
    </div>
  );
}

const STRATEGY_MAP: Record<string, string[]> = {
  '现代文阅读': ['加强文本细读训练', '总结常见题型答题模板', '每日限时阅读1篇'],
  '文言文阅读': ['积累高频文言实词', '练习文言文翻译技巧', '整理常见句式'],
  '古诗文默写': ['每日默写5篇', '整理易错字', '利用碎片时间反复记忆'],
  '语言文字运用': ['刷近3年真题', '总结语病类型', '练习连贯性题目'],
  '作文': ['积累素材库', '练习议论文结构', '每周限时写作1篇'],
  '单选题': ['整理错题本', '限时训练提高速度', '总结常见陷阱'],
  '多选题': ['掌握确定选项法', '练习排除法', '注意部分得分策略'],
  '填空题': ['强化计算准确率', '总结常考题型', '练习规范书写'],
  '解答题': ['分步得分策略', '练习第一问必拿', '总结解题模板'],
  '听力': ['每日听力训练30分钟', '练习抓关键词', '熟悉常见场景词汇'],
  '阅读理解': ['练习快速定位信息', '积累同义替换', '限时训练4篇'],
  '语言运用': ['练习语法填空技巧', '积累固定搭配', '练习完形填空'],
  '写作': ['背诵优秀范文', '练习应用文格式', '积累高级句型'],
  '实验题': ['熟悉实验原理和步骤', '练习数据处理', '总结实验设计方法'],
  '计算题': ['规范解题步骤', '练习受力分析', '分步得分策略'],
  '选择题': ['限时训练提高速度', '整理错题本', '总结常见陷阱'],
  '非选择题': ['练习规范答题', '总结答题模板', '注意关键词得分'],
};

function getStrategy(category: string): string[] {
  return STRATEGY_MAP[category] ?? ['制定专项训练计划', '整理错题并分析原因', '每周限时训练'];
}

export default function SubScoreAnalysis() {
  const { exams, fetchExams, loading } = useStore();
  const [selectedSubject, setSelectedSubject] = useState<string>('');

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
    if (allSubjectKeys.length > 0 && !selectedSubject) {
      setSelectedSubject(allSubjectKeys[0]);
    }
  }, [allSubjectKeys, selectedSubject]);

  // Score rate bar chart data (latest exam)
  const scoreRateData = useMemo(() => {
    if (!selectedSubject || sortedExams.length === 0) return [];
    const latest = sortedExams[sortedExams.length - 1];
    const subject = latest.subjects.find((s) => s.subject === selectedSubject);
    if (!subject) return [];
    return subject.subScores.map((sub) => ({
      name: sub.category,
      得分率: sub.fullScore > 0 ? sub.score / sub.fullScore : 0,
    }));
  }, [selectedSubject, sortedExams]);

  // Heatmap data
  const heatmapData = useMemo((): { categories: string[]; exams: { name: string; rates: number[] }[] } | null => {
    if (!selectedSubject || sortedExams.length === 0) return null;
    const latest = sortedExams[sortedExams.length - 1];
    const subject = latest.subjects.find((s) => s.subject === selectedSubject);
    if (!subject) return null;
    const categories = subject.subScores.map((s) => s.category);
    return {
      categories,
      exams: sortedExams.map((exam) => {
        const sub = exam.subjects.find((s) => s.subject === selectedSubject);
        return {
          name: exam.name,
          rates: categories.map((cat) => {
            const subScore = sub?.subScores.find((s) => s.category === cat);
            return subScore && subScore.fullScore > 0 ? subScore.score / subScore.fullScore : 0;
          }),
        };
      }),
    };
  }, [selectedSubject, sortedExams]);

  // Weak points
  const weakPoints = useMemo(() => {
    if (!selectedSubject || sortedExams.length === 0) return [];
    const latest = sortedExams[sortedExams.length - 1];
    const subject = latest.subjects.find((s) => s.subject === selectedSubject);
    if (!subject) return [];
    return subject.subScores
      .filter((sub) => sub.fullScore > 0 && sub.score / sub.fullScore < 0.6)
      .map((sub) => ({
        category: sub.category,
        rate: sub.score / sub.fullScore,
        score: sub.score,
        fullScore: sub.fullScore,
      }));
  }, [selectedSubject, sortedExams]);

  // Growth point ranking
  const growthRanking = useMemo(() => {
    if (!selectedSubject || sortedExams.length === 0) return [];
    const latest = sortedExams[sortedExams.length - 1];
    const subject = latest.subjects.find((s) => s.subject === selectedSubject);
    if (!subject) return [];
    return subject.subScores
      .map((sub) => ({
        category: sub.category,
        rate: sub.fullScore > 0 ? sub.score / sub.fullScore : 0,
        potential: sub.fullScore - sub.score,
        score: sub.score,
        fullScore: sub.fullScore,
      }))
      .filter((d) => d.potential > 0)
      .sort((a, b) => b.potential - a.potential);
  }, [selectedSubject, sortedExams]);

  // Sub-score trend
  const subTrendData = useMemo(() => {
    if (!selectedSubject || sortedExams.length === 0) return { data: [], lines: [] };
    const latest = sortedExams[sortedExams.length - 1];
    const subject = latest.subjects.find((s) => s.subject === selectedSubject);
    if (!subject) return { data: [], lines: [] };
    const categories = subject.subScores.map((s) => s.category);
    const data = sortedExams.map((exam) => {
      const sub = exam.subjects.find((s) => s.subject === selectedSubject);
      const row: Record<string, string | number> = { name: exam.name };
      categories.forEach((cat) => {
        const subScore = sub?.subScores.find((s) => s.category === cat);
        row[cat] = subScore && subScore.fullScore > 0 ? subScore.score / subScore.fullScore : 0;
      });
      return row;
    });
    const lines = categories.map((cat, i) => ({
      dataKey: cat,
      color: COLORS[i % COLORS.length],
      name: cat,
    }));
    return { data, lines };
  }, [selectedSubject, sortedExams]);

  // Strategy cards
  const strategies = useMemo(() => {
    if (weakPoints.length === 0) return [];
    return weakPoints.map((wp) => ({
      category: wp.category,
      rate: wp.rate,
      suggestions: getStrategy(wp.category),
    }));
  }, [weakPoints]);

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
        <h1 className="text-2xl font-bold gradient-text">小分增长点分析</h1>
        <p className="mt-1 text-sm text-white/40">深入分析各科小分，精准定位薄弱环节</p>
      </motion.div>

      {/* Subject Selector */}
      <motion.div variants={item}>
        <GlassCard className="p-5">
          <h3 className="mb-3 text-sm font-medium text-white/70">选择科目</h3>
          <div className="flex flex-wrap gap-2">
            {allSubjectKeys.map((key) => {
              const isActive = selectedSubject === key;
              const isSec = isSecondarySubject(key);
              return (
                <button
                  key={key}
                  onClick={() => setSelectedSubject(key)}
                  className={`rounded-lg px-3 py-1.5 text-xs transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-white border border-blue-500/30'
                      : 'text-white/40 bg-white/5 border border-transparent hover:text-white/60'
                  }`}
                >
                  {getSubjectName(key)}
                  {isSec && <span className="ml-1 text-cyan-400/60 text-[10px]">赋分</span>}
                </button>
              );
            })}
          </div>
        </GlassCard>
      </motion.div>

      {/* Assignment Score Info for Secondary Subjects */}
      {selectedSubject && isSecondarySubject(selectedSubject) && (() => {
        const latest = sortedExams[sortedExams.length - 1];
        const subject = latest?.subjects.find((s) => s.subject === selectedSubject);
        if (!subject) return null;
        const result = estimateAssignedScore(subject.totalScore, subject.fullScore, selectedSubject);
        const dist = SUBJECT_DISTRIBUTIONS[selectedSubject];
        return (
          <motion.div variants={item}>
            <GlassCard className="p-5 border-cyan-500/20">
              <h3 className="mb-3 text-sm font-medium text-cyan-400/80">等级赋分信息 · {getSubjectName(selectedSubject)}</h3>
              {dist && (
                <p className="mb-3 text-xs text-white/30">{dist.description}</p>
              )}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-xs text-white/40 mb-1">卷面裸分</p>
                  <p className="text-xl font-bold text-white">{subject.totalScore} <span className="text-sm text-white/30">/ {subject.fullScore}</span></p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">赋分等级</p>
                  <p className={`text-xl font-bold ${getLevelTextClass(result.level)}`}>
                    {result.level}
                  </p>
                  {result.estimatedRawRange.high > 0 && (
                    <p className="text-xs text-white/30">裸分约{result.estimatedRawRange.low}-{result.estimatedRawRange.high}分可入此等级</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">赋分后分数</p>
                  <p className="text-xl font-bold text-cyan-400">{result.assignedScore}</p>
                  <p className="text-xs text-white/30">区间 {result.scoreRange.low}-{result.scoreRange.high}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">估算百分位</p>
                  <p className="text-xl font-bold text-white">{(result.estimatedPercentile * 100).toFixed(1)}%</p>
                  <p className="text-xs text-white/30">即排名前{((1 - result.estimatedPercentile) * 100).toFixed(1)}%</p>
                </div>
                {dist && (
                  <div>
                    <p className="text-xs text-white/40 mb-1">科目分布特征</p>
                    <p className="text-sm text-white/50">均值{dist.mean}分 · 最高约{dist.maxObserved}分</p>
                    <p className="text-xs text-white/30">标准差{dist.stdDev} · 中间大两头小</p>
                  </div>
                )}
              </div>
            </GlassCard>
          </motion.div>
        );
      })()}

      {selectedSubject && (
        <>
          {/* Score Rate Chart */}
          <motion.div variants={item}>
            <GlassCard className="p-5" glow>
              <h3 className="mb-4 text-sm font-medium text-white/70">各题型得分率</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={scoreRateData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} axisLine={false} />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                    axisLine={false}
                    tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                    domain={[0, 1]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0.6} stroke="#F59E0B" strokeDasharray="5 5" label={{ value: '60%', fill: '#F59E0B', fontSize: 11 }} />
                  <Bar dataKey="得分率" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800}>
                    {scoreRateData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.得分率 >= 0.6 ? '#3B82F6' : '#EF4444'}
                        fillOpacity={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>
          </motion.div>

          {/* Heatmap Matrix */}
          {heatmapData && heatmapData.categories.length > 0 && (
            <motion.div variants={item}>
              <GlassCard className="p-5">
                <h3 className="mb-4 text-sm font-medium text-white/70">得分率热力图</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="py-2 px-2 text-left text-white/40 font-normal">考试</th>
                        {heatmapData.categories.map((cat) => (
                          <th key={cat} className="py-2 px-2 text-center text-white/40 font-normal whitespace-nowrap">
                            {cat}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmapData.exams.map((exam, i) => (
                        <tr key={i} className="border-t border-white/5">
                          <td className="py-2 px-2 text-white/60">{exam.name}</td>
                          {exam.rates.map((rate, j) => {
                            const r = rate;
                            const bg =
                              r >= 0.8
                                ? 'bg-emerald-500/40'
                                : r >= 0.6
                                ? 'bg-blue-500/30'
                                : r >= 0.4
                                ? 'bg-amber-500/30'
                                : 'bg-red-500/30';
                            return (
                              <td key={j} className="py-2 px-2 text-center">
                                <span
                                  className={`inline-block min-w-[3rem] rounded px-1.5 py-0.5 ${bg} text-white/80`}
                                >
                                  {(r * 100).toFixed(0)}%
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* Weak Point Detection */}
          {weakPoints.length > 0 && (
            <motion.div variants={item}>
              <GlassCard className="p-5 glow-amber">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <h3 className="text-sm font-medium text-white/70">薄弱环节</h3>
                </div>
                <div className="flex flex-wrap gap-3">
                  {weakPoints.map((wp) => (
                    <motion.div
                      key={wp.category}
                      className="animate-pulse-glow rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5"
                      whileHover={{ scale: 1.02 }}
                    >
                      <p className="text-sm font-medium text-white/80">{wp.category}</p>
                      <p className="text-xs text-red-400 mt-0.5">
                        得分率 {(wp.rate * 100).toFixed(1)}% · {wp.score}/{wp.fullScore}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* Growth Point Ranking */}
          {growthRanking.length > 0 && (
            <motion.div variants={item}>
              <GlassCard className="p-5" glow>
                <div className="flex items-center gap-2 mb-4">
                  <Flame className="h-4 w-4 text-amber-400" />
                  <h3 className="text-sm font-medium text-white/70">增长点排名</h3>
                </div>
                <div className="space-y-3">
                  {growthRanking.map((d, i) => (
                    <div key={d.category} className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <span className="w-20 text-sm text-white/60 truncate">{d.category}</span>
                      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${d.rate * 100}%` }}
                          transition={{ duration: 0.8, delay: i * 0.1 }}
                        />
                      </div>
                      <span className="text-xs text-amber-400 w-14 text-right">
                        可提{d.potential}分
                      </span>
                      <Flame className="h-3.5 w-3.5 text-amber-400/60" />
                    </div>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* Sub-score Trend */}
          {subTrendData.data.length > 0 && subTrendData.lines.length > 0 && (
            <motion.div variants={item}>
              <GlassCard className="p-5" glow>
                <h3 className="mb-4 text-sm font-medium text-white/70">小分趋势</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={subTrendData.data}>
                    <defs>
                      {subTrendData.lines.map((line, i) => (
                        <linearGradient key={i} id={`subTrendGrad_${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={line.color} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={line.color} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={false} />
                    <YAxis
                      tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                      axisLine={false}
                      tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                      domain={[0, 1]}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {subTrendData.lines.map((line, i) => (
                      <Area
                        key={i}
                        type="monotone"
                        dataKey={line.dataKey}
                        name={line.name}
                        stroke={line.color}
                        fill={`url(#subTrendGrad_${i})`}
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

          {/* Strategy Cards */}
          {strategies.length > 0 && (
            <motion.div variants={item}>
              <GlassCard className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb className="h-4 w-4 text-amber-400" />
                  <h3 className="text-sm font-medium text-white/70">提升策略</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {strategies.map((s) => (
                    <motion.div
                      key={s.category}
                      className="rounded-xl border border-white/5 bg-white/5 p-4"
                      whileHover={{ y: -2, borderColor: 'rgba(59,130,246,0.2)' }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-white/80">{s.category}</span>
                        <span className="text-xs text-red-400">得分率 {(s.rate * 100).toFixed(1)}%</span>
                      </div>
                      <ul className="space-y-1.5">
                        {s.suggestions.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-white/50">
                            <TrendingUp className="h-3 w-3 text-cyan-400 mt-0.5 shrink-0" />
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}
