import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import path from 'path'
import { mkdirSync } from 'fs'

const router = Router()

// Ensure uploads directory exists
const uploadsDir = path.resolve(process.cwd(), 'uploads')
mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('仅支持 PNG、JPG、WEBP 格式的图片'))
    }
  },
})

// POST /api/ocr/screenshot - Accept image upload, return mock OCR result
router.post('/screenshot', upload.single('image'), (req: Request, res: Response): void => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: '请上传图片文件' })
      return
    }

    // Mock OCR result - in production this would call an external AI API
    const mockResult = {
      subjects: [
        {
          name: '语文',
          score: 115,
          fullScore: 150,
          subScores: [
            { category: '现代文阅读', score: 28, fullScore: 35 },
            { category: '文言文阅读', score: 22, fullScore: 35 },
            { category: '语言文字运用', score: 18, fullScore: 20 },
            { category: '作文', score: 47, fullScore: 54 },
          ],
        },
        {
          name: '数学',
          score: 128,
          fullScore: 150,
          subScores: [
            { category: '单选题', score: 34, fullScore: 40 },
            { category: '多选题', score: 16, fullScore: 20 },
            { category: '填空题', score: 18, fullScore: 20 },
            { category: '解答题', score: 60, fullScore: 70 },
          ],
        },
        {
          name: '英语',
          score: 122,
          fullScore: 150,
          subScores: [
            { category: '听力', score: 27, fullScore: 30 },
            { category: '阅读理解', score: 36, fullScore: 50 },
            { category: '语言运用', score: 25, fullScore: 30 },
            { category: '写作', score: 34, fullScore: 40 },
          ],
        },
        {
          name: '物理',
          score: 82,
          fullScore: 100,
          subScores: [
            { category: '单选题', score: 24, fullScore: 28 },
            { category: '多选题', score: 14, fullScore: 18 },
            { category: '实验题', score: 12, fullScore: 14 },
            { category: '计算题', score: 32, fullScore: 40 },
          ],
        },
        {
          name: '化学',
          score: 78,
          fullScore: 100,
          subScores: [
            { category: '选择题', score: 36, fullScore: 42 },
            { category: '非选择题', score: 42, fullScore: 58 },
          ],
        },
        {
          name: '生物',
          score: 75,
          fullScore: 100,
          subScores: [
            { category: '选择题', score: 30, fullScore: 36 },
            { category: '非选择题', score: 45, fullScore: 64 },
          ],
        },
      ],
      rawText: '语文115 数学128 英语122 物理82 化学78 生物75',
      confidence: 0.85,
    }

    res.json({ success: true, data: mockResult })
  } catch (error) {
    res.status(500).json({ success: false, error: 'OCR识别失败' })
  }
})

// POST /api/ocr/text - Accept text, return mock parsed result
router.post('/text', (req: Request, res: Response): void => {
  try {
    const { text } = req.body

    if (!text || typeof text !== 'string') {
      res.status(400).json({ success: false, error: '请提供文本内容 text' })
      return
    }

    // Mock text parsing result - in production this would use NLP/AI
    const mockResult = {
      subjects: [
        {
          name: '语文',
          score: 115,
          fullScore: 150,
          subScores: [
            { category: '现代文阅读', score: 28, fullScore: 35 },
            { category: '文言文阅读', score: 22, fullScore: 35 },
            { category: '语言文字运用', score: 18, fullScore: 20 },
            { category: '作文', score: 47, fullScore: 54 },
          ],
        },
        {
          name: '数学',
          score: 128,
          fullScore: 150,
          subScores: [
            { category: '单选题', score: 34, fullScore: 40 },
            { category: '多选题', score: 16, fullScore: 20 },
            { category: '填空题', score: 18, fullScore: 20 },
            { category: '解答题', score: 60, fullScore: 70 },
          ],
        },
        {
          name: '英语',
          score: 122,
          fullScore: 150,
          subScores: [
            { category: '听力', score: 27, fullScore: 30 },
            { category: '阅读理解', score: 36, fullScore: 50 },
            { category: '语言运用', score: 25, fullScore: 30 },
            { category: '写作', score: 34, fullScore: 40 },
          ],
        },
        {
          name: '物理',
          score: 82,
          fullScore: 100,
          subScores: [
            { category: '单选题', score: 24, fullScore: 28 },
            { category: '多选题', score: 14, fullScore: 18 },
            { category: '实验题', score: 12, fullScore: 14 },
            { category: '计算题', score: 32, fullScore: 40 },
          ],
        },
        {
          name: '化学',
          score: 78,
          fullScore: 100,
          subScores: [
            { category: '选择题', score: 36, fullScore: 42 },
            { category: '非选择题', score: 42, fullScore: 58 },
          ],
        },
        {
          name: '生物',
          score: 75,
          fullScore: 100,
          subScores: [
            { category: '选择题', score: 30, fullScore: 36 },
            { category: '非选择题', score: 45, fullScore: 64 },
          ],
        },
      ],
      rawText: text,
      confidence: 0.9,
    }

    res.json({ success: true, data: mockResult })
  } catch (error) {
    res.status(500).json({ success: false, error: '文本解析失败' })
  }
})

export default router
