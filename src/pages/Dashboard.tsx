import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Trophy, ArrowRight, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { ScoreRadarChart } from '@/components/charts/ScoreRadarChart';
import { getSubjectName } from '@/shared/subjects';
import { isSecondarySubject, estimateAssignedScore, getLevelTextClass, ASSIGNMENT_TABLE } from '@/shared/assignmentScore';
import { calculateExamAssignedScores, getEffectiveScore, getEffectiveTotalScore, getEffectiveFullScore } from '@/utils/scoreCalc';
import type { Exam, SubjectScore } from '@/shared/types';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

function getScoreRate(subject: SubjectScore) {
  const effective = getEffectiveScore(subject);
  const max = isSecondarySubject(subject.subject) ? 100 : subject.fullScore;
  return max > 0 ? effective / max : 0;
}

export default function Dashboard() {
  const { exams, fetchExams, loading } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const processedExams = useMemo(
    () => exams.map(calculateExamAssignedScores).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [exams]
  );

  const latestExam = processedExams[0];
  const previousExam = processedExams[1];

  const effectiveTotal = latestExam ? getEffectiveTotalScore(latestExam) : 0;
  const effectiveFull = latestExam ? getEffectiveFullScore(latestExam) : 750;

  const totalChange = useMemo(() => {
    if (!latestExam || !previousExam) return null;
    return getEffectiveTotalScore(latestExam) - getEffectiveTotalScore(previousExam);
  }, [latestExam, previousExam]);

  const bestSubject = useMemo(() => {
    if (!latestExam) return null;
    return latestExam.subjects.reduce((best, s) =>
      getScoreRate(s) > getScoreRate(best) ? s : best
    , latestExam.subjects[0]);
  }, [latestExam]);

  const radarData = useMemo(() => {
    if (!latestExam) return [];
    return latestExam.subjects.map((s) => ({
      subject: getSubjectName(s.subject),
      scoreRate: getScoreRate(s),
    }));
  }, [latestExam]);

  const diagnosis = useMemo(() => {
    if (!latestExam || !previousExam) return { improved: [], declined: [] };
    const improved: { name: string; change: number; isSecondary: boolean }[] = [];
    const declined: { name: string; change: number; isSecondary: boolean }[] = [];
    for (const curr of latestExam.subjects) {
      const prev = previousExam.subjects.find((s) => s.subject === curr.subject);
      if (prev) {
        const currEffective = getEffectiveScore(curr);
        const prevEffective = getEffectiveScore(prev);
        const change = currEffective - prevEffective;
        const sec = isSecondarySubject(curr.subject);
        if (change > 0) improved.push({ name: getSubjectName(curr.subject), change, isSecondary: sec });
        else if (change < 0) declined.push({ name: getSubjectName(curr.subject), change, isSecondary: sec });
      }
    }
    return { improved, declined };
  }, [latestExam, previousExam]);

  if (loading) return <Loading />;

  if (!latestExam) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          title="暂无考试数据"
          description="点击录入页面添加第一次考试成绩"
          icon={
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Trophy className="h-10 w-10 text-amber-400/50" />
            </motion.div>
          }
        />
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
      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold gradient-text">成绩总览</h1>
        <p className="mt-1 text-sm text-white/40">
          {latestExam.name} · {latestExam.date}
        </p>
      </motion.div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div variants={item}>
          <GlassCard className="p-5 glow-blue" whileHover={{ y: -2 }}>
            <p className="text-xs text-white/50 mb-2">赋分后总分</p>
            <div className="flex items-end gap-2">
              <AnimatedNumber value={effectiveTotal} className="text-3xl font-bold text-white" />
              <span className="text-sm text-white/30 mb-1">/ {effectiveFull}</span>
            </div>
            <p className="mt-1 text-xs text-cyan-400/60">再选科目已按等级赋分计算</p>
          </GlassCard>
        </motion.div>

        <motion.div variants={item}>
          <GlassCard className="p-5" whileHover={{ y: -2 }}>
            <p className="text-xs text-white/50 mb-2">较上次变化</p>
            {totalChange !== null ? (
              <div className="flex items-center gap-2">
                {totalChange >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-400" />
                )}
                <AnimatedNumber
                  value={Math.abs(totalChange)}
                  className={`text-3xl font-bold ${totalChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                />
              </div>
            ) : (
              <span className="text-sm text-white/30">无对比数据</span>
            )}
          </GlassCard>
        </motion.div>

        <motion.div variants={item}>
          <GlassCard className="p-5" whileHover={{ y: -2 }}>
            <p className="text-xs text-white/50 mb-2">最强科目</p>
            {bestSubject && (
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-400" />
                <span className="text-3xl font-bold text-white">
                  {getSubjectName(bestSubject.subject)}
                </span>
                <span className="text-sm text-white/40">
                  {(getScoreRate(bestSubject) * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </GlassCard>
        </motion.div>
      </div>

      {/* Subject Scores with Assignment */}
      <motion.div variants={item}>
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-medium text-white/70">各科成绩（含赋分）</h3>
            <div className="group relative">
              <Info className="h-3.5 w-3.5 text-white/30 cursor-help" />
              <div className="absolute left-0 top-6 z-20 hidden group-hover:block w-72 rounded-xl border border-white/10 bg-slate-900/95 p-3 backdrop-blur-xl shadow-xl">
                <p className="text-xs text-white/60 mb-2 font-medium">辽宁新高考等级赋分制</p>
                <p className="text-xs text-white/40 mb-2">再选科目（化学/生物/政治/地理）按全省排名百分位赋分，统考和首选科目使用原始分。</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="py-1 text-left text-white/40 font-normal">等级</th>
                      <th className="py-1 text-left text-white/40 font-normal">比例</th>
                      <th className="py-1 text-right text-white/40 font-normal">赋分</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ASSIGNMENT_TABLE.map((row) => (
                      <tr key={row.level} className="border-b border-white/5">
                        <td className="py-1 text-white/70">{row.level}</td>
                        <td className="py-1 text-white/50">{row.proportion}</td>
                        <td className="py-1 text-right text-cyan-400">{row.scoreRange}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {latestExam.subjects.map((s) => {
              const effective = getEffectiveScore(s);
              const rate = getScoreRate(s);
              const isSecondary = isSecondarySubject(s.subject);
              return (
                <div
                  key={s.subject}
                  className={`rounded-xl p-3 border ${
                    isSecondary
                      ? 'bg-cyan-500/5 border-cyan-500/15'
                      : 'bg-white/5 border-white/5'
                  }`}
                >
                  <p className="text-xs text-white/50 mb-1">{getSubjectName(s.subject)}</p>
                  <p className="text-xl font-bold text-white">{effective}</p>
                  <p className="text-xs text-white/30">
                    {isSecondary ? `卷面${s.totalScore}` : `满分${s.fullScore}`}
                  </p>
                  {isSecondary && s.assignedLevel && (
                    <span className={`inline-block mt-1 text-xs font-medium ${getLevelTextClass(s.assignedLevel as any)}`}>
                      {s.assignedLevel}级
                    </span>
                  )}
                  <div className="mt-1.5 h-1 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${rate >= 0.7 ? 'bg-emerald-500' : rate >= 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${rate * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={item}>
          <ScoreRadarChart data={radarData} title="各科得分率（赋分后）" />
        </motion.div>

        <motion.div variants={item}>
          <GlassCard className="p-5 flex flex-col items-center" glow>
            <h3 className="mb-4 text-sm font-medium text-white/70 self-start">综合得分率</h3>
            <ProgressRing
              value={effectiveTotal}
              max={effectiveFull}
              size={200}
              strokeWidth={12}
              label={`${effectiveTotal} / ${effectiveFull}`}
              sublabel="赋分后总分"
            />
          </GlassCard>
        </motion.div>
      </div>

      {/* Quick Diagnosis */}
      <motion.div variants={item}>
        <GlassCard className="p-5">
          <h3 className="mb-4 text-sm font-medium text-white/70">快速诊断</h3>
          <div className="flex flex-wrap gap-3">
            {diagnosis.improved.map((d) => (
              <span
                key={d.name}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-400 border border-emerald-500/20"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                {d.name} +{d.change}{d.isSecondary ? '(赋分)' : ''}
              </span>
            ))}
            {diagnosis.declined.map((d) => (
              <span
                key={d.name}
                className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1.5 text-sm text-red-400 border border-red-500/20"
              >
                <TrendingDown className="h-3.5 w-3.5" />
                {d.name} {d.change}{d.isSecondary ? '(赋分)' : ''}
              </span>
            ))}
            {diagnosis.improved.length === 0 && diagnosis.declined.length === 0 && (
              <span className="text-sm text-white/30">暂无对比数据</span>
            )}
          </div>
        </GlassCard>
      </motion.div>

      {/* Recent Exams Table */}
      <motion.div variants={item}>
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white/70">近期考试</h3>
            <button
              onClick={() => navigate('/compare')}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
            >
              查看详情 <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="py-2 text-left text-white/40 font-normal">考试名称</th>
                  <th className="py-2 text-left text-white/40 font-normal">日期</th>
                  <th className="py-2 text-right text-white/40 font-normal">赋分总分</th>
                  <th className="py-2 text-right text-white/40 font-normal">得分率</th>
                </tr>
              </thead>
              <tbody>
                {processedExams.slice(0, 5).map((exam) => {
                  const total = getEffectiveTotalScore(exam);
                  const full = getEffectiveFullScore(exam);
                  return (
                    <tr key={exam.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-2.5 text-white/80">{exam.name}</td>
                      <td className="py-2.5 text-white/50">{exam.date}</td>
                      <td className="py-2.5 text-right text-white/80">{total}</td>
                      <td className="py-2.5 text-right">
                        <span className={total / full >= 0.7 ? 'text-emerald-400' : total / full >= 0.5 ? 'text-amber-400' : 'text-red-400'}>
                          {((total / full) * 100).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
