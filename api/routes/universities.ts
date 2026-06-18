import { Router, type Request, type Response } from 'express'
import db from '../db/index.js'

const router = Router()

// GET /api/universities/search?keyword=xxx - Search universities by name
router.get('/search', (req: Request, res: Response): void => {
  try {
    const { keyword } = req.query

    if (!keyword || typeof keyword !== 'string') {
      res.status(400).json({ success: false, error: '请提供搜索关键词 keyword' })
      return
    }

    const universities = db.prepare(
      "SELECT * FROM universities WHERE name LIKE ? ORDER BY name"
    ).all(`%${keyword}%`) as any[]

    res.json({ success: true, data: universities })
  } catch (error) {
    res.status(500).json({ success: false, error: '搜索大学失败' })
  }
})

// GET /api/universities?page=1&size=20&type=985 - List universities with pagination
router.get('/', (req: Request, res: Response): void => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const size = Math.min(100, Math.max(1, parseInt(req.query.size as string) || 20))
    const type = req.query.type as string | undefined
    const offset = (page - 1) * size

    let universities: any[]
    let total: number

    if (type) {
      total = (db.prepare(
        "SELECT COUNT(*) as cnt FROM universities WHERE type LIKE ?"
      ).get(`%${type}%`) as any).cnt
      universities = db.prepare(
        "SELECT * FROM universities WHERE type LIKE ? ORDER BY name LIMIT ? OFFSET ?"
      ).all(`%${type}%`, size, offset) as any[]
    } else {
      total = (db.prepare("SELECT COUNT(*) as cnt FROM universities").get() as any).cnt
      universities = db.prepare(
        "SELECT * FROM universities ORDER BY name LIMIT ? OFFSET ?"
      ).all(size, offset) as any[]
    }

    res.json({
      success: true,
      data: {
        items: universities,
        total,
        page,
        size,
        totalPages: Math.ceil(total / size),
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取大学列表失败' })
  }
})

// GET /api/universities/:id/liaoning-scores - Get university scores in Liaoning
router.get('/:id/liaoning-scores', (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const university = db.prepare('SELECT * FROM universities WHERE id = ?').get(id) as any
    if (!university) {
      res.status(404).json({ success: false, error: '大学不存在' })
      return
    }

    // Try to get gaokao admission scores first (real data from gaokao.cn)
    const gaokaoScores = db.prepare(
      'SELECT * FROM gaokao_admission_scores WHERE university_id = ? ORDER BY year DESC, category, batch'
    ).all(id) as any[]

    // Also get legacy mock scores as fallback
    const legacyScores = db.prepare(
      'SELECT * FROM university_scores WHERE university_id = ? ORDER BY year'
    ).all(id) as any[]

    const legacyWithSubjects = legacyScores.map(score => {
      const subjectScores = db.prepare(
        'SELECT * FROM university_subject_scores WHERE university_score_id = ?'
      ).all(score.id) as any[]
      return { ...score, subject_scores: subjectScores }
    })

    // Build response: prefer gaokao real data, fall back to legacy mock data
    let scores: any[]

    if (gaokaoScores.length > 0) {
      // Real data available - transform gaokao admission scores into structured format
      const groupedByYear: Record<number, any[]> = {}
      for (const score of gaokaoScores) {
        if (!groupedByYear[score.year]) {
          groupedByYear[score.year] = []
        }
        groupedByYear[score.year].push({
          category: score.category,
          batch: score.batch,
          min_score: score.min_score,
          min_rank: score.min_rank,
          avg_score: score.avg_score,
        })
      }

      scores = Object.entries(groupedByYear)
        .sort(([a], [b]) => Number(b) - Number(a))
        .map(([year, entries]) => ({
          year: Number(year),
          admission_data: entries,
        }))
    } else {
      // No real data - use legacy mock data as fallback
      scores = legacyWithSubjects
    }

    res.json({
      success: true,
      data: {
        university,
        scores,
        data_source: gaokaoScores.length > 0 ? 'gaokao_cn' : 'mock',
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取大学分数数据失败' })
  }
})

export default router
