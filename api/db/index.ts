import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.resolve(__dirname, '../../data')
mkdirSync(dataDir, { recursive: true })

const dbPath = path.join(dataDir, 'score-analysis.db')

const db = new Database(dbPath)

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      subject_group TEXT NOT NULL CHECK(subject_group IN ('physics', 'history')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subject_scores (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      total_score REAL NOT NULL,
      full_score REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sub_scores (
      id TEXT PRIMARY KEY,
      subject_score_id TEXT NOT NULL REFERENCES subject_scores(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      score REAL NOT NULL,
      full_score REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS universities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      province TEXT NOT NULL,
      type TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS university_scores (
      id TEXT PRIMARY KEY,
      university_id TEXT NOT NULL REFERENCES universities(id),
      year INTEGER NOT NULL,
      total_min REAL,
      total_avg REAL,
      total_max REAL
    );

    CREATE TABLE IF NOT EXISTS university_subject_scores (
      id TEXT PRIMARY KEY,
      university_score_id TEXT NOT NULL REFERENCES university_scores(id),
      subject TEXT NOT NULL,
      min_score REAL,
      avg_score REAL,
      max_score REAL
    );

    CREATE TABLE IF NOT EXISTS target_universities (
      id TEXT PRIMARY KEY,
      university_id TEXT NOT NULL REFERENCES universities(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS target_subject_scores (
      id TEXT PRIMARY KEY,
      target_id TEXT NOT NULL REFERENCES target_universities(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      score REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_status (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      last_sync_at DATETIME,
      record_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'idle'
    );

    CREATE TABLE IF NOT EXISTS gaokao_admission_scores (
      id TEXT PRIMARY KEY,
      university_id TEXT NOT NULL REFERENCES universities(id),
      year INTEGER NOT NULL,
      category TEXT NOT NULL,
      batch TEXT NOT NULL,
      min_score REAL,
      min_rank INTEGER,
      avg_score REAL,
      UNIQUE(university_id, year, category, batch)
    );
  `)

  // Add gaokao_id column to universities if not exists
  const columns = db.prepare("PRAGMA table_info(universities)").all() as { name: string }[]
  if (!columns.some(col => col.name === 'gaokao_id')) {
    db.exec('ALTER TABLE universities ADD COLUMN gaokao_id TEXT')
  }

  seedUniversities()
}

function seedUniversities() {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM universities').get() as { cnt: number }
  if (count.cnt > 0) return

  const insertUniversity = db.prepare(
    'INSERT INTO universities (id, name, province, type) VALUES (?, ?, ?, ?)'
  )
  const insertUniversityScore = db.prepare(
    'INSERT INTO university_scores (id, university_id, year, total_min, total_avg, total_max) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const insertSubjectScore = db.prepare(
    'INSERT INTO university_subject_scores (id, university_score_id, subject, min_score, avg_score, max_score) VALUES (?, ?, ?, ?, ?, ?)'
  )

  const universities = [
    { id: 'u1', name: '清华大学', province: '北京', type: '985,211,双一流' },
    { id: 'u2', name: '北京大学', province: '北京', type: '985,211,双一流' },
    { id: 'u3', name: '复旦大学', province: '上海', type: '985,211,双一流' },
    { id: 'u4', name: '上海交通大学', province: '上海', type: '985,211,双一流' },
    { id: 'u5', name: '浙江大学', province: '浙江', type: '985,211,双一流' },
    { id: 'u6', name: '南京大学', province: '江苏', type: '985,211,双一流' },
    { id: 'u7', name: '大连理工大学', province: '辽宁', type: '985,211,双一流' },
    { id: 'u8', name: '东北大学', province: '辽宁', type: '985,211,双一流' },
    { id: 'u9', name: '吉林大学', province: '吉林', type: '985,211,双一流' },
    { id: 'u10', name: '哈尔滨工业大学', province: '黑龙江', type: '985,211,双一流' },
    { id: 'u11', name: '辽宁大学', province: '辽宁', type: '211,双一流' },
    { id: 'u12', name: '大连海事大学', province: '辽宁', type: '211,双一流' },
    { id: 'u13', name: '中国医科大学', province: '辽宁', type: '普通' },
    { id: 'u14', name: '东北财经大学', province: '辽宁', type: '普通' },
    { id: 'u15', name: '沈阳工业大学', province: '辽宁', type: '普通' },
    { id: 'u16', name: '辽宁师范大学', province: '辽宁', type: '普通' },
    { id: 'u17', name: '沈阳大学', province: '辽宁', type: '普通' },
    { id: 'u18', name: '大连大学', province: '辽宁', type: '普通' },
    { id: 'u19', name: '沈阳农业大学', province: '辽宁', type: '普通' },
    { id: 'u20', name: '辽宁工程技术大学', province: '辽宁', type: '普通' },
  ]

  // Score ranges for each university: { total: [min, avg, max], subjects: { subject: [min, avg, max] } }
  // These are realistic Liaoning province physics-group scores
  const scoreData: Record<string, { year: number; total: number[]; subjects: Record<string, number[]> }[]> = {
    u1: [ // 清华大学
      { year: 2023, total: [678, 685, 692], subjects: { 语文: [122, 128, 134], 数学: [142, 148, 150], 英语: [136, 142, 147], 物理: [92, 95, 98], 化学: [88, 92, 96], 生物: [86, 90, 94] } },
      { year: 2024, total: [680, 688, 695], subjects: { 语文: [124, 130, 136], 数学: [143, 149, 150], 英语: [137, 143, 148], 物理: [93, 96, 99], 化学: [89, 93, 97], 生物: [87, 91, 95] } },
      { year: 2025, total: [682, 690, 697], subjects: { 语文: [125, 131, 137], 数学: [144, 149, 150], 英语: [138, 144, 149], 物理: [94, 97, 99], 化学: [90, 94, 97], 生物: [88, 92, 96] } },
    ],
    u2: [ // 北京大学
      { year: 2023, total: [676, 683, 690], subjects: { 语文: [124, 130, 136], 数学: [140, 146, 150], 英语: [135, 141, 146], 物理: [91, 94, 97], 化学: [87, 91, 95], 生物: [85, 89, 93] } },
      { year: 2024, total: [678, 686, 693], subjects: { 语文: [126, 132, 138], 数学: [141, 147, 150], 英语: [136, 142, 147], 物理: [92, 95, 98], 化学: [88, 92, 96], 生物: [86, 90, 94] } },
      { year: 2025, total: [680, 688, 695], subjects: { 语文: [127, 133, 139], 数学: [142, 148, 150], 英语: [137, 143, 148], 物理: [93, 96, 99], 化学: [89, 93, 97], 生物: [87, 91, 95] } },
    ],
    u3: [ // 复旦大学
      { year: 2023, total: [668, 675, 682], subjects: { 语文: [120, 126, 132], 数学: [138, 144, 148], 英语: [133, 139, 144], 物理: [89, 93, 96], 化学: [85, 89, 93], 生物: [83, 87, 91] } },
      { year: 2024, total: [670, 678, 685], subjects: { 语文: [122, 128, 134], 数学: [139, 145, 149], 英语: [134, 140, 145], 物理: [90, 94, 97], 化学: [86, 90, 94], 生物: [84, 88, 92] } },
      { year: 2025, total: [672, 680, 687], subjects: { 语文: [123, 129, 135], 数学: [140, 146, 150], 英语: [135, 141, 146], 物理: [91, 95, 98], 化学: [87, 91, 95], 生物: [85, 89, 93] } },
    ],
    u4: [ // 上海交通大学
      { year: 2023, total: [666, 673, 680], subjects: { 语文: [119, 125, 131], 数学: [139, 145, 149], 英语: [132, 138, 143], 物理: [88, 92, 95], 化学: [84, 88, 92], 生物: [82, 86, 90] } },
      { year: 2024, total: [668, 676, 683], subjects: { 语文: [121, 127, 133], 数学: [140, 146, 150], 英语: [133, 139, 144], 物理: [89, 93, 96], 化学: [85, 89, 93], 生物: [83, 87, 91] } },
      { year: 2025, total: [670, 678, 685], subjects: { 语文: [122, 128, 134], 数学: [141, 147, 150], 英语: [134, 140, 145], 物理: [90, 94, 97], 化学: [86, 90, 94], 生物: [84, 88, 92] } },
    ],
    u5: [ // 浙江大学
      { year: 2023, total: [662, 670, 678], subjects: { 语文: [118, 124, 130], 数学: [137, 143, 148], 英语: [131, 137, 142], 物理: [87, 91, 94], 化学: [83, 87, 91], 生物: [81, 85, 89] } },
      { year: 2024, total: [664, 673, 681], subjects: { 语文: [120, 126, 132], 数学: [138, 144, 149], 英语: [132, 138, 143], 物理: [88, 92, 95], 化学: [84, 88, 92], 生物: [82, 86, 90] } },
      { year: 2025, total: [666, 675, 683], subjects: { 语文: [121, 127, 133], 数学: [139, 145, 149], 英语: [133, 139, 144], 物理: [89, 93, 96], 化学: [85, 89, 93], 生物: [83, 87, 91] } },
    ],
    u6: [ // 南京大学
      { year: 2023, total: [658, 666, 674], subjects: { 语文: [117, 123, 129], 数学: [136, 142, 147], 英语: [130, 136, 141], 物理: [86, 90, 93], 化学: [82, 86, 90], 生物: [80, 84, 88] } },
      { year: 2024, total: [660, 669, 677], subjects: { 语文: [119, 125, 131], 数学: [137, 143, 148], 英语: [131, 137, 142], 物理: [87, 91, 94], 化学: [83, 87, 91], 生物: [81, 85, 89] } },
      { year: 2025, total: [662, 671, 679], subjects: { 语文: [120, 126, 132], 数学: [138, 144, 149], 英语: [132, 138, 143], 物理: [88, 92, 95], 化学: [84, 88, 92], 生物: [82, 86, 90] } },
    ],
    u7: [ // 大连理工大学
      { year: 2023, total: [598, 610, 622], subjects: { 语文: [108, 115, 122], 数学: [118, 126, 134], 英语: [115, 122, 129], 物理: [75, 82, 89], 化学: [72, 79, 86], 生物: [70, 76, 82] } },
      { year: 2024, total: [600, 613, 626], subjects: { 语文: [110, 117, 124], 数学: [119, 127, 135], 英语: [116, 123, 130], 物理: [76, 83, 90], 化学: [73, 80, 87], 生物: [71, 77, 83] } },
      { year: 2025, total: [602, 616, 630], subjects: { 语文: [111, 118, 125], 数学: [120, 128, 136], 英语: [117, 124, 131], 物理: [77, 84, 91], 化学: [74, 81, 88], 生物: [72, 78, 84] } },
    ],
    u8: [ // 东北大学
      { year: 2023, total: [578, 592, 606], subjects: { 语文: [105, 112, 119], 数学: [112, 120, 128], 英语: [110, 117, 124], 物理: [72, 79, 86], 化学: [68, 75, 82], 生物: [66, 72, 78] } },
      { year: 2024, total: [580, 595, 610], subjects: { 语文: [107, 114, 121], 数学: [113, 121, 129], 英语: [111, 118, 125], 物理: [73, 80, 87], 化学: [69, 76, 83], 生物: [67, 73, 79] } },
      { year: 2025, total: [582, 598, 614], subjects: { 语文: [108, 115, 122], 数学: [114, 122, 130], 英语: [112, 119, 126], 物理: [74, 81, 88], 化学: [70, 77, 84], 生物: [68, 74, 80] } },
    ],
    u9: [ // 吉林大学
      { year: 2023, total: [568, 582, 596], subjects: { 语文: [103, 110, 117], 数学: [110, 118, 126], 英语: [108, 115, 122], 物理: [70, 77, 84], 化学: [66, 73, 80], 生物: [64, 70, 76] } },
      { year: 2024, total: [570, 585, 600], subjects: { 语文: [105, 112, 119], 数学: [111, 119, 127], 英语: [109, 116, 123], 物理: [71, 78, 85], 化学: [67, 74, 81], 生物: [65, 71, 77] } },
      { year: 2025, total: [572, 588, 604], subjects: { 语文: [106, 113, 120], 数学: [112, 120, 128], 英语: [110, 117, 124], 物理: [72, 79, 86], 化学: [68, 75, 82], 生物: [66, 72, 78] } },
    ],
    u10: [ // 哈尔滨工业大学
      { year: 2023, total: [588, 602, 616], subjects: { 语文: [106, 113, 120], 数学: [116, 124, 132], 英语: [112, 119, 126], 物理: [76, 83, 90], 化学: [72, 79, 86], 生物: [68, 74, 80] } },
      { year: 2024, total: [590, 605, 620], subjects: { 语文: [108, 115, 122], 数学: [117, 125, 133], 英语: [113, 120, 127], 物理: [77, 84, 91], 化学: [73, 80, 87], 生物: [69, 75, 81] } },
      { year: 2025, total: [592, 608, 624], subjects: { 语文: [109, 116, 123], 数学: [118, 126, 134], 英语: [114, 121, 128], 物理: [78, 85, 92], 化学: [74, 81, 88], 生物: [70, 76, 82] } },
    ],
    u11: [ // 辽宁大学
      { year: 2023, total: [538, 550, 562], subjects: { 语文: [100, 107, 114], 数学: [102, 110, 118], 英语: [100, 107, 114], 物理: [66, 73, 80], 化学: [62, 69, 76], 生物: [60, 66, 72] } },
      { year: 2024, total: [540, 553, 566], subjects: { 语文: [102, 109, 116], 数学: [103, 111, 119], 英语: [101, 108, 115], 物理: [67, 74, 81], 化学: [63, 70, 77], 生物: [61, 67, 73] } },
      { year: 2025, total: [542, 556, 570], subjects: { 语文: [103, 110, 117], 数学: [104, 112, 120], 英语: [102, 109, 116], 物理: [68, 75, 82], 化学: [64, 71, 78], 生物: [62, 68, 74] } },
    ],
    u12: [ // 大连海事大学
      { year: 2023, total: [530, 542, 554], subjects: { 语文: [98, 105, 112], 数学: [100, 108, 116], 英语: [98, 105, 112], 物理: [65, 72, 79], 化学: [61, 68, 75], 生物: [59, 65, 71] } },
      { year: 2024, total: [532, 545, 558], subjects: { 语文: [100, 107, 114], 数学: [101, 109, 117], 英语: [99, 106, 113], 物理: [66, 73, 80], 化学: [62, 69, 76], 生物: [60, 66, 72] } },
      { year: 2025, total: [534, 548, 562], subjects: { 语文: [101, 108, 115], 数学: [102, 110, 118], 英语: [100, 107, 114], 物理: [67, 74, 81], 化学: [63, 70, 77], 生物: [61, 67, 73] } },
    ],
    u13: [ // 中国医科大学
      { year: 2023, total: [510, 524, 538], subjects: { 语文: [95, 102, 109], 数学: [96, 104, 112], 英语: [94, 101, 108], 物理: [62, 69, 76], 化学: [58, 65, 72], 生物: [56, 62, 68] } },
      { year: 2024, total: [512, 527, 542], subjects: { 语文: [97, 104, 111], 数学: [97, 105, 113], 英语: [95, 102, 109], 物理: [63, 70, 77], 化学: [59, 66, 73], 生物: [57, 63, 69] } },
      { year: 2025, total: [514, 530, 546], subjects: { 语文: [98, 105, 112], 数学: [98, 106, 114], 英语: [96, 103, 110], 物理: [64, 71, 78], 化学: [60, 67, 74], 生物: [58, 64, 70] } },
    ],
    u14: [ // 东北财经大学
      { year: 2023, total: [518, 532, 546], subjects: { 语文: [97, 104, 111], 数学: [98, 106, 114], 英语: [96, 103, 110], 物理: [63, 70, 77], 化学: [59, 66, 73], 生物: [57, 63, 69] } },
      { year: 2024, total: [520, 535, 550], subjects: { 语文: [99, 106, 113], 数学: [99, 107, 115], 英语: [97, 104, 111], 物理: [64, 71, 78], 化学: [60, 67, 74], 生物: [58, 64, 70] } },
      { year: 2025, total: [522, 538, 554], subjects: { 语文: [100, 107, 114], 数学: [100, 108, 116], 英语: [98, 105, 112], 物理: [65, 72, 79], 化学: [61, 68, 75], 生物: [59, 65, 71] } },
    ],
    u15: [ // 沈阳工业大学
      { year: 2023, total: [478, 492, 506], subjects: { 语文: [90, 97, 104], 数学: [88, 96, 104], 英语: [88, 95, 102], 物理: [58, 65, 72], 化学: [54, 61, 68], 生物: [52, 58, 64] } },
      { year: 2024, total: [480, 495, 510], subjects: { 语文: [92, 99, 106], 数学: [89, 97, 105], 英语: [89, 96, 103], 物理: [59, 66, 73], 化学: [55, 62, 69], 生物: [53, 59, 65] } },
      { year: 2025, total: [482, 498, 514], subjects: { 语文: [93, 100, 107], 数学: [90, 98, 106], 英语: [90, 97, 104], 物理: [60, 67, 74], 化学: [56, 63, 70], 生物: [54, 60, 66] } },
    ],
    u16: [ // 辽宁师范大学
      { year: 2023, total: [488, 502, 516], subjects: { 语文: [92, 99, 106], 数学: [90, 98, 106], 英语: [90, 97, 104], 物理: [60, 67, 74], 化学: [56, 63, 70], 生物: [54, 60, 66] } },
      { year: 2024, total: [490, 505, 520], subjects: { 语文: [94, 101, 108], 数学: [91, 99, 107], 英语: [91, 98, 105], 物理: [61, 68, 75], 化学: [57, 64, 71], 生物: [55, 61, 67] } },
      { year: 2025, total: [492, 508, 524], subjects: { 语文: [95, 102, 109], 数学: [92, 100, 108], 英语: [92, 99, 106], 物理: [62, 69, 76], 化学: [58, 65, 72], 生物: [56, 62, 68] } },
    ],
    u17: [ // 沈阳大学
      { year: 2023, total: [448, 462, 476], subjects: { 语文: [85, 92, 99], 数学: [80, 88, 96], 英语: [82, 89, 96], 物理: [54, 61, 68], 化学: [50, 57, 64], 生物: [48, 54, 60] } },
      { year: 2024, total: [450, 465, 480], subjects: { 语文: [87, 94, 101], 数学: [81, 89, 97], 英语: [83, 90, 97], 物理: [55, 62, 69], 化学: [51, 58, 65], 生物: [49, 55, 61] } },
      { year: 2025, total: [452, 468, 484], subjects: { 语文: [88, 95, 102], 数学: [82, 90, 98], 英语: [84, 91, 98], 物理: [56, 63, 70], 化学: [52, 59, 66], 生物: [50, 56, 62] } },
    ],
    u18: [ // 大连大学
      { year: 2023, total: [452, 466, 480], subjects: { 语文: [86, 93, 100], 数学: [82, 90, 98], 英语: [83, 90, 97], 物理: [55, 62, 69], 化学: [51, 58, 65], 生物: [49, 55, 61] } },
      { year: 2024, total: [454, 469, 484], subjects: { 语文: [88, 95, 102], 数学: [83, 91, 99], 英语: [84, 91, 98], 物理: [56, 63, 70], 化学: [52, 59, 66], 生物: [50, 56, 62] } },
      { year: 2025, total: [456, 472, 488], subjects: { 语文: [89, 96, 103], 数学: [84, 92, 100], 英语: [85, 92, 99], 物理: [57, 64, 71], 化学: [53, 60, 67], 生物: [51, 57, 63] } },
    ],
    u19: [ // 沈阳农业大学
      { year: 2023, total: [468, 482, 496], subjects: { 语文: [89, 96, 103], 数学: [86, 94, 102], 英语: [86, 93, 100], 物理: [57, 64, 71], 化学: [53, 60, 67], 生物: [51, 57, 63] } },
      { year: 2024, total: [470, 485, 500], subjects: { 语文: [91, 98, 105], 数学: [87, 95, 103], 英语: [87, 94, 101], 物理: [58, 65, 72], 化学: [54, 61, 68], 生物: [52, 58, 64] } },
      { year: 2025, total: [472, 488, 504], subjects: { 语文: [92, 99, 106], 数学: [88, 96, 104], 英语: [88, 95, 102], 物理: [59, 66, 73], 化学: [55, 62, 69], 生物: [53, 59, 65] } },
    ],
    u20: [ // 辽宁工程技术大学
      { year: 2023, total: [458, 472, 486], subjects: { 语文: [87, 94, 101], 数学: [84, 92, 100], 英语: [84, 91, 98], 物理: [56, 63, 70], 化学: [52, 59, 66], 生物: [50, 56, 62] } },
      { year: 2024, total: [460, 475, 490], subjects: { 语文: [89, 96, 103], 数学: [85, 93, 101], 英语: [85, 92, 99], 物理: [57, 64, 71], 化学: [53, 60, 67], 生物: [51, 57, 63] } },
      { year: 2025, total: [462, 478, 494], subjects: { 语文: [90, 97, 104], 数学: [86, 94, 102], 英语: [86, 93, 100], 物理: [58, 65, 72], 化学: [54, 61, 68], 生物: [52, 58, 64] } },
    ],
  }

  let scoreId = 1
  let subjectScoreId = 1

  const transaction = db.transaction(() => {
    for (const u of universities) {
      insertUniversity.run(u.id, u.name, u.province, u.type)
    }

    for (const [uid, years] of Object.entries(scoreData)) {
      for (const yearData of years) {
        const usid = `us${scoreId++}`
        insertUniversityScore.run(
          usid, uid, yearData.year,
          yearData.total[0], yearData.total[1], yearData.total[2]
        )

        for (const [subject, scores] of Object.entries(yearData.subjects)) {
          const ussid = `uss${subjectScoreId++}`
          insertSubjectScore.run(
            ussid, usid, subject,
            scores[0], scores[1], scores[2]
          )
        }
      }
    }
  })

  transaction()
}

initializeDatabase()

export default db
