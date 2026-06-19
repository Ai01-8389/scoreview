import { create } from 'zustand';
import type { Exam, University, TargetUniversity } from '@/shared/types';

const STORAGE_KEYS = {
  exams: 'gaokao-exams',
  targets: 'gaokao-targets',
} as const;

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('LocalStorage save failed:', e);
  }
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

export const useStore = create<AppState>((set, get) => ({
  exams: loadFromStorage<Exam[]>(STORAGE_KEYS.exams, []),
  targets: loadFromStorage<TargetUniversity[]>(STORAGE_KEYS.targets, []),
  universities: [],
  currentExam: null,
  selectedSubject: null,
  loading: false,
  error: null,

  fetchExams: async () => {
    set({ loading: true, error: null });
    try {
      const exams = loadFromStorage<Exam[]>(STORAGE_KEYS.exams, []);
      set({ exams, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  fetchTargets: async () => {
    set({ loading: true, error: null });
    try {
      const targets = loadFromStorage<TargetUniversity[]>(STORAGE_KEYS.targets, []);
      set({ targets, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  fetchUniversities: async () => {
    set({ loading: true, error: null });
    try {
      const baseUrl = import.meta.env.BASE_URL || '/';
      const res = await fetch(`${baseUrl}universities.json`);
      const universities: University[] = await res.json();
      set({ universities, loading: false });
    } catch (e) {
      console.error('Failed to load universities:', e);
      set({ universities: [], loading: false });
    }
  },

  addExam: async (examData) => {
    const exam: Exam = {
      ...examData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const exams = [...get().exams, exam];
    saveToStorage(STORAGE_KEYS.exams, exams);
    set({ exams });
    return exam;
  },

  updateExam: async (id, examData) => {
    const exams = get().exams.map((e) =>
      e.id === id ? { ...e, ...examData } : e
    );
    saveToStorage(STORAGE_KEYS.exams, exams);
    const updated = exams.find((e) => e.id === id)!;
    set((state) => ({
      exams,
      currentExam: state.currentExam?.id === id ? updated : state.currentExam,
    }));
  },

  deleteExam: async (id) => {
    const exams = get().exams.filter((e) => e.id !== id);
    saveToStorage(STORAGE_KEYS.exams, exams);
    set((state) => ({
      exams,
      currentExam: state.currentExam?.id === id ? null : state.currentExam,
    }));
  },

  addTarget: async (targetData) => {
    const target: TargetUniversity = {
      ...targetData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const targets = [...get().targets, target];
    saveToStorage(STORAGE_KEYS.targets, targets);
    set({ targets });
    return target;
  },

  removeTarget: async (id) => {
    const targets = get().targets.filter((t) => t.id !== id);
    saveToStorage(STORAGE_KEYS.targets, targets);
    set({ targets });
  },

  setCurrentExam: (exam) => set({ currentExam: exam }),
  setSelectedSubject: (subject) => set({ selectedSubject: subject }),
}));
