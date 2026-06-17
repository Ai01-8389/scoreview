export const SUBJECT_CONFIG = {
  chinese: {
    name: '语文',
    fullScore: 150,
    category: 'required' as const,
    subCategories: [
      { name: '现代文阅读', fullScore: 35 },
      { name: '文言文阅读', fullScore: 35 },
      { name: '古诗文默写', fullScore: 6 },
      { name: '语言文字运用', fullScore: 20 },
      { name: '作文', fullScore: 54 },
    ],
  },
  math: {
    name: '数学',
    fullScore: 150,
    category: 'required' as const,
    subCategories: [
      { name: '单选题', fullScore: 40 },
      { name: '多选题', fullScore: 20 },
      { name: '填空题', fullScore: 20 },
      { name: '解答题', fullScore: 70 },
    ],
  },
  english: {
    name: '英语',
    fullScore: 150,
    category: 'required' as const,
    subCategories: [
      { name: '听力', fullScore: 30 },
      { name: '阅读理解', fullScore: 50 },
      { name: '语言运用', fullScore: 30 },
      { name: '写作', fullScore: 40 },
    ],
  },
  physics: {
    name: '物理',
    fullScore: 100,
    category: 'primary' as const,
    subCategories: [
      { name: '单选题', fullScore: 28 },
      { name: '多选题', fullScore: 18 },
      { name: '实验题', fullScore: 14 },
      { name: '计算题', fullScore: 40 },
    ],
  },
  history: {
    name: '历史',
    fullScore: 100,
    category: 'primary' as const,
    subCategories: [
      { name: '选择题', fullScore: 48 },
      { name: '非选择题', fullScore: 52 },
    ],
  },
  chemistry: {
    name: '化学',
    fullScore: 100,
    category: 'secondary' as const,
    subCategories: [
      { name: '选择题', fullScore: 42 },
      { name: '非选择题', fullScore: 58 },
    ],
  },
  biology: {
    name: '生物',
    fullScore: 100,
    category: 'secondary' as const,
    subCategories: [
      { name: '选择题', fullScore: 36 },
      { name: '非选择题', fullScore: 64 },
    ],
  },
  politics: {
    name: '政治',
    fullScore: 100,
    category: 'secondary' as const,
    subCategories: [
      { name: '选择题', fullScore: 48 },
      { name: '非选择题', fullScore: 52 },
    ],
  },
  geography: {
    name: '地理',
    fullScore: 100,
    category: 'secondary' as const,
    subCategories: [
      { name: '选择题', fullScore: 48 },
      { name: '非选择题', fullScore: 52 },
    ],
  },
} as const;

export type SubjectKey = keyof typeof SUBJECT_CONFIG;

export const PHYSICS_GROUP: SubjectKey[] = ['chinese', 'math', 'english', 'physics', 'chemistry', 'biology'];
export const HISTORY_GROUP: SubjectKey[] = ['chinese', 'math', 'english', 'history', 'politics', 'geography'];

export const SECONDARY_OPTIONS: SubjectKey[] = ['chemistry', 'biology', 'politics', 'geography'];

export function getSubjectsForGroup(
  group: 'physics' | 'history',
  secondaryChoices?: SubjectKey[]
): SubjectKey[] {
  if (group === 'physics') {
    return ['chinese', 'math', 'english', 'physics', ...(secondaryChoices || ['chemistry', 'biology'])];
  }
  return ['chinese', 'math', 'english', 'history', ...(secondaryChoices || ['politics', 'geography'])];
}

export function getSubjectName(key: string): string {
  return (SUBJECT_CONFIG as Record<string, { name: string }>)[key]?.name ?? key;
}

export function getSubjectFullScore(key: string): number {
  return (SUBJECT_CONFIG as Record<string, { fullScore: number }>)[key]?.fullScore ?? 100;
}
