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

    const scores = db.prepare(
      'SELECT * FROM university_scores WHERE university_id = ? ORDER BY year'
    ).all(id) as any[]

    const scoresWithSubjects = scores.map(score => {
      const subjectScores = db.prepare(
        'SELECT * FROM university_subject_scores WHERE university_score_id = ?'
      ).all(score.id) as any[]
      return { ...score, subject_scores: subjectScores }
    })

    res.json({
      success: true,
      data: {
        university,
        scores: scoresWithSubjects,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取大学分数数据失败' })
  }
})

export default router
