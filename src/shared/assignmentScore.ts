/**
 * 辽宁新高考3+1+2等级赋分制
 *
 * 数据来源：辽宁省招生考试之窗 (lnzsks.com)
 * 《2025年辽宁省普通高等学校招生简章》
 *
 * 再选科目（化学/生物/政治/地理）采用等级赋分：
 * - 按卷面分在选考该科目考生中的排名百分位划分5个等级
 * - 每个等级对应一个赋分区间
 * - 在等级内通过线性转换公式计算最终赋分
 *
 * 赋分公式：Y = (X - Xmin) / (Xmax - Xmin) × (Ymax - Ymin) + Ymin
 * 其中 X 为原始分，Y 为赋分，Xmin/Xmax 为该等级原始分上下限，Ymin/Ymax 为赋分区间上下限
 *
 * 统考科目（语文/数学/英语）和首选科目（物理/历史）使用卷面原始分
 */

// 辽宁官方5等级赋分表
export const SCORE_LEVELS = [
  { level: 'A', percentileTop: 0.15, scoreHigh: 100, scoreLow: 86 },
  { level: 'B', percentileTop: 0.50, scoreHigh: 85,  scoreLow: 71 },
  { level: 'C', percentileTop: 0.85, scoreHigh: 70,  scoreLow: 56 },
  { level: 'D', percentileTop: 0.98, scoreHigh: 55,  scoreLow: 41 },
  { level: 'E', percentileTop: 1.00, scoreHigh: 40,  scoreLow: 30 },
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
 *
 * 注意：实际赋分取决于全省排名分布，这里用得分率近似估算。
 * 得分率越高，百分位越低（排名越靠前）。
 *
 * 估算模型基于辽宁历年一分一段表数据分布特征：
 * - 高分段（90%+）人数稀少，对应A等级
 * - 中分段（70%-90%）人数密集，对应B/C等级
 * - 低分段（60%以下）人数逐渐减少，对应D/E等级
 *
 * @param rawScore 卷面原始分
 * @param fullScore 卷面满分
 * @returns 赋分结果
 */
export function estimateAssignedScore(rawScore: number, fullScore: number): AssignedScoreResult {
  const scoreRate = fullScore > 0 ? rawScore / fullScore : 0;

  // 基于辽宁历年一分一段表数据分布特征的估算模型
  let estimatedPercentile: number;

  if (scoreRate >= 0.97) {
    estimatedPercentile = 0.01;
  } else if (scoreRate >= 0.93) {
    estimatedPercentile = 0.03 + (0.97 - scoreRate) / 0.04 * 0.07;
  } else if (scoreRate >= 0.90) {
    estimatedPercentile = 0.10 + (0.93 - scoreRate) / 0.03 * 0.05;
  } else if (scoreRate >= 0.85) {
    estimatedPercentile = 0.15 + (0.90 - scoreRate) / 0.05 * 0.10;
  } else if (scoreRate >= 0.80) {
    estimatedPercentile = 0.25 + (0.85 - scoreRate) / 0.05 * 0.10;
  } else if (scoreRate >= 0.75) {
    estimatedPercentile = 0.35 + (0.80 - scoreRate) / 0.05 * 0.10;
  } else if (scoreRate >= 0.70) {
    estimatedPercentile = 0.45 + (0.75 - scoreRate) / 0.05 * 0.10;
  } else if (scoreRate >= 0.65) {
    estimatedPercentile = 0.55 + (0.70 - scoreRate) / 0.05 * 0.12;
  } else if (scoreRate >= 0.60) {
    estimatedPercentile = 0.67 + (0.65 - scoreRate) / 0.05 * 0.10;
  } else if (scoreRate >= 0.55) {
    estimatedPercentile = 0.77 + (0.60 - scoreRate) / 0.05 * 0.08;
  } else if (scoreRate >= 0.50) {
    estimatedPercentile = 0.85 + (0.55 - scoreRate) / 0.05 * 0.06;
  } else if (scoreRate >= 0.40) {
    estimatedPercentile = 0.91 + (0.50 - scoreRate) / 0.10 * 0.05;
  } else if (scoreRate >= 0.30) {
    estimatedPercentile = 0.96 + (0.40 - scoreRate) / 0.10 * 0.02;
  } else {
    estimatedPercentile = 0.98 + (0.30 - scoreRate) / 0.30 * 0.02;
  }

  return calculateAssignedScore(rawScore, fullScore, estimatedPercentile);
}

/**
 * 获取赋分等级对应的颜色
 */
export function getLevelColor(level: ScoreLevel): string {
  const colors: Record<ScoreLevel, string> = {
    'A': '#10B981',
    'B': '#3B82F6',
    'C': '#F59E0B',
    'D': '#F97316',
    'E': '#EF4444',
  };
  return colors[level];
}

/**
 * 获取赋分等级对应的Tailwind文字类名
 */
export function getLevelTextClass(level: ScoreLevel): string {
  const classes: Record<ScoreLevel, string> = {
    'A': 'text-emerald-400',
    'B': 'text-blue-400',
    'C': 'text-amber-400',
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
    'B': 'bg-blue-500/10 border-blue-500/20',
    'C': 'bg-amber-500/10 border-amber-500/20',
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
 * 数据来源：辽宁省招生考试之窗官方发布
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
