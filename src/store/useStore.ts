import { create } from 'zustand';
import type { Exam, University, TargetUniversity } from '@/shared/types';
import { fetchApi, postApi, putApi, deleteApi } from '@/utils/api';

// Transform API snake_case to frontend camelCase
function transformExam(raw: any): Exam {
  return {
    id: raw.id,
    name: raw.name,
    date: raw.date,
    subjectGroup: raw.subject_group,
    subjects: (raw.subject_scores || []).map((ss: any) => ({
      id: ss.id,
      subject: ss.subject,
      totalScore: ss.total_score,
      fullScore: ss.full_score,
      subScores: (ss.sub_scores || []).map((sub: any) => ({
        id: sub.id,
        category: sub.category,
        score: sub.score,
        fullScore: sub.full_score,
      })),
    })),
    createdAt: raw.created_at,
  };
}

function transformTarget(raw: any): TargetUniversity {
  return {
    id: raw.id,
    universityId: raw.university_id,
    university: raw.university ? {
      id: raw.university.id,
      name: raw.university.name,
      province: raw.university.province,
      type: raw.university.type,
    } : undefined,
    subjectScores: (raw.subject_scores || []).map((ss: any) => ({
      subject: ss.subject,
      score: ss.score,
    })),
    createdAt: raw.created_at,
  };
}

interface AppState {
  exams: Exam[];
  targets: TargetUniversity[];
  universities: University[];
  currentExam: Exam | null;
  selectedSubject: string | null;
  loading: boolean;
  error: string | null;

  fetchExams: () => Promise<void>;
  fetchTargets: () => Promise<void>;
  fetchUniversities: () => Promise<void>;
  addExam: (exam: Omit<Exam, 'id' | 'createdAt'>) => Promise<Exam>;
  updateExam: (id: string, exam: Partial<Exam>) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;
  addTarget: (target: Omit<TargetUniversity, 'id' | 'createdAt'>) => Promise<TargetUniversity>;
  removeTarget: (id: string) => Promise<void>;
  setCurrentExam: (exam: Exam | null) => void;
  setSelectedSubject: (subject: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  exams: [],
  targets: [],
  universities: [],
  currentExam: null,
  selectedSubject: null,
  loading: false,
  error: null,

  fetchExams: async () => {
    set({ loading: true, error: null });
    try {
      const rawExams = await fetchApi<any[]>('/exams');
      const exams = rawExams.map(transformExam);
      set({ exams, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  fetchTargets: async () => {
    set({ loading: true, error: null });
    try {
      const rawTargets = await fetchApi<any[]>('/targets');
      const targets = rawTargets.map(transformTarget);
      set({ targets, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  fetchUniversities: async () => {
    set({ loading: true, error: null });
    try {
      const result = await fetchApi<{ total: number; items: any[] }>('/universities');
      const universities = result.items.map((u: any) => ({
        id: u.id,
        name: u.name,
        province: u.province,
        type: u.type,
      }));
      set({ universities, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  addExam: async (examData) => {
    const payload = {
      name: examData.name,
      date: examData.date,
      subject_group: examData.subjectGroup,
      subject_scores: examData.subjects.map((s) => ({
        subject: s.subject,
        total_score: s.totalScore,
        full_score: s.fullScore,
        sub_scores: s.subScores.map((sub) => ({
          category: sub.category,
          score: sub.score,
          full_score: sub.fullScore,
        })),
      })),
    };
    const raw = await postApi<any>('/exams', payload);
    const exam = transformExam(raw);
    set((state) => ({ exams: [...state.exams, exam] }));
    return exam;
  },

  updateExam: async (id, examData) => {
    const payload: any = {};
    if (examData.name !== undefined) payload.name = examData.name;
    if (examData.date !== undefined) payload.date = examData.date;
    if (examData.subjectGroup !== undefined) payload.subject_group = examData.subjectGroup;
    if (examData.subjects !== undefined) {
      payload.subject_scores = examData.subjects.map((s) => ({
        subject: s.subject,
        total_score: s.totalScore,
        full_score: s.fullScore,
        sub_scores: s.subScores.map((sub) => ({
          category: sub.category,
          score: sub.score,
          full_score: sub.fullScore,
        })),
      }));
    }
    const raw = await putApi<any>(`/exams/${id}`, payload);
    const updated = transformExam(raw);
    set((state) => ({
      exams: state.exams.map((e) => (e.id === id ? updated : e)),
      currentExam: state.currentExam?.id === id ? updated : state.currentExam,
    }));
  },

  deleteExam: async (id) => {
    await deleteApi(`/exams/${id}`);
    set((state) => ({
      exams: state.exams.filter((e) => e.id !== id),
      currentExam: state.currentExam?.id === id ? null : state.currentExam,
    }));
  },

  addTarget: async (targetData) => {
    const payload = {
      university_id: targetData.universityId,
      subject_scores: targetData.subjectScores.map((s) => ({
        subject: s.subject,
        score: s.score,
      })),
    };
    const raw = await postApi<any>('/targets', payload);
    const target = transformTarget(raw);
    set((state) => ({ targets: [...state.targets, target] }));
    return target;
  },

  removeTarget: async (id) => {
    await deleteApi(`/targets/${id}`);
    set((state) => ({ targets: state.targets.filter((t) => t.id !== id) }));
  },

  setCurrentExam: (exam) => set({ currentExam: exam }),
  setSelectedSubject: (subject) => set({ selectedSubject: subject }),
}));
