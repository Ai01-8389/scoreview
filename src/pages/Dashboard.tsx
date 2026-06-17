import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Trophy, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { ScoreRadarChart } from '@/components/charts/ScoreRadarChart';
import { getSubjectName } from '@/shared/subjects';
import type { Exam, SubjectScore } from '@/shared/types';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

function getTotalScore(exam: Exam) {
  return exam.subjects.reduce((sum, s) => sum + s.totalScore, 0);
}

function getTotalFullScore(exam: Exam) {
  return exam.subjects.reduce((sum, s) => sum + s.fullScore, 0);
}

function getScoreRate(subject: SubjectScore) {
  return subject.fullScore > 0 ? subject.totalScore / subject.fullScore : 0;
}

export default function Dashboard() {
  const { exams, fetchExams, loading } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const sortedExams = useMemo(
    () => [...exams].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [exams]
  );

  const latestExam = sortedExams[0];
  const previousExam = sortedExams[1];

  const totalChange = useMemo(() => {
    if (!latestExam || !previousExam) return null;
    return getTotalScore(latestExam) - getTotalScore(previousExam);
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
    const improved: { name: string; change: number }[] = [];
    const declined: { name: string; change: number }[] = [];
    for (const curr of latestExam.subjects) {
      const prev = previousExam.subjects.find((s) => s.subject === curr.subject);
      if (prev) {
        const change = curr.totalScore - prev.totalScore;
        if (change > 0) improved.push({ name: getSubjectName(curr.subject), change });
        else if (change < 0) declined.push({ name: getSubjectName(curr.subject), change });
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

  const totalScore = getTotalScore(latestExam);
  const totalFull = getTotalFullScore(latestExam);

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
            <p className="text-xs text-white/50 mb-2">最新总分</p>
            <div className="flex items-end gap-2">
              <AnimatedNumber value={totalScore} className="text-3xl font-bold text-white" />
              <span className="text-sm text-white/30 mb-1">/ {totalFull}</span>
            </div>
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={item}>
          <ScoreRadarChart data={radarData} title="各科得分率" />
        </motion.div>

        <motion.div variants={item}>
          <GlassCard className="p-5 flex flex-col items-center" glow>
            <h3 className="mb-4 text-sm font-medium text-white/70 self-start">综合得分率</h3>
            <ProgressRing
              value={totalScore}
              max={totalFull}
              size={200}
              strokeWidth={12}
              label={`${totalScore} / ${totalFull}`}
              sublabel="总分"
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
                {d.name} +{d.change}
              </span>
            ))}
            {diagnosis.declined.map((d) => (
              <span
                key={d.name}
                className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1.5 text-sm text-red-400 border border-red-500/20"
              >
                <TrendingDown className="h-3.5 w-3.5" />
                {d.name} {d.change}
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
                  <th className="py-2 text-right text-white/40 font-normal">总分</th>
                  <th className="py-2 text-right text-white/40 font-normal">得分率</th>
                </tr>
              </thead>
              <tbody>
                {sortedExams.slice(0, 5).map((exam) => {
                  const total = getTotalScore(exam);
                  const full = getTotalFullScore(exam);
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
