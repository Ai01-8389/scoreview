import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  PenLine,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit3,
  Save,
  Camera,
  Sparkles,
  FileSpreadsheet,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  SUBJECT_CONFIG,
  getSubjectsForGroup,
  type SubjectKey,
} from '@/shared/subjects';
import { isSecondarySubject, estimateAssignedScore } from '@/shared/assignmentScore';
import type { OcrResult, SubjectScore } from '@/shared/types';

const TABS = [
  { key: 'manual', label: '手动录入', icon: PenLine },
  { key: 'excel', label: 'Excel导入', icon: FileSpreadsheet },
  { key: 'ocr', label: '截图识别', icon: Camera },
] as const;

type TabKey = (typeof TABS)[number]['key'];

interface ExcelImportResult {
  subjects: Array<{
    name: string;
    score: number;
    fullScore: number;
    subScores?: Array<{
      category: string;
      score: number;
      fullScore: number;
    }>;
  }>;
}

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

// Frontend Excel parsing
async function parseExcelFile(
  file: File,
  group: 'physics' | 'history'
): Promise<ExcelImportResult> {
  const XLSX = await import('xlsx');
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  const keys = getSubjectsForGroup(group);
  const subjects: ExcelImportResult['subjects'] = [];

  for (const key of keys) {
    const config = SUBJECT_CONFIG[key];
    const row = json.find((r) => {
      const subject = String(r['科目'] || r['学科'] || r['subject'] || '').trim();
      return subject === config.name;
    });

    const score = row ? Number(row['分数'] || row['得分'] || row['score'] || 0) : 0;
    const fullScore = row ? Number(row['满分'] || row['fullScore'] || config.fullScore) : config.fullScore;

    const subScores: ExcelImportResult['subjects'][0]['subScores'] = [];
    for (const sub of config.subCategories) {
      const subScore = row ? Number(row[sub.name] || 0) : 0;
      subScores.push({
        category: sub.name,
        score: subScore,
        fullScore: sub.fullScore,
      });
    }

    subjects.push({
      name: config.name,
      score,
      fullScore,
      subScores: subScores.some((s) => s.score > 0) ? subScores : undefined,
    });
  }

  return { subjects };
}

// Generate and download Excel template
async function downloadExcelTemplate(group: 'physics' | 'history') {
  const XLSX = await import('xlsx');
  const keys = getSubjectsForGroup(group);
  const rows = keys.map((key) => {
    const config = SUBJECT_CONFIG[key];
    const row: Record<string, unknown> = {
      '科目': config.name,
      '分数': '',
      '满分': config.fullScore,
    };
    for (const sub of config.subCategories) {
      row[sub.name] = '';
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '成绩');
  XLSX.writeFile(wb, `成绩录入模板_${group === 'physics' ? '物理类' : '历史类'}.xlsx`);
}

// Tesseract.js OCR
async function recognizeImageWithTesseract(file: File): Promise<OcrResult> {
  const Tesseract = await import('tesseract.js');
  const result = await Tesseract.recognize(file, 'chi_sim+eng', {
    logger: () => {},
  });

  const text = result.data.text;
  const lines = text.split('\n').filter((l: string) => l.trim());

  const subjectNames = Object.values(SUBJECT_CONFIG).map((c) => c.name);
  const subjects: OcrResult['subjects'] = [];

  for (const line of lines) {
    for (const name of subjectNames) {
      if (line.includes(name)) {
        const numbers = line.match(/\d+(\.\d+)?/g);
        if (numbers && numbers.length > 0) {
          const config = Object.values(SUBJECT_CONFIG).find((c) => c.name === name);
          if (config) {
            const score = Math.min(Number(numbers[0]), config.fullScore);
            subjects.push({
              name,
              score,
              fullScore: config.fullScore,
            });
          }
        }
        break;
      }
    }
  }

  return {
    subjects,
    rawText: text,
    confidence: result.data.confidence / 100,
  };
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

  // Excel state
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelResult, setExcelResult] = useState<ExcelImportResult | null>(null);
  const [excelError, setExcelError] = useState<string>('');

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

  const handleManualAssignedScoreChange = useCallback(
    (subjectId: string, value: number) => {
      setSubjects((prev) =>
        prev.map((s) =>
          s.id === subjectId
            ? { ...s, manualAssignedScore: value > 0 ? value : undefined }
            : s
        )
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
      const result = await recognizeImageWithTesseract(ocrImage);
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

  // Excel handlers
  const handleExcelDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      setExcelFile(file);
      setExcelResult(null);
      setExcelError('');
    }
  }, []);

  const handleExcelSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setExcelFile(file);
      setExcelResult(null);
      setExcelError('');
    }
  }, []);

  const handleExcelDownloadTemplate = () => {
    downloadExcelTemplate(subjectGroup);
  };

  const handleExcelUpload = async () => {
    if (!excelFile) return;
    setExcelLoading(true);
    setExcelError('');
    try {
      const result = await parseExcelFile(excelFile, subjectGroup);
      setExcelResult(result);
    } catch (e) {
      setExcelError((e as Error).message || '导入失败');
    } finally {
      setExcelLoading(false);
    }
  };

  const handleExcelSave = () => {
    if (!excelResult) return;
    const keys = getSubjectsForGroup(subjectGroup);
    const newSubjects: SubjectScore[] = keys.map((key) => {
      const config = SUBJECT_CONFIG[key];
      const matched = excelResult.subjects.find(
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
        <p className="mt-1 text-sm text-white/40">支持手动录入、Excel导入、截图识别三种方式</p>
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
              const isSec = isSecondarySubject(subject.subject);
              const assignedResult = isSec && subject.totalScore > 0
                ? estimateAssignedScore(subject.totalScore, subject.fullScore, subject.subject)
                : null;
              const hasManualAssigned = isSec && subject.manualAssignedScore !== undefined && subject.manualAssignedScore > 0;
              return (
                <GlassCard key={subject.id} className={`p-4 ${isSec ? 'border-cyan-500/10' : ''}`}>
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleExpand(subject.id)}
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-medium text-white/80">
                        {config?.name ?? subject.subject}
                      </span>
                      {isSec && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400/80 border border-cyan-500/20">
                          赋分
                        </span>
                      )}
                      <span className="text-xs text-white/30">
                        卷面 {subject.totalScore} / {subject.fullScore}
                      </span>
                      <span
                        className={`text-xs ${
                          rate >= 0.7 ? 'text-emerald-400' : rate >= 0.5 ? 'text-amber-400' : 'text-red-400'
                        }`}
                      >
                        {(rate * 100).toFixed(1)}%
                      </span>
                      {isSec && assignedResult && !hasManualAssigned && (
                        <span className="text-xs text-cyan-400">
                          → 预估赋分 {assignedResult.assignedScore}（{assignedResult.level}级）
                        </span>
                      )}
                      {hasManualAssigned && (
                        <span className="text-xs text-emerald-400">
                          → 赋分 {subject.manualAssignedScore}（手动录入）
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {isSec && (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[10px] text-cyan-400/60">赋分</span>
                          <input
                            type="number"
                            min={30}
                            max={100}
                            value={subject.manualAssignedScore ?? ''}
                            onChange={(e) =>
                              handleManualAssignedScoreChange(subject.id, Number(e.target.value))
                            }
                            className="w-14 text-right text-xs border border-cyan-500/20 rounded px-1 py-0.5 bg-cyan-500/5"
                            placeholder="—"
                          />
                        </div>
                      )}
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
                          {isSec && assignedResult && (
                            <div className="flex items-center justify-between rounded-lg bg-cyan-500/5 px-3 py-2 border border-cyan-500/10">
                              <span className="text-xs text-cyan-400/70">系统预估赋分</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-cyan-400">{assignedResult.assignedScore}</span>
                                <span className="text-xs text-white/30">（{assignedResult.level}级 · 区间{assignedResult.scoreRange.low}-{assignedResult.scoreRange.high}）</span>
                              </div>
                            </div>
                          )}
                          {isSec && (
                            <div className="flex items-center justify-between rounded-lg bg-emerald-500/5 px-3 py-2 border border-emerald-500/10">
                              <span className="text-xs text-emerald-400/70">手动录入赋分（优先）</span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={30}
                                  max={100}
                                  value={subject.manualAssignedScore ?? ''}
                                  onChange={(e) =>
                                    handleManualAssignedScoreChange(subject.id, Number(e.target.value))
                                  }
                                  className="w-16 text-right text-sm border border-emerald-500/20 rounded px-2 py-1 bg-emerald-500/5"
                                  placeholder="—"
                                />
                                <span className="text-xs text-white/30">/ 100</span>
                              </div>
                            </div>
                          )}
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

        {activeTab === 'excel' && (
          <motion.div
            key="excel"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white/70">Excel导入</h3>
                <GradientButton
                  variant="ghost"
                  size="sm"
                  onClick={handleExcelDownloadTemplate}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  下载模板
                </GradientButton>
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleExcelDrop}
                className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 hover:border-blue-500/30 transition-colors"
                onClick={() => document.getElementById('excel-file-input')?.click()}
              >
                {excelFile ? (
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-10 w-10 text-emerald-400" />
                    <div>
                      <p className="text-sm text-white/80">{excelFile.name}</p>
                      <p className="text-xs text-white/30">{(excelFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-white/20 mb-3" />
                    <p className="text-sm text-white/40">拖拽或点击上传Excel文件</p>
                    <p className="text-xs text-white/20 mt-1">支持 .xlsx、.xls、.csv 格式</p>
                  </>
                )}
              </div>
              <input
                id="excel-file-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleExcelSelect}
                className="hidden"
              />
              <div className="mt-4 flex gap-3">
                <GradientButton
                  onClick={handleExcelUpload}
                  disabled={!excelFile || excelLoading}
                >
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  {excelLoading ? '导入中...' : '导入'}
                </GradientButton>
                {excelFile && (
                  <GradientButton
                    variant="ghost"
                    onClick={() => {
                      setExcelFile(null);
                      setExcelResult(null);
                      setExcelError('');
                    }}
                  >
                    清除
                  </GradientButton>
                )}
              </div>

              {excelError && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                  <span className="text-sm text-red-400">{excelError}</span>
                </div>
              )}
            </GlassCard>

            {excelResult && (
              <GlassCard className="p-5">
                <h3 className="mb-3 text-sm font-medium text-white/70">导入预览</h3>
                <div className="space-y-2">
                  {excelResult.subjects.map((s, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                      <span className="text-sm text-white/70">{s.name}</span>
                      <span className="text-sm font-medium text-cyan-400">{s.score} / {s.fullScore}</span>
                    </div>
                  ))}
                </div>
                <GradientButton className="mt-4" onClick={handleExcelSave}>
                  确认并填入表单
                </GradientButton>
              </GlassCard>
            )}
          </motion.div>
        )}

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
                    <p className="text-xs text-white/20 mt-1">支持 JPG、PNG 格式（建议使用截图，拍照效果较差）</p>
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
                  {ocrLoading ? '识别中（首次加载较慢）...' : '识别'}
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
                {ocrResult.confidence < 0.5 && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="text-sm text-amber-400">识别置信度较低，请仔细核对并手动修正</span>
                  </div>
                )}
                <div className="space-y-2">
                  {ocrResult.subjects.map((s, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                      <span className="text-sm text-white/70">{s.name}</span>
                      <span className="text-sm font-medium text-cyan-400">{s.score} / {s.fullScore}</span>
                    </div>
                  ))}
                  {ocrResult.subjects.length === 0 && (
                    <p className="text-sm text-white/40">未识别到科目成绩，请手动录入</p>
                  )}
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
