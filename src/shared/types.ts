export interface SubScore {
  id: string;
  category: string;
  score: number;
  fullScore: number;
}

export interface SubjectScore {
  id: string;
  subject: string;
  totalScore: number;
  fullScore: number;
  subScores: SubScore[];
}

export interface Exam {
  id: string;
  name: string;
  date: string;
  subjectGroup: 'physics' | 'history';
  subjects: SubjectScore[];
  createdAt: string;
}

export interface University {
  id: string;
  name: string;
  province: string;
  type: string;
}

export interface UniversityScore {
  id: string;
  universityId: string;
  year: number;
  totalMin: number;
  totalAvg: number;
  totalMax: number;
  subjects: UniversitySubjectScore[];
}

export interface UniversitySubjectScore {
  subject: string;
  minScore: number;
  avgScore: number;
  maxScore: number;
}

export interface TargetUniversity {
  id: string;
  universityId: string;
  university?: University;
  subjectScores: { subject: string; score: number }[];
  createdAt: string;
}

export interface OcrResult {
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
  rawText: string;
  confidence: number;
}
