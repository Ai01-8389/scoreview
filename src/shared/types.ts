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
  /** 再选科目赋分后分数（化学/生物/政治/地理） */
  assignedScore?: number;
  /** 赋分等级 */
  assignedLevel?: string;
  /** 用户手动录入的赋分（优先于系统计算） */
  manualAssignedScore?: number;
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
