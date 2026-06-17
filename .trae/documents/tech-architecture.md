## 1. 架构设计

```mermaid
graph TB
    "前端 React+Vite" --> "状态管理 Zustand"
    "状态管理 Zustand" --> "LocalStorage 持久化"
    "前端 React+Vite" --> "图表库 Recharts"
    "前端 React+Vite" --> "UI框架 TailwindCSS"
    "前端 React+Vite" --> "路由 React Router"
    "前端 React+Vite" --> "后端 Express API"
    "后端 Express API" --> "SQLite 数据库"
    "后端 Express API" --> "AI OCR 服务"
    "后端 Express API" --> "院校数据采集"
    "AI OCR 服务" --> "免费AI模型"
    "院校数据采集" --> "公开数据源"
```

前后端分离架构，前端负责UI展示和交互，后端负责AI识别、院校数据管理和数据持久化。

## 2. 技术说明

- **前端**：React@18 + TypeScript + TailwindCSS@3 + Vite
- **初始化工具**：vite-init（react-express-ts 模板）
- **后端**：Express@4 + TypeScript（ESM）
- **数据库**：SQLite（轻量级，无需额外安装）
- **AI识别**：调用免费AI模型API（如通义千问/百度文心等免费额度）进行截图OCR和文字解析
- **图表库**：Recharts（React 图表组件库，支持渐变、动画、自定义样式）
- **状态管理**：Zustand（轻量级状态管理）
- **路由**：React Router DOM v6
- **图标**：lucide-react
- **动画**：CSS动画 + Framer Motion

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| `/` | 成绩总览页，展示总分趋势和各科雷达图 |
| `/input` | 成绩录入与管理页，截图/文字/手动三种录入方式 |
| `/compare` | 历史比对分析页，单科/总分趋势和差异对比 |
| `/target` | 目标院校分析页，差距分析和提升空间 |
| `/detail` | 小分增长点分析页，题型得分率和薄弱环节 |

## 4. API 定义

### 4.1 AI识别相关

```typescript
// 截图识别
POST /api/ocr/screenshot
Request: FormData { image: File }
Response: {
  subjects: Array<{
    name: string;       // 科目名
    score: number;      // 总分
    fullScore: number;  // 满分
    subScores?: Array<{
      category: string;  // 题型
      score: number;
      fullScore: number;
    }>;
  }>;
  rawText: string;      // 原始识别文本
  confidence: number;   // 识别置信度
}

// 文字解析
POST /api/ocr/text
Request: { text: string }
Response: {
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
  confidence: number;
}
```

### 4.2 院校数据相关

```typescript
// 搜索院校
GET /api/universities/search?keyword=xxx
Response: Array<{
  id: string;
  name: string;
  province: string;
  type: string;         // 985/211/双一流/普通
}>

// 获取院校在辽宁录取数据
GET /api/universities/:id/liaoning-scores
Response: {
  university: { id: string; name: string; };
  years: Array<{
    year: number;
    totalScore: {
      min: number;
      avg: number;
      max: number;
    };
    subjects: Array<{
      name: string;
      min: number;
      avg: number;
      max: number;
    }>;
  }>;
}

// 获取所有院校列表（分页）
GET /api/universities?page=1&size=20&type=985
Response: {
  total: number;
  items: Array<{
    id: string;
    name: string;
    province: string;
    type: string;
    latestScore: { min: number; avg: number; max: number; year: number; };
  }>;
}
```

### 4.3 成绩数据相关

```typescript
// 保存考试记录
POST /api/exams
Request: {
  name: string;
  date: string;
  subjectGroup: 'physics' | 'history';
  subjects: Array<{
    name: string;
    score: number;
    fullScore: number;
    subScores: Array<{
      category: string;
      score: number;
      fullScore: number;
    }>;
  }>;
}
Response: { id: string; }

// 获取所有考试记录
GET /api/exams
Response: Array<Exam>

// 更新考试记录
PUT /api/exams/:id
Request: 同创建

// 删除考试记录
DELETE /api/exams/:id

// 获取目标院校设定
GET /api/targets
Response: Array<TargetUniversity>

// 设定目标院校
POST /api/targets
Request: {
  universityId: string;
  customScores?: Array<{
    subject: string;
    score: number;
  }>;
}
```

## 5. 服务器架构图

```mermaid
graph LR
    "Controller" --> "Service"
    "Service" --> "Repository"
    "Repository" --> "SQLite"
    "Controller" --> "AI Service"
    "AI Service" --> "外部AI API"
    "Service" --> "Data Collector"
    "Data Collector" --> "公开数据源"
```

## 6. 数据模型

### 6.1 数据模型定义

```mermaid
erDiagram
    "Exam" {
        "string id PK"
        "string name"
        "string date"
        "string subjectGroup"
        "datetime createdAt"
    }
    "SubjectScore" {
        "string id PK"
        "string examId FK"
        "string subject"
        "number totalScore"
        "number fullScore"
    }
    "SubScore" {
        "string id PK"
        "string subjectScoreId FK"
        "string category"
        "number score"
        "number fullScore"
    }
    "University" {
        "string id PK"
        "string name"
        "string province"
        "string type"
    }
    "UniversityScore" {
        "string id PK"
        "string universityId FK"
        "number year"
        "number totalMin"
        "number totalAvg"
        "number totalMax"
    }
    "UniversitySubjectScore" {
        "string id PK"
        "string universityScoreId FK"
        "string subject"
        "number minScore"
        "number avgScore"
        "number maxScore"
    }
    "TargetUniversity" {
        "string id PK"
        "string universityId FK"
        "datetime createdAt"
    }
    "TargetSubjectScore" {
        "string id PK"
        "string targetId FK"
        "string subject"
        "number score"
    }
    "Exam" ||--o{ "SubjectScore" : "has"
    "SubjectScore" ||--o{ "SubScore" : "has"
    "University" ||--o{ "UniversityScore" : "has"
    "UniversityScore" ||--o{ "UniversitySubjectScore" : "has"
    "TargetUniversity" ||--o{ "TargetSubjectScore" : "has"
    "University" ||--o{ "TargetUniversity" : "targeted"
```

### 6.2 数据定义语言

```sql
CREATE TABLE exams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  subject_group TEXT NOT NULL CHECK(subject_group IN ('physics', 'history')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subject_scores (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  total_score REAL NOT NULL,
  full_score REAL NOT NULL
);

CREATE TABLE sub_scores (
  id TEXT PRIMARY KEY,
  subject_score_id TEXT NOT NULL REFERENCES subject_scores(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  score REAL NOT NULL,
  full_score REAL NOT NULL
);

CREATE TABLE universities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  province TEXT NOT NULL,
  type TEXT NOT NULL
);

CREATE TABLE university_scores (
  id TEXT PRIMARY KEY,
  university_id TEXT NOT NULL REFERENCES universities(id),
  year INTEGER NOT NULL,
  total_min REAL,
  total_avg REAL,
  total_max REAL
);

CREATE TABLE university_subject_scores (
  id TEXT PRIMARY KEY,
  university_score_id TEXT NOT NULL REFERENCES university_scores(id),
  subject TEXT NOT NULL,
  min_score REAL,
  avg_score REAL,
  max_score REAL
);

CREATE TABLE target_universities (
  id TEXT PRIMARY KEY,
  university_id TEXT NOT NULL REFERENCES universities(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE target_subject_scores (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL REFERENCES target_universities(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  score REAL NOT NULL
);

-- 初始化院校数据（示例）
INSERT INTO universities (id, name, province, type) VALUES
  ('u1', '清华大学', '北京', '985,211,双一流'),
  ('u2', '北京大学', '北京', '985,211,双一流'),
  ('u3', '大连理工大学', '辽宁', '985,211,双一流'),
  ('u4', '东北大学', '辽宁', '985,211,双一流'),
  ('u5', '辽宁大学', '辽宁', '211,双一流'),
  ('u6', '大连海事大学', '辽宁', '211,双一流'),
  ('u7', '中国医科大学', '辽宁', '普通'),
  ('u8', '东北财经大学', '辽宁', '普通'),
  ('u9', '沈阳工业大学', '辽宁', '普通'),
  ('u10', '辽宁师范大学', '辽宁', '普通');
```

## 7. 科目小分分类定义

**语文（150分）**
- 现代文阅读（35分）
- 文言文阅读（35分）
- 古诗文默写（6分）
- 语言文字运用（20分）
- 作文（54分）

**数学（150分）**
- 单选题（40分）
- 多选题（20分）
- 填空题（20分）
- 解答题（70分）

**英语（150分）**
- 听力（30分）
- 阅读理解（50分）
- 语言运用（30分）
- 写作（40分）

**物理（100分）**
- 单选题（28分）
- 多选题（18分）
- 实验题（14分）
- 计算题（40分）

**历史（100分）**
- 选择题（48分）
- 非选择题（52分）

**化学（100分）**
- 选择题（42分）
- 非选择题（58分）

**生物（100分）**
- 选择题（36分）
- 非选择题（64分）

**政治（100分）**
- 选择题（48分）
- 非选择题（52分）

**地理（100分）**
- 选择题（48分）
- 非选择题（52分）

## 8. 核心计算逻辑

### 8.1 得分率计算
```
得分率 = 实际得分 / 满分 × 100%
```

### 8.2 提升空间计算
```
提升空间 = 目标分数 - 当前分数
提升难度系数 = 1 - (当前分数 / 满分分数)
加权提分潜力 = 提升空间 × (1 - 当前得分率)
```

### 8.3 小分增长点排序
```
增长潜力 = (题型满分 - 题型得分) × 题型满分占比
优先级 = 增长潜力 × (1 - 得分率)
```
得分率越低、剩余空间越大的题型，优先级越高。

### 8.4 排名模拟
基于辽宁历年一分一段表数据（内置模拟数据），根据总分估算省排名区间。

### 8.5 AI识别流程
1. 截图模式：前端上传图片 → 后端接收 → 调用免费AI模型API进行OCR → 解析成绩结构 → 返回结构化数据
2. 文字模式：前端发送文本 → 后端接收 → 调用免费AI模型API进行结构化解析 → 返回结构化数据
3. 前端展示识别结果 → 用户校验修正 → 保存

## 9. 院校数据采集策略

### 9.1 数据来源
- 阳光高考网（官方数据）
- 各院校招生网公开数据
- 辽宁省招生考试之窗

### 9.2 采集方式
- 后端内置初始院校数据（SQLite预置）
- 提供数据管理接口，支持手动更新
- 预留AI采集接口，可对接公开数据源自动更新

### 9.3 数据结构
每条院校录取数据包含：
- 院校名称、类型（985/211/双一流/普通）
- 年份
- 总分：最低分、平均分、最高分
- 各科：最低分、平均分、最高分
