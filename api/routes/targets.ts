import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db/index.js'

const router = Router()

// GET /api/targets - Get all target universities
router.get('/', (req: Request, res: Response): void => {
  try {
    const targets = db.prepare(
      'SELECT * FROM target_universities ORDER BY created_at DESC'
    ).all() as any[]

    const result = targets.map(target => {
      const university = db.prepare(
        'SELECT * FROM universities WHERE id = ?'
      ).get(target.university_id) as any

      const subjectScores = db.prepare(
        'SELECT * FROM target_subject_scores WHERE target_id = ?'
      ).all(target.id) as any[]

      // Get university's Liaoning scores for comparison
      const universityScores = db.prepare(
        'SELECT * FROM university_scores WHERE university_id = ? ORDER BY year DESC LIMIT 1'
      ).all(target.university_id) as any[]

      let universitySubjectScores: any[] = []
      if (universityScores.length > 0) {
        universitySubjectScores = db.prepare(
          'SELECT * FROM university_subject_scores WHERE university_score_id = ?'
        ).all(universityScores[0].id) as any[]
      }

      return {
        ...target,
        university,
        target_subject_scores: subjectScores,
        university_scores: universityScores[0] || null,
        university_subject_scores: universitySubjectScores,
      }
    })

    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取目标大学失败' })
  }
})

// POST /api/targets - Set target university
router.post('/', (req: Request, res: Response): void => {
  try {
    const { university_id, subject_scores } = req.body

    if (!university_id) {
      res.status(400).json({ success: false, error: '缺少必要字段: university_id' })
      return
    }

    const university = db.prepare('SELECT * FROM universities WHERE id = ?').get(university_id) as any
    if (!university) {
      res.status(404).json({ success: false, error: '大学不存在' })
      return
    }

    // Check if already a target
    const existing = db.prepare(
      'SELECT * FROM target_universities WHERE university_id = ?'
    ).get(university_id) as any
    if (existing) {
      res.status(409).json({ success: false, error: '该大学已在目标列表中' })
      return
    }

    const targetId = uuidv4()

    const transaction = db.transaction(() => {
      db.prepare(
        'INSERT INTO target_universities (id, university_id) VALUES (?, ?)'
      ).run(targetId, university_id)

      if (subject_scores && Array.isArray(subject_scores)) {
        for (const ss of subject_scores) {
          const ssId = uuidv4()
          db.prepare(
            'INSERT INTO target_subject_scores (id, target_id, subject, score) VALUES (?, ?, ?, ?)'
          ).run(ssId, targetId, ss.subject, ss.score)
        }
      }
    })

    transaction()

    const target = db.prepare('SELECT * FROM target_universities WHERE id = ?').get(targetId) as any
    res.status(201).json({ success: true, data: { ...target, university } })
  } catch (error) {
    res.status(500).json({ success: false, error: '设置目标大学失败' })
  }
})

// DELETE /api/targets/:id - Remove target
router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const existing = db.prepare('SELECT * FROM target_universities WHERE id = ?').get(id) as any
    if (!existing) {
      res.status(404).json({ success: false, error: '目标大学不存在' })
      return
    }

    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM target_subject_scores WHERE target_id = ?').run(id)
      db.prepare('DELETE FROM target_universities WHERE id = ?').run(id)
    })

    transaction()

    res.json({ success: true, message: '目标大学已移除' })
  } catch (error) {
    res.status(500).json({ success: false, error: '移除目标大学失败' })
  }
})

export default router
