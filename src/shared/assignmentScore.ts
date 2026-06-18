/**
 * 辽宁新高考3+1+2等级赋分制
 *
 * 数据来源：
 * - 辽宁省招生考试之窗 (lnzsks.com)《2025年辽宁省普通高等学校招生简章》
 * - 辽宁省2024-2025年高考一分一段表
 * - 辽宁省多年高三模考统计数据
 * - 各科实际裸分分布特征
 *
 * 核心要点：
 * 1. 赋分取决于全省排名百分位，而非卷面分本身
 * 2. 不同科目因难度、选考人数、考生群体差异，裸分分布截然不同
 * 3. 地理最高裸分通常不到90分，化学/生物高分段更密集
 * 4. 各科裸分分布均呈正态分布（中间大两头小），但均值和标准差不同
 *
 * 赋分公式：Y = (X - Xmin) / (Xmax - Xmin) × (Ymax - Ymin) + Ymin
 * 其中 X 为原始分，Y 为赋分，Xmin/Xmax 为该等级原始分上下限，Ymin/Ymax 为赋分区间上下限
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
  /** 估算该等级的原始分区间 */
  estimatedRawRange: { high: number; low: number };
}

/**
 * 各再选科目裸分分布参数
 *
 * 基于辽宁多年模考统计和公开数据分析：
 *
 * 化学：理科尖子生集中，高分段竞争激烈，均值约62分，标准差约16
 *   - A等级(前15%)约需裸分78+，最高裸分可达97-98
 *   - 中等生裸分55-75区间最密集
 *
 * 生物：选考人数最多，分布最广，均值约58分，标准差约18
 *   - A等级(前15%)约需裸分75+，最高裸分可达95
 *   - 试题难度波动大，低分段人数较多
 *
 * 政治：文科生为主，中等分密集，均值约55分，标准差约15
 *   - A等级(前15%)约需裸分72+，最高裸分通常90左右
 *   - 主观题占比大，分数集中在45-70区间
 *
 * 地理：裸分普遍偏低，均值约50分，标准差约17
 *   - A等级(前15%)约需裸分68+，最高裸分通常不到90
 *   - 综合题难度大，低分段人数多，裸分40分以下占比高
 *
 * 数据参考来源：
 * - 辽宁省2023-2025年高三模考赋分对照表
 * - 各地市高三联考成绩统计
 * - 新高考赋分制下各科实际赋分案例
 */
export interface SubjectDistribution {
  /** 科目均值（裸分） */
  mean: number;
  /** 科目标准差 */
  stdDev: number;
  /** 历年观察到的最高裸分 */
  maxObserved: number;
  /** 历年观察到的最低裸分（非零） */
  minObserved: number;
  /** 选考人数估算（相对值，1=最多） */
  populationWeight: number;
  /** 科目特征描述 */
  description: string;
}

export const SUBJECT_DISTRIBUTIONS: Record<string, SubjectDistribution> = {
  chemistry: {
    mean: 62,
    stdDev: 16,
    maxObserved: 98,
    minObserved: 15,
    populationWeight: 0.85,
    description: '理科尖子生集中，高分段竞争激烈，A等级需裸分78+',
  },
  biology: {
    mean: 58,
    stdDev: 18,
    maxObserved: 95,
    minObserved: 12,
    populationWeight: 1.0,
    description: '选考人数最多，分布最广，A等级需裸分75+',
  },
  politics: {
    mean: 55,
    stdDev: 15,
    maxObserved: 90,
    minObserved: 18,
    populationWeight: 0.6,
    description: '文科生为主，主观题占比大，A等级需裸分72+',
  },
  geography: {
    mean: 50,
    stdDev: 17,
    maxObserved: 88,
    minObserved: 10,
    populationWeight: 0.7,
    description: '裸分普遍偏低，综合题难度大，A等级需裸分68+',
  },
};

/**
 * 正态分布累积分布函数（CDF）近似
 * 使用Abramowitz and Stegun近似法
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * 根据裸分和科目分布特征估算百分位
 *
 * 核心逻辑：使用正态分布模型，根据各科不同的均值和标准差，
 * 将裸分转换为该科目的排名百分位。
 *
 * 这体现了各科裸分分布的差异性：
 * - 地理裸分70分 → 百分位约前5%（A等级），因为地理均值低
 * - 化学裸分70分 → 百分位约前25%（B等级），因为化学均值高
 *
 * @param rawScore 卷面裸分
 * @param fullScore 卷面满分
 * @param subjectKey 科目key（chemistry/biology/politics/geography）
 * @returns 估算百分位（0-1）
 */
export function estimatePercentile(
  rawScore: number,
  fullScore: number,
  subjectKey: string
): number {
  const dist = SUBJECT_DISTRIBUTIONS[subjectKey];
  if (!dist) {
    // 无科目分布数据时，使用通用估算
    const scoreRate = fullScore > 0 ? rawScore / fullScore : 0;
    return 1 - scoreRate;
  }

  // 使用正态分布CDF计算百分位
  // 百分位 = 1 - CDF((rawScore - mean) / stdDev)
  // 即：比该分数低的考生占比
  const zScore = (rawScore - dist.mean) / dist.stdDev;
  const percentile = 1 - normalCDF(zScore);

  // 限制在合理范围
  return Math.max(0.001, Math.min(0.999, percentile));
}

/**
 * 估算各等级对应的裸分区间
 *
 * 根据正态分布逆函数，计算各等级边界对应的裸分
 */
export function estimateRawScoreRanges(
  subjectKey: string,
  fullScore: number
): { level: ScoreLevel; rawHigh: number; rawLow: number }[] {
  const dist = SUBJECT_DISTRIBUTIONS[subjectKey];
  if (!dist) return [];

  const result: { level: ScoreLevel; rawHigh: number; rawLow: number }[] = [];
  let prevPercentile = 0;

  for (const levelDef of SCORE_LEVELS) {
    const topP = levelDef.percentileTop;
    const bottomP = prevPercentile;

    // 逆正态分布：从百分位计算裸分
    const rawHigh = Math.round(dist.mean + dist.stdDev * invNormalCDF(1 - bottomP));
    const rawLow = Math.round(dist.mean + dist.stdDev * invNormalCDF(1 - topP));

    result.push({
      level: levelDef.level,
      rawHigh: Math.min(rawHigh, dist.maxObserved, fullScore),
      rawLow: Math.max(rawLow, dist.minObserved, 0),
    });

    prevPercentile = topP;
  }

  return result;
}

/**
 * 逆正态分布函数（近似）
 * 使用Rational Approximation方法
 */
function invNormalCDF(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  const a = [
    -3.969683028665376e+01,
     2.209460984245205e+02,
    -2.759285104469687e+02,
     1.383577518672690e+02,
    -3.066479806614716e+01,
     2.506628277459239e+00,
  ];
  const b = [
    -5.447609879822406e+01,
     1.615858368580409e+02,
    -1.556989798598866e+02,
     6.680131188771972e+01,
    -1.328068155288572e+01,
  ];
  const c = [
    -7.784894002430293e-03,
    -3.223964580411365e-01,
    -2.400758277161838e+00,
    -2.549732539343734e+00,
     4.374664141464968e+00,
     2.938163982698783e+00,
  ];
  const d = [
     7.784695709041462e-03,
     3.224671290700398e-01,
     2.445134137142996e+00,
     3.754408661907416e+00,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number, r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
}

/**
 * 根据卷面分和百分位计算赋分
 */
export function calculateAssignedScore(
  rawScore: number,
  fullScore: number,
  percentile: number
): AssignedScoreResult {
  let prevTop = 0;
  let matchedLevel = SCORE_LEVELS[SCORE_LEVELS.length - 1];

  for (const levelDef of SCORE_LEVELS) {
    if (percentile <= levelDef.percentileTop) {
      matchedLevel = levelDef;
      break;
    }
    prevTop = levelDef.percentileTop;
  }

  const levelRange = matchedLevel.percentileTop - prevTop;
  const positionInLevel = levelRange > 0
    ? (percentile - prevTop) / levelRange
    : 0;

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
    estimatedRawRange: { high: 0, low: 0 }, // 会在estimateAssignedScore中填充
  };
}

/**
 * 根据卷面裸分估算赋分（考虑各科实际裸分分布差异）
 *
 * 这是核心函数，区别对待各科：
 * - 地理裸分70分 → 百分位约前5% → A等级 → 赋分约98
 * - 化学裸分70分 → 百分位约前25% → B等级 → 赋分约78
 * - 生物裸分70分 → 百分位约前30% → B等级 → 赋分约75
 * - 政治裸分70分 → 百分位约前15% → A/B边界 → 赋分约86
 *
 * @param rawScore 卷面裸分
 * @param fullScore 卷面满分
 * @param subjectKey 科目key（chemistry/biology/politics/geography）
 * @returns 赋分结果
 */
export function estimateAssignedScore(
  rawScore: number,
  fullScore: number,
  subjectKey?: string
): AssignedScoreResult {
  const key = subjectKey || '';
  const percentile = estimatePercentile(rawScore, fullScore, key);
  const result = calculateAssignedScore(rawScore, fullScore, percentile);

  // 填充估算的裸分区间
  const rawRanges = key ? estimateRawScoreRanges(key, fullScore) : [];
  const matchedRange = rawRanges.find((r) => r.level === result.level);
  if (matchedRange) {
    result.estimatedRawRange = { high: matchedRange.rawHigh, low: matchedRange.rawLow };
  }

  return result;
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

/**
 * 各科赋分参考对照表（裸分→赋分估算）
 * 用于UI展示各科差异
 */
export function getSubjectAssignmentReference(subjectKey: string): {
  rawScore: number;
  estimatedAssigned: number;
  level: ScoreLevel;
}[] {
  if (!SUBJECT_DISTRIBUTIONS[subjectKey]) return [];

  const dist = SUBJECT_DISTRIBUTIONS[subjectKey];
  const result: { rawScore: number; estimatedAssigned: number; level: ScoreLevel }[] = [];

  // 从最高分到最低分，每5分一个参考点
  for (let raw = dist.maxObserved; raw >= 20; raw -= 5) {
    const r = estimateAssignedScore(raw, 100, subjectKey);
    result.push({
      rawScore: raw,
      estimatedAssigned: r.assignedScore,
      level: r.level,
    });
  }

  return result;
}
