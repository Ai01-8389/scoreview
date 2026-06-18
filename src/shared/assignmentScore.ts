/**
 * 辽宁新高考3+1+2等级赋分制
 *
 * 再选科目（化学/生物/政治/地理）采用等级赋分：
 * - 按卷面分在选考该科目考生中的排名百分位划分等级
 * - 每个等级对应一个赋分区间
 * - 在等级内通过线性插值计算最终赋分
 *
 * 统考科目（语文/数学/英语）和首选科目（物理/历史）使用卷面原始分
 */

// 赋分等级表
export const SCORE_LEVELS = [
  { level: 'A',  percentileTop: 0.03,  scoreHigh: 100, scoreLow: 91 },
  { level: 'B+', percentileTop: 0.10,  scoreHigh: 90,  scoreLow: 81 },
  { level: 'B',  percentileTop: 0.25,  scoreHigh: 80,  scoreLow: 71 },
  { level: 'C+', percentileTop: 0.40,  scoreHigh: 70,  scoreLow: 61 },
  { level: 'C',  percentileTop: 0.55,  scoreHigh: 60,  scoreLow: 51 },
  { level: 'D+', percentileTop: 0.70,  scoreHigh: 50,  scoreLow: 41 },
  { level: 'D',  percentileTop: 0.85,  scoreHigh: 40,  scoreLow: 31 },
  { level: 'E',  percentileTop: 1.00,  scoreHigh: 30,  scoreLow: 21 },
] as const;

export type ScoreLevel = (typeof SCORE_LEVELS)[number]['level'];

export interface AssignedScoreResult {
  /** 赋分等级 */
  level: ScoreLevel;
  /** 赋分后分数 */
  assignedScore: number;
  /** 卷面原始分 */
  rawScore: number;
  /** 卷面满分 */
  fullScore: number;
  /** 对应等级的赋分区间 */
  scoreRange: { high: number; low: number };
  /** 估算百分位 */
  estimatedPercentile: number;
}

/**
 * 根据卷面分和估算百分位计算赋分
 * @param rawScore 卷面原始分
 * @param fullScore 卷面满分
 * @param percentile 估算百分位（0-1），即排名前百分之几
 * @returns 赋分结果
 */
export function calculateAssignedScore(
  rawScore: number,
  fullScore: number,
  percentile: number
): AssignedScoreResult {
  // 找到对应等级
  let prevTop = 0;
  let matchedLevel = SCORE_LEVELS[SCORE_LEVELS.length - 1];

  for (const levelDef of SCORE_LEVELS) {
    if (percentile <= levelDef.percentileTop) {
      matchedLevel = levelDef;
      break;
    }
    prevTop = levelDef.percentileTop;
  }

  // 在等级内线性插值
  const levelRange = matchedLevel.percentileTop - prevTop;
  const positionInLevel = levelRange > 0
    ? (percentile - prevTop) / levelRange
    : 0;

  // 排名越靠前（percentile越小），赋分越高
  // positionInLevel=0 表示等级内最顶部，赋分=scoreHigh
  // positionInLevel=1 表示等级内最底部，赋分=scoreLow
  const assignedScore = Math.round(
    matchedLevel.scoreHigh - positionInLevel * (matchedLevel.scoreHigh - matchedLevel.scoreLow)
  );

  return {
    level: matchedLevel.level,
    assignedScore: Math.max(matchedLevel.scoreLow, Math.min(matchedLevel.scoreHigh, assignedScore)),
    rawScore,
    fullScore,
    scoreRange: { high: matchedLevel.scoreHigh, low: matchedLevel.scoreLow },
    estimatedPercentile: percentile,
  };
}

/**
 * 根据卷面分和满分估算赋分（使用得分率近似百分位）
 * 注意：这是简化估算，实际赋分取决于全省排名分布
 * 得分率越高，百分位越低（排名越靠前）
 *
 * @param rawScore 卷面原始分
 * @param fullScore 卷面满分
 * @returns 赋分结果
 */
export function estimateAssignedScore(rawScore: number, fullScore: number): AssignedScoreResult {
  const scoreRate = fullScore > 0 ? rawScore / fullScore : 0;

  // 使用得分率估算百分位（简化模型）
  // 实际赋分取决于全省排名，这里用得分率近似
  // 得分率90%+ → 约前3%（A）
  // 得分率80-90% → 约前10-25%（B+/B）
  // 得分率70-80% → 约前25-55%（C+/C）
  // 得分率60-70% → 约前55-85%（D+/D）
  // 得分率60%以下 → 约85%以后（E）
  let estimatedPercentile: number;

  if (scoreRate >= 0.95) {
    estimatedPercentile = 0.01;
  } else if (scoreRate >= 0.90) {
    estimatedPercentile = 0.02 + (0.95 - scoreRate) / 0.05 * 0.03;
  } else if (scoreRate >= 0.85) {
    estimatedPercentile = 0.05 + (0.90 - scoreRate) / 0.05 * 0.05;
  } else if (scoreRate >= 0.80) {
    estimatedPercentile = 0.10 + (0.85 - scoreRate) / 0.05 * 0.10;
  } else if (scoreRate >= 0.75) {
    estimatedPercentile = 0.20 + (0.80 - scoreRate) / 0.05 * 0.10;
  } else if (scoreRate >= 0.70) {
    estimatedPercentile = 0.30 + (0.75 - scoreRate) / 0.05 * 0.10;
  } else if (scoreRate >= 0.65) {
    estimatedPercentile = 0.40 + (0.70 - scoreRate) / 0.05 * 0.15;
  } else if (scoreRate >= 0.60) {
    estimatedPercentile = 0.55 + (0.65 - scoreRate) / 0.05 * 0.15;
  } else if (scoreRate >= 0.55) {
    estimatedPercentile = 0.70 + (0.60 - scoreRate) / 0.05 * 0.10;
  } else if (scoreRate >= 0.50) {
    estimatedPercentile = 0.80 + (0.55 - scoreRate) / 0.05 * 0.05;
  } else if (scoreRate >= 0.40) {
    estimatedPercentile = 0.85 + (0.50 - scoreRate) / 0.10 * 0.10;
  } else {
    estimatedPercentile = 0.95 + (0.40 - scoreRate) / 0.40 * 0.05;
  }

  return calculateAssignedScore(rawScore, fullScore, estimatedPercentile);
}

/**
 * 获取赋分等级对应的颜色
 */
export function getLevelColor(level: ScoreLevel): string {
  const colors: Record<ScoreLevel, string> = {
    'A': '#10B981',
    'B+': '#34D399',
    'B': '#3B82F6',
    'C+': '#60A5FA',
    'C': '#F59E0B',
    'D+': '#FBBF24',
    'D': '#F97316',
    'E': '#EF4444',
  };
  return colors[level];
}

/**
 * 获取赋分等级对应的Tailwind类名
 */
export function getLevelTextClass(level: ScoreLevel): string {
  const classes: Record<ScoreLevel, string> = {
    'A': 'text-emerald-400',
    'B+': 'text-emerald-300',
    'B': 'text-blue-400',
    'C+': 'text-blue-300',
    'C': 'text-amber-400',
    'D+': 'text-amber-300',
    'D': 'text-orange-400',
    'E': 'text-red-400',
  };
  return classes[level];
}

/**
 * 获取赋分等级对应的背景类名
 */
export function getLevelBgClass(level: ScoreLevel): string {
  const classes: Record<ScoreLevel, string> = {
    'A': 'bg-emerald-500/10 border-emerald-500/20',
    'B+': 'bg-emerald-500/10 border-emerald-500/20',
    'B': 'bg-blue-500/10 border-blue-500/20',
    'C+': 'bg-blue-500/10 border-blue-500/20',
    'C': 'bg-amber-500/10 border-amber-500/20',
    'D+': 'bg-amber-500/10 border-amber-500/20',
    'D': 'bg-orange-500/10 border-orange-500/20',
    'E': 'bg-red-500/10 border-red-500/20',
  };
  return classes[level];
}

/**
 * 判断科目是否为再选科目（需要赋分）
 */
export function isSecondarySubject(subjectKey: string): boolean {
  return ['chemistry', 'biology', 'politics', 'geography'].includes(subjectKey);
}

/**
 * 赋分对照表数据（用于UI展示）
 */
export const ASSIGNMENT_TABLE = SCORE_LEVELS.map((level, i) => {
  const prevTop = i > 0 ? SCORE_LEVELS[i - 1].percentileTop : 0;
  return {
    level: level.level,
    percentileRange: `${(prevTop * 100).toFixed(0)}% ~ ${(level.percentileTop * 100).toFixed(0)}%`,
    scoreRange: `${level.scoreLow} ~ ${level.scoreHigh}`,
    proportion: `${((level.percentileTop - prevTop) * 100).toFixed(0)}%`,
  };
});
