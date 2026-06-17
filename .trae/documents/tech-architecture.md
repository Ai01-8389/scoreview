## 1. 架构设计

```mermaid
graph TB
    "前端 React+Vite" --> "状态管理 Zustand"
    "状态管理 Zustand" --> "LocalStorage 持久化"
    "前端 React+Vite" --> "图表库 Recharts"
    "前端 React+Vite" --> "UI框架 TailwindCSS"
    "前端 React+Vite" --> "路由 React Router"
```

纯前端应用，数据存储在浏览器 LocalStorage 中，无需后端服务。

## 2. 技术说明

- **前端**：React@18 + TypeScript + TailwindCSS@3 + Vite
- **初始化工具**：vite-init（react-ts 模板）
- **后端**：无（纯前端应用）
- **数据库**：LocalStorage（浏览器本地存储）
- **图表库**：Recharts（React 图表组件库）
- **状态管理**：Zustand（轻量级状态管理）
- **路由**：React Router DOM v6
- **图标**：lucide-react

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| `/` | 成绩总览页，展示总分趋势和各科雷达图 |
| `/input` | 成绩录入与管理页，录入和编辑考试记录 |
| `/compare` | 历史比对分析页，单科/总分趋势和差异对比 |
| `/target` | 目标院校分析页，差距分析和提升空间 |
| `/detail` | 小分增长点分析页，题型得分率和薄弱环节 |

## 4. 数据模型

### 4.1 数据模型定义

```mermaid
erDiagram
    "Student" {
        "string id PK"
        "string name"
        "string subjectGroup"
    }
    "Exam" {
        "string id PK"
        "string studentId FK"
        "string name"
        "string date"
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
    "TargetUniversity" {
        "string id PK"
        "string studentId FK"
        "string name"
        "number totalScore"
    }
    "TargetSubjectScore" {
        "string id PK"
        "string targetId FK"
        "string subject"
        "number score"
    }
    "Student" ||--o{ "Exam" : "has"
    "Exam" ||--o{ "SubjectScore" : "has"
    "SubjectScore" ||--o{ "SubScore" : "has"
    "Student" ||--o{ "TargetUniversity" : "has"
    "TargetUniversity" ||--o{ "TargetSubjectScore" : "has"
```

### 4.2 数据定义

#### 科目小分分类定义

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

#### 选科组合

- 物理类：语文 + 数学 + 英语 + 物理 + （化学/生物/政治/地理 选2）
- 历史类：语文 + 数学 + 英语 + 历史 + （化学/生物/政治/地理 选2）

## 5. 核心计算逻辑

### 5.1 得分率计算
```
得分率 = 实际得分 / 满分 × 100%
```

### 5.2 提升空间计算
```
提升空间 = 目标分数 - 当前分数
提升难度系数 = 1 - (当前分数 / 满分分数)
加权提分潜力 = 提升空间 × (1 - 当前得分率)
```

### 5.3 小分增长点排序
```
增长潜力 = (题型满分 - 题型得分) × 题型满分占比
优先级 = 增长潜力 × (1 - 得分率)
```
得分率越低、剩余空间越大的题型，优先级越高。

### 5.4 排名模拟
基于辽宁历年一分一段表数据（内置模拟数据），根据总分估算省排名区间。
