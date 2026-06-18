import type { Exam, SubjectScore } from '@/shared/types';
import { isSecondarySubject, estimateAssignedScore } from '@/shared/assignmentScore';

/**
 * 为考试中的再选科目计算赋分
 */
export function calculateExamAssignedScores(exam: Exam): Exam {
  return {
    ...exam,
    subjects: exam.subjects.map((s) => {
      if (!isSecondarySubject(s.subject)) return s;
      const result = estimateAssignedScore(s.totalScore, s.fullScore);
      return {
        ...s,
        assignedScore: result.assignedScore,
        assignedLevel: result.level,
      };
    }),
  };
}

/**
 * 获取科目的有效分数（再选科目用赋分，其他用原始分）
 */
export function getEffectiveScore(subject: SubjectScore): number {
  if (isSecondarySubject(subject.subject) && subject.assignedScore !== undefined) {
    return subject.assignedScore;
  }
  return subject.totalScore;
}

/**
 * 计算考试有效总分（再选科目使用赋分）
 */
export function getEffectiveTotalScore(exam: Exam): number {
  return exam.subjects.reduce((sum, s) => sum + getEffectiveScore(s), 0);
}

/**
 * 计算考试有效满分（再选科目满分按赋分制100分计）
 */
export function getEffectiveFullScore(exam: Exam): number {
  return exam.subjects.reduce((sum, s) => {
    if (isSecondarySubject(s.subject)) return sum + 100;
    return sum + s.fullScore;
  }, 0);
}
