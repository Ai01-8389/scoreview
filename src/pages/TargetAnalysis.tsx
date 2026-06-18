import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  TrendingUp,
  Flame,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useStore } from '@/store/useStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { getSubjectName } from '@/shared/subjects';
import { isSecondarySubject } from '@/shared/assignmentScore';
import { calculateExamAssignedScores, getEffectiveScore, getEffectiveTotalScore } from '@/utils/scoreCalc';
import type { University, Exam } from '@/shared/types';

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
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 backdrop-blur-xl">
      <p className="text-xs text-white/60">{payload[0].payload.name}</p>
      <p className="text-sm font-bold text-cyan-400">{payload[0].value}</p>
    </div>
  );
}

export default function TargetAnalysis() {
  const { exams, targets, universities, fetchExams, fetchTargets, fetchUniversities, addTarget, removeTarget, loading } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    fetchExams();
    fetchTargets();
    fetchUniversities();
  }, [fetchExams, fetchTargets, fetchUniversities]);

  const sortedExams = useMemo(
    () => exams.map(calculateExamAssignedScores).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [exams]
  );

  const latestExam = sortedExams[0];
  const currentTotal = latestExam ? getTotalScore(latestExam) : 0;

  const filteredUniversities = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return universities
      .filter((u) => u.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [universities, searchQuery]);

  const handleAddTarget = async (uni: University) => {
    await addTarget({
      universityId: uni.id,
      university: uni,
      subjectScores: [],
    });
    setSearchQuery('');
    setShowDropdown(false);
  };

  // Gap analysis data
  const gapData = useMemo(() => {
    if (!latestExam || targets.length === 0) return [];
    const target = targets[0];
    return latestExam.subjects.map((s) => {
      const targetSubject = target.subjectScores.find((ts) => ts.subject === s.subject);
      const targetScore = targetSubject?.score ?? Math.round((isSecondarySubject(s.subject) ? 100 : s.fullScore) * 0.8);
      const effective = getEffectiveScore(s);
      return {
        name: getSubjectName(s.subject) + (isSecondarySubject(s.subject) ? '(赋分)' : ''),
        当前: effective,
        目标: targetScore,
        差距: targetScore - effective,
      };
    });
  }, [latestExam, targets]);

  // Progress rings per subject
  const subjectProgress = useMemo(() => {
    if (!latestExam) return [];
    return latestExam.subjects.map((s) => {
      const effective = getEffectiveScore(s);
      const max = isSecondarySubject(s.subject) ? 100 : s.fullScore;
      return {
        subject: getSubjectName(s.subject) + (isSecondarySubject(s.subject) ? '(赋分)' : ''),
        rate: max > 0 ? effective / max : 0,
        score: effective,
        fullScore: max,
      };
    });
  }, [latestExam]);

  // Improvement space
  const improvementSpace = useMemo(() => {
    if (!latestExam || targets.length === 0) return [];
    const target = targets[0];
    return latestExam.subjects
      .map((s) => {
        const targetSubject = target.subjectScores.find((ts) => ts.subject === s.subject);
        const targetScore = targetSubject?.score ?? Math.round((isSecondarySubject(s.subject) ? 100 : s.fullScore) * 0.8);
        const effective = getEffectiveScore(s);
        const max = isSecondarySubject(s.subject) ? 100 : s.fullScore;
        return {
          subject: getSubjectName(s.subject) + (isSecondarySubject(s.subject) ? '(赋分)' : ''),
          current: effective,
          target: targetScore,
          gap: targetScore - effective,
          rate: max > 0 ? effective / max : 0,
        };
      })
      .filter((d) => d.gap > 0)
      .sort((a, b) => b.gap - a.gap);
  }, [latestExam, targets]);

  // Path steps
  const pathSteps = useMemo(() => {
    if (improvementSpace.length === 0) return [];
    const totalGap = improvementSpace.reduce((s, d) => s + d.gap, 0);
    const steps = [];
    const phase1Gap = Math.round(totalGap * 0.3);
    const phase2Gap = Math.round(totalGap * 0.6);
    steps.push({
      phase: '第一阶段',
      description: `提升 ${phase1Gap} 分，重点攻克薄弱科目`,
      subjects: improvementSpace.slice(0, 2).map((d) => d.subject),
    });
    steps.push({
      phase: '第二阶段',
      description: `累计提升 ${phase2Gap} 分，稳定优势科目`,
      subjects: improvementSpace.slice(0, 4).map((d) => d.subject),
    });
    steps.push({
      phase: '第三阶段',
      description: `累计提升 ${totalGap} 分，冲刺目标院校`,
      subjects: improvementSpace.map((d) => d.subject),
    });
    return steps;
  }, [improvementSpace]);

  if (loading) return <Loading />;

  return (
    <motion.div
      className="p-6 space-y-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold gradient-text">目标院校分析</h1>
        <p className="mt-1 text-sm text-white/40">设定目标，量化差距，规划提升路径</p>
      </motion.div>

      {/* University Search */}
      <motion.div variants={item} className="relative">
        <GlassCard className="p-5">
          <h3 className="mb-3 text-sm font-medium text-white/70">添加目标院校</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="搜索大学名称..."
              className="w-full pl-10"
            />
          </div>
          <AnimatePresence>
            {showDropdown && filteredUniversities.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute left-5 right-5 top-full z-10 mt-1 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-xl"
              >
                {filteredUniversities.map((uni) => (
                  <button
                    key={uni.id}
                    onClick={() => handleAddTarget(uni)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 transition-colors first:rounded-t-xl last:rounded-b-xl"
                  >
                    <span>{uni.name}</span>
                    <span className="text-xs text-white/30">{uni.province} · {uni.type}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </motion.div>

      {/* Target Cards */}
      {targets.length > 0 && (
        <motion.div variants={item}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {targets.map((target) => {
              const uni = target.university;
              const targetTotal = target.subjectScores.reduce((sum, s) => sum + s.score, 0) || 600;
              const gap = targetTotal - currentTotal;
              return (
                <GlassCard key={target.id} className="p-5" glow whileHover={{ y: -2 }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-base font-medium text-white/90">{uni?.name ?? '未知院校'}</h4>
                      <p className="text-xs text-white/40 mt-0.5">{uni?.province} · {uni?.type}</p>
                    </div>
                    <button
                      onClick={() => removeTarget(target.id)}
                      className="rounded-lg p-1 text-white/30 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-4">
                    <div>
                      <p className="text-xs text-white/40">目标分数</p>
                      <span className="text-lg font-bold text-cyan-400">{targetTotal}</span>
                    </div>
                    <div className="h-8 w-px bg-white/10" />
                    <div>
                      <p className="text-xs text-white/40">当前分数</p>
                      <span className="text-lg font-bold text-white">{currentTotal}</span>
                    </div>
                    <div className="h-8 w-px bg-white/10" />
                    <div>
                      <p className="text-xs text-white/40">差距</p>
                      <span className={`text-lg font-bold ${gap > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {gap > 0 ? `+${gap}` : gap}
                      </span>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </motion.div>
      )}

      {targets.length === 0 && (
        <motion.div variants={item}>
          <EmptyState title="暂未设定目标院校" description="搜索并添加目标院校以查看差距分析" />
        </motion.div>
      )}

      {/* Gap Analysis Chart */}
      {gapData.length > 0 && (
        <motion.div variants={item}>
          <GlassCard className="p-5" glow>
            <h3 className="mb-4 text-sm font-medium text-white/70">差距分析</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={gapData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={false} width={60} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="当前" fill="#3B82F6" fillOpacity={0.8} radius={[0, 4, 4, 0]} isAnimationActive animationDuration={800} />
                <Bar dataKey="目标" fill="#06B6D4" fillOpacity={0.5} radius={[0, 4, 4, 0]} isAnimationActive animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        </motion.div>
      )}

      {/* Progress Rings */}
      {subjectProgress.length > 0 && (
        <motion.div variants={item}>
          <GlassCard className="p-5">
            <h3 className="mb-4 text-sm font-medium text-white/70">各科得分率</h3>
            <div className="flex flex-wrap justify-center gap-6">
              {subjectProgress.map((sp) => (
                <div key={sp.subject} className="flex flex-col items-center">
                  <ProgressRing
                    value={sp.score}
                    max={sp.fullScore}
                    size={100}
                    strokeWidth={8}
                  />
                  <span className="mt-2 text-xs text-white/50">{sp.subject}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Improvement Space */}
      {improvementSpace.length > 0 && (
        <motion.div variants={item}>
          <GlassCard className="p-5" glow>
            <div className="flex items-center gap-2 mb-4">
              <Flame className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-medium text-white/70">提升空间</h3>
            </div>
            <div className="space-y-3">
              {improvementSpace.map((d) => (
                <div key={d.subject} className="flex items-center gap-4">
                  <span className="w-16 text-sm text-white/60">{d.subject}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${d.rate * 100}%` }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                  <span className="text-xs text-amber-400 w-16 text-right">+{d.gap}分</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Path to Target */}
      {pathSteps.length > 0 && (
        <motion.div variants={item}>
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-medium text-white/70">提升路径</h3>
            </div>
            <div className="space-y-4">
              {pathSteps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.15 }}
                  className="flex gap-4"
                >
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-xs font-bold text-white">
                      {i + 1}
                    </div>
                    {i < pathSteps.length - 1 && <div className="w-px flex-1 bg-white/10 mt-1" />}
                  </div>
                  <div className="flex-1 pb-4">
                    <h4 className="text-sm font-medium text-white/80">{step.phase}</h4>
                    <p className="text-xs text-white/40 mt-0.5">{step.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {step.subjects.map((s) => (
                        <span key={s} className="rounded-md bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400 border border-blue-500/20">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      )}
    </motion.div>
  );
}
