import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  PenLine,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit3,
  Save,
  Camera,
  Sparkles,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { uploadImage, postApi } from '@/utils/api';
import {
  SUBJECT_CONFIG,
  getSubjectsForGroup,
  type SubjectKey,
} from '@/shared/subjects';
import type { OcrResult, SubjectScore } from '@/shared/types';

const TABS = [
  { key: 'ocr', label: '截图识别', icon: Camera },
  { key: 'text', label: '文字录入', icon: FileText },
  { key: 'manual', label: '手动录入', icon: PenLine },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

function createEmptySubjects(group: 'physics' | 'history'): SubjectScore[] {
  const keys = getSubjectsForGroup(group);
  return keys.map((key) => {
    const config = SUBJECT_CONFIG[key];
    return {
      id: crypto.randomUUID(),
      subject: key,
      totalScore: 0,
      fullScore: config.fullScore,
      subScores: config.subCategories.map((sub) => ({
        id: crypto.randomUUID(),
        category: sub.name,
        score: 0,
        fullScore: sub.fullScore,
      })),
    };
  });
}

export default function ScoreInput() {
  const { exams, fetchExams, addExam, deleteExam } = useStore();
  const [activeTab, setActiveTab] = useState<TabKey>('manual');

  // Manual form state
  const [examName, setExamName] = useState('');
  const [examDate, setExamDate] = useState(new Date().toISOString().split('T')[0]);
  const [subjectGroup, setSubjectGroup] = useState<'physics' | 'history'>('physics');
  const [subjects, setSubjects] = useState<SubjectScore[]>(createEmptySubjects('physics'));
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // OCR state
  const [ocrImage, setOcrImage] = useState<File | null>(null);
  const [ocrPreview, setOcrPreview] = useState<string>('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);

  // Text parse state
  const [textInput, setTextInput] = useState('');
  const [textLoading, setTextLoading] = useState(false);
  const [textResult, setTextResult] = useState<OcrResult | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  useEffect(() => {
    setSubjects(createEmptySubjects(subjectGroup));
    setExpandedSubjects(new Set());
  }, [subjectGroup]);

  const handleSubjectScoreChange = useCallback(
    (subjectId: string, value: number) => {
      setSubjects((prev) =>
        prev.map((s) => (s.id === subjectId ? { ...s, totalScore: value } : s))
      );
    },
    []
  );

  const handleSubScoreChange = useCallback(
    (subjectId: string, subId: string, value: number) => {
      setSubjects((prev) =>
        prev.map((s) => {
          if (s.id !== subjectId) return s;
          const newSubScores = s.subScores.map((sub) =>
            sub.id === subId ? { ...sub, score: value } : sub
          );
          const totalScore = newSubScores.reduce((sum, sub) => sum + sub.score, 0);
          return { ...s, subScores: newSubScores, totalScore };
        })
      );
    },
    []
  );

  const toggleExpand = useCallback((subjectId: string) => {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (!examName.trim()) return;
    setSaving(true);
    try {
      await addExam({
        name: examName,
        date: examDate,
        subjectGroup,
        subjects,
      });
      setExamName('');
      setSubjects(createEmptySubjects(subjectGroup));
      setExpandedSubjects(new Set());
    } catch (e) {
      console.error('保存失败', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteExam(id);
  };

  // OCR handlers
  const handleImageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setOcrImage(file);
      setOcrPreview(URL.createObjectURL(file));
      setOcrResult(null);
    }
  }, []);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setOcrImage(file);
      setOcrPreview(URL.createObjectURL(file));
      setOcrResult(null);
    }
  }, []);

  const handleOcrRecognize = async () => {
    if (!ocrImage) return;
    setOcrLoading(true);
    try {
      const result = await uploadImage<OcrResult>('/ocr/screenshot', ocrImage);
      setOcrResult(result);
    } catch (e) {
      console.error('识别失败', e);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleOcrSave = () => {
    if (!ocrResult) return;
    const keys = getSubjectsForGroup(subjectGroup);
    const newSubjects: SubjectScore[] = keys.map((key) => {
      const config = SUBJECT_CONFIG[key];
      const matched = ocrResult.subjects.find(
        (s) => s.name === config.name
      );
      return {
        id: crypto.randomUUID(),
        subject: key,
        totalScore: matched?.score ?? 0,
        fullScore: config.fullScore,
        subScores: matched?.subScores
          ? matched.subScores.map((sub, i) => ({
              id: crypto.randomUUID(),
              category: sub.category || config.subCategories[i]?.name || `题目${i + 1}`,
              score: sub.score,
              fullScore: sub.fullScore,
            }))
          : config.subCategories.map((sub) => ({
              id: crypto.randomUUID(),
              category: sub.name,
              score: 0,
              fullScore: sub.fullScore,
            })),
      };
    });
    setSubjects(newSubjects);
    setActiveTab('manual');
  };

  // Text parse handlers
  const handleTextParse = async () => {
    if (!textInput.trim()) return;
    setTextLoading(true);
    try {
      const result = await postApi<OcrResult>('/ocr/text', { text: textInput });
      setTextResult(result);
    } catch (e) {
      console.error('解析失败', e);
    } finally {
      setTextLoading(false);
    }
  };

  const handleTextSave = () => {
    if (!textResult) return;
    const keys = getSubjectsForGroup(subjectGroup);
    const newSubjects: SubjectScore[] = keys.map((key) => {
      const config = SUBJECT_CONFIG[key];
      const matched = textResult.subjects.find((s) => s.name === config.name);
      return {
        id: crypto.randomUUID(),
        subject: key,
        totalScore: matched?.score ?? 0,
        fullScore: config.fullScore,
        subScores: config.subCategories.map((sub) => ({
          id: crypto.randomUUID(),
          category: sub.name,
          score: 0,
          fullScore: sub.fullScore,
        })),
      };
    });
    setSubjects(newSubjects);
    setActiveTab('manual');
  };

  const sortedExams = [...exams].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <motion.div
      className="p-6 space-y-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold gradient-text">成绩录入</h1>
        <p className="mt-1 text-sm text-white/40">支持截图识别、文字粘贴、手动输入三种方式</p>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={item} className="flex gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-white border border-blue-500/30'
                  : 'text-white/50 hover:text-white/80 bg-white/5 border border-white/5'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </motion.div>

      {/* Common fields */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="mb-1 block text-xs text-white/50">考试名称</label>
          <input
            type="text"
            value={examName}
            onChange={(e) => setExamName(e.target.value)}
            placeholder="如：高三一模"
            className="w-full"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">考试日期</label>
          <input
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            className="w-full"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">选科组合</label>
          <select
            value={subjectGroup}
            onChange={(e) => setSubjectGroup(e.target.value as 'physics' | 'history')}
            className="w-full"
          >
            <option value="physics">物理类 (3+1+2)</option>
            <option value="history">历史类 (3+1+2)</option>
          </select>
        </div>
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'ocr' && (
          <motion.div
            key="ocr"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            <GlassCard className="p-5">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleImageDrop}
                className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 hover:border-blue-500/30 transition-colors"
                onClick={() => document.getElementById('ocr-file-input')?.click()}
              >
                {ocrPreview ? (
                  <img src={ocrPreview} alt="预览" className="max-h-[300px] rounded-lg object-contain" />
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-white/20 mb-3" />
                    <p className="text-sm text-white/40">拖拽或点击上传成绩截图</p>
                    <p className="text-xs text-white/20 mt-1">支持 JPG、PNG 格式</p>
                  </>
                )}
              </div>
              <input
                id="ocr-file-input"
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <div className="mt-4 flex gap-3">
                <GradientButton
                  onClick={handleOcrRecognize}
                  disabled={!ocrImage || ocrLoading}
                >
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  {ocrLoading ? '识别中...' : '识别'}
                </GradientButton>
                {ocrImage && (
                  <GradientButton
                    variant="ghost"
                    onClick={() => {
                      setOcrImage(null);
                      setOcrPreview('');
                      setOcrResult(null);
                    }}
                  >
                    清除
                  </GradientButton>
                )}
              </div>
            </GlassCard>

            {ocrResult && (
              <GlassCard className="p-5">
                <h3 className="mb-3 text-sm font-medium text-white/70">识别结果</h3>
                <div className="space-y-2">
                  {ocrResult.subjects.map((s, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                      <span className="text-sm text-white/70">{s.name}</span>
                      <span className="text-sm font-medium text-cyan-400">{s.score} / {s.fullScore}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-white/30">
                  置信度: {(ocrResult.confidence * 100).toFixed(0)}%
                </div>
                <GradientButton className="mt-4" onClick={handleOcrSave}>
                  确认并填入表单
                </GradientButton>
              </GlassCard>
            )}
          </motion.div>
        )}

        {activeTab === 'text' && (
          <motion.div
            key="text"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            <GlassCard className="p-5">
              <label className="mb-2 block text-sm text-white/70">粘贴成绩文字</label>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={"如：语文120 数学135 英语130 物理85 化学90 生物88"}
                rows={5}
                className="w-full resize-none"
              />
              <div className="mt-3 flex gap-3">
                <GradientButton onClick={handleTextParse} disabled={!textInput.trim() || textLoading}>
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  {textLoading ? '解析中...' : '解析'}
                </GradientButton>
              </div>
            </GlassCard>

            {textResult && (
              <GlassCard className="p-5">
                <h3 className="mb-3 text-sm font-medium text-white/70">解析结果</h3>
                <div className="space-y-2">
                  {textResult.subjects.map((s, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                      <span className="text-sm text-white/70">{s.name}</span>
                      <span className="text-sm font-medium text-cyan-400">{s.score} / {s.fullScore}</span>
                    </div>
                  ))}
                </div>
                <GradientButton className="mt-4" onClick={handleTextSave}>
                  确认并填入表单
                </GradientButton>
              </GlassCard>
            )}
          </motion.div>
        )}

        {activeTab === 'manual' && (
          <motion.div
            key="manual"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {subjects.map((subject) => {
              const isExpanded = expandedSubjects.has(subject.id);
              const config = SUBJECT_CONFIG[subject.subject as SubjectKey];
              const rate = subject.fullScore > 0 ? subject.totalScore / subject.fullScore : 0;
              return (
                <GlassCard key={subject.id} className="p-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleExpand(subject.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-white/80">
                        {config?.name ?? subject.subject}
                      </span>
                      <span className="text-xs text-white/30">
                        {subject.totalScore} / {subject.fullScore}
                      </span>
                      <span
                        className={`text-xs ${
                          rate >= 0.7 ? 'text-emerald-400' : rate >= 0.5 ? 'text-amber-400' : 'text-red-400'
                        }`}
                      >
                        {(rate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={0}
                        max={subject.fullScore}
                        value={subject.totalScore || ''}
                        onChange={(e) =>
                          handleSubjectScoreChange(subject.id, Number(e.target.value))
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="w-20 text-right"
                        placeholder="0"
                      />
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-white/40" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-white/40" />
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
                          {subject.subScores.map((sub) => (
                            <div
                              key={sub.id}
                              className="flex items-center justify-between"
                            >
                              <span className="text-xs text-white/50">{sub.category}</span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={sub.fullScore}
                                  value={sub.score || ''}
                                  onChange={(e) =>
                                    handleSubScoreChange(
                                      subject.id,
                                      sub.id,
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-16 text-right text-xs"
                                  placeholder="0"
                                />
                                <span className="text-xs text-white/30">/ {sub.fullScore}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </GlassCard>
              );
            })}

            <GradientButton size="lg" onClick={handleSave} disabled={saving || !examName.trim()}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? '保存中...' : '保存成绩'}
            </GradientButton>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History exams */}
      <motion.div variants={item}>
        <GlassCard className="p-5">
          <h3 className="mb-4 text-sm font-medium text-white/70">历史考试记录</h3>
          {sortedExams.length === 0 ? (
            <EmptyState title="暂无记录" description="录入成绩后将在此显示" />
          ) : (
            <div className="space-y-2">
              {sortedExams.map((exam) => (
                <div
                  key={exam.id}
                  className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 hover:bg-white/8 transition-colors"
                >
                  <div>
                    <p className="text-sm text-white/80">{exam.name}</p>
                    <p className="text-xs text-white/40">
                      {exam.date} · {exam.subjectGroup === 'physics' ? '物理类' : '历史类'} · 总分{' '}
                      {exam.subjects.reduce((s, sub) => s + sub.totalScore, 0)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingId(editingId === exam.id ? null : exam.id)}
                      className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white/60 transition-colors"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(exam.id)}
                      className="rounded-lg p-1.5 text-white/30 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
