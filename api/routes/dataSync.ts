import { Router, type Request, type Response } from 'express'
import { syncUniversities, syncSchoolScores, getSyncStatusAll } from '../services/gaokaoService.js'

const router = Router()

// POST /api/data-sync/sync-universities - Trigger sync from gaokao.cn
router.post('/sync-universities', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 200
    const result = await syncUniversities(limit)
    res.json({
      success: true,
      data: result,
      message: `同步完成：${result.synced} 所大学已同步，${result.errors} 个错误`,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message || '同步大学数据失败',
    })
  }
})

// GET /api/data-sync/status - Get sync status
router.get('/status', (req: Request, res: Response): void => {
  try {
    const status = getSyncStatusAll()
    res.json({ success: true, data: status })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取同步状态失败' })
  }
})

// POST /api/data-sync/sync-scores/:schoolId - Sync scores for a specific school
router.post('/sync-scores/:schoolId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { schoolId } = req.params
    const result = await syncSchoolScores(schoolId)
    res.json({
      success: true,
      data: result,
      message: `分数同步完成：${result.synced} 条记录已同步，${result.errors} 个错误`,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message || '同步分数数据失败',
    })
  }
})

export default router
