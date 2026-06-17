import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db/index.js'

const router = Router()

// GET /api/exams - Get all exams with subject_scores and sub_scores
router.get('/', (req: Request, res: Response): void => {
  try {
    const exams = db.prepare('SELECT * FROM exams ORDER BY created_at DESC').all() as any[]

    const result = exams.map(exam => {
      const subjectScores = db.prepare(
        'SELECT * FROM subject_scores WHERE exam_id = ?'
      ).all(exam.id) as any[]

      const subjectScoresWithSubs = subjectScores.map(ss => {
        const subScores = db.prepare(
          'SELECT * FROM sub_scores WHERE subject_score_id = ?'
        ).all(ss.id) as any[]
        return { ...ss, sub_scores: subScores }
      })

      return { ...exam, subject_scores: subjectScoresWithSubs }
    })

    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取考试数据失败' })
  }
})

// POST /api/exams - Create exam with subjects and sub-scores
router.post('/', (req: Request, res: Response): void => {
  try {
    const { name, date, subject_group, subject_scores } = req.body

    if (!name || !date || !subject_group) {
      res.status(400).json({ success: false, error: '缺少必要字段: name, date, subject_group' })
      return
    }

    if (!['physics', 'history'].includes(subject_group)) {
      res.status(400).json({ success: false, error: 'subject_group 必须为 physics 或 history' })
      return
    }

    const examId = uuidv4()

    const transaction = db.transaction(() => {
      db.prepare(
        'INSERT INTO exams (id, name, date, subject_group) VALUES (?, ?, ?, ?)'
      ).run(examId, name, date, subject_group)

      if (subject_scores && Array.isArray(subject_scores)) {
        for (const ss of subject_scores) {
          const ssId = uuidv4()
          db.prepare(
            'INSERT INTO subject_scores (id, exam_id, subject, total_score, full_score) VALUES (?, ?, ?, ?, ?)'
          ).run(ssId, examId, ss.subject, ss.total_score, ss.full_score)

          if (ss.sub_scores && Array.isArray(ss.sub_scores)) {
            for (const sub of ss.sub_scores) {
              const subId = uuidv4()
              db.prepare(
                'INSERT INTO sub_scores (id, subject_score_id, category, score, full_score) VALUES (?, ?, ?, ?, ?)'
              ).run(subId, ssId, sub.category, sub.score, sub.full_score)
            }
          }
        }
      }
    })

    transaction()

    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId)
    res.status(201).json({ success: true, data: exam })
  } catch (error) {
    res.status(500).json({ success: false, error: '创建考试失败' })
  }
})

// PUT /api/exams/:id - Update exam
router.put('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { name, date, subject_group, subject_scores } = req.body

    const existing = db.prepare('SELECT * FROM exams WHERE id = ?').get(id) as any
    if (!existing) {
      res.status(404).json({ success: false, error: '考试不存在' })
      return
    }

    if (subject_group && !['physics', 'history'].includes(subject_group)) {
      res.status(400).json({ success: false, error: 'subject_group 必须为 physics 或 history' })
      return
    }

    const transaction = db.transaction(() => {
      db.prepare(
        'UPDATE exams SET name = ?, date = ?, subject_group = ? WHERE id = ?'
      ).run(
        name ?? existing.name,
        date ?? existing.date,
        subject_group ?? existing.subject_group,
        id
      )

      if (subject_scores && Array.isArray(subject_scores)) {
        // Delete existing subject scores and sub scores (cascade)
        const existingSS = db.prepare('SELECT id FROM subject_scores WHERE exam_id = ?').all(id) as any[]
        for (const ss of existingSS) {
          db.prepare('DELETE FROM sub_scores WHERE subject_score_id = ?').run(ss.id)
        }
        db.prepare('DELETE FROM subject_scores WHERE exam_id = ?').run(id)

        // Insert new subject scores
        for (const ss of subject_scores) {
          const ssId = uuidv4()
          db.prepare(
            'INSERT INTO subject_scores (id, exam_id, subject, total_score, full_score) VALUES (?, ?, ?, ?, ?)'
          ).run(ssId, id, ss.subject, ss.total_score, ss.full_score)

          if (ss.sub_scores && Array.isArray(ss.sub_scores)) {
            for (const sub of ss.sub_scores) {
              const subId = uuidv4()
              db.prepare(
                'INSERT INTO sub_scores (id, subject_score_id, category, score, full_score) VALUES (?, ?, ?, ?, ?)'
              ).run(subId, ssId, sub.category, sub.score, sub.full_score)
            }
          }
        }
      }
    })

    transaction()

    const updated = db.prepare('SELECT * FROM exams WHERE id = ?').get(id)
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: '更新考试失败' })
  }
})

// DELETE /api/exams/:id - Delete exam and cascade
router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const existing = db.prepare('SELECT * FROM exams WHERE id = ?').get(id) as any
    if (!existing) {
      res.status(404).json({ success: false, error: '考试不存在' })
      return
    }

    // Cascade delete: sub_scores -> subject_scores -> exams
    const transaction = db.transaction(() => {
      const subjectScores = db.prepare('SELECT id FROM subject_scores WHERE exam_id = ?').all(id) as any[]
      for (const ss of subjectScores) {
        db.prepare('DELETE FROM sub_scores WHERE subject_score_id = ?').run(ss.id)
      }
      db.prepare('DELETE FROM subject_scores WHERE exam_id = ?').run(id)
      db.prepare('DELETE FROM exams WHERE id = ?').run(id)
    })

    transaction()

    res.json({ success: true, message: '考试已删除' })
  } catch (error) {
    res.status(500).json({ success: false, error: '删除考试失败' })
  }
})

export default router
