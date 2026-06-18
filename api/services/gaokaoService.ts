import db from '../db/index.js'
import { v4 as uuidv4 } from 'uuid'

const GAKAO_BASE = 'https://static-data.gaokao.cn/www/2.0'
const LIAONING_PROVINCE_ID = '21'
const FETCH_TIMEOUT = 5000
const TOP_N_UNIVERSITIES = 200

interface GaokaoSchoolCodeEntry {
  school_id: string
  name: string
}

interface GaokaoSchoolInfo {
  school_id: string
  name: string
  province_name?: string
  province_id?: string
  type_name?: string
  school_type?: string
  f985?: string
  f211?: string
  dual_class?: string
  dual_class_name?: string
  [key: string]: unknown
}

interface GaokaoProvinceLine {
  province_id: string
  year: string | number
  local_type_name: string
  local_batch_name: string
  min?: number | string
  min_section?: number | string
  average?: number | string
  [key: string]: unknown
}

async function fetchWithTimeout(url: string, timeout: number = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { signal: controller.signal })
    return response
  } finally {
    clearTimeout(timer)
  }
}

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const response = await fetchWithTimeout(url)
    if (!response.ok) {
      console.error(`[gaokaoService] HTTP ${response.status} for ${url}`)
      return null
    }
    const data = await response.json()
    if (data.code !== '0000') {
      console.error(`[gaokaoService] API error code=${data.code} message=${data.message} for ${url}`)
      return null
    }
    return data.data as T
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.error(`[gaokaoService] Request timeout for ${url}`)
    } else {
      console.error(`[gaokaoService] Fetch error for ${url}:`, (error as Error).message)
    }
    return null
  }
}

function updateSyncStatus(type: string, status: string, recordCount?: number): void {
  const id = `sync_${type}`
  const existing = db.prepare('SELECT * FROM sync_status WHERE id = ?').get(id) as any

  if (existing) {
    const updates: string[] = []
    const values: any[] = []

    updates.push('status = ?')
    values.push(status)

    if (status === 'completed' || status === 'idle') {
      updates.push('last_sync_at = CURRENT_TIMESTAMP')
    }

    if (recordCount !== undefined) {
      updates.push('record_count = ?')
      values.push(recordCount)
    }

    values.push(id)
    db.prepare(`UPDATE sync_status SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  } else {
    db.prepare(
      'INSERT INTO sync_status (id, type, last_sync_at, record_count, status) VALUES (?, ?, ?, ?, ?)'
    ).run(id, type, status === 'completed' || status === 'idle' ? new Date().toISOString() : null, recordCount ?? 0, status)
  }
}

function getSyncStatus(type: string): any {
  const id = `sync_${type}`
  return db.prepare('SELECT * FROM sync_status WHERE id = ?').get(id)
}

function buildTypeString(info: GaokaoSchoolInfo): string {
  const types: string[] = []
  if (String(info.f985) === '1') types.push('985')
  if (String(info.f211) === '1') types.push('211')
  if (String(info.dual_class) === '1' || info.dual_class_name) types.push('双一流')
  if (types.length === 0) types.push('普通')
  return types.join(',')
}

export async function syncUniversities(limit: number = TOP_N_UNIVERSITIES): Promise<{
  synced: number
  errors: number
}> {
  const existingSync = getSyncStatus('universities')
  if (existingSync?.status === 'syncing') {
    throw new Error('同步正在进行中，请稍后再试')
  }

  updateSyncStatus('universities', 'syncing')

  let synced = 0
  let errors = 0

  try {
    // Step 1: Fetch school list
    const schoolData = await fetchJSON<Record<string, GaokaoSchoolCodeEntry>>(
      `${GAKAO_BASE}/school/school_code.json`
    )

    if (!schoolData) {
      updateSyncStatus('universities', 'failed')
      throw new Error('无法获取学校列表')
    }

    // Convert to array and sort by school_id for consistent ordering
    const schools = Object.values(schoolData)
      .filter(s => s.school_id && s.name)
      .sort((a, b) => parseInt(a.school_id) - parseInt(b.school_id))
      .slice(0, limit)

    console.log(`[gaokaoService] Found ${schools.length} schools to sync`)

    // Step 2: Fetch info for each school and upsert into DB
    const upsertUniversity = db.prepare(`
      INSERT INTO universities (id, name, province, type, gaokao_id)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(gaokao_id) DO UPDATE SET
        name = excluded.name,
        province = excluded.province,
        type = excluded.type
    `)

    const transaction = db.transaction(() => {
      for (const school of schools) {
        try {
          // Check if already synced by gaokao_id
          const existing = db.prepare('SELECT id FROM universities WHERE gaokao_id = ?').get(school.school_id) as any
          if (existing) {
            synced++
            continue
          }

          // Insert with basic info first, will enrich later
          const id = uuidv4()
          upsertUniversity.run(id, school.name, '未知', '普通', school.school_id)
          synced++
        } catch (err) {
          console.error(`[gaokaoService] Error inserting school ${school.school_id}:`, (err as Error).message)
          errors++
        }
      }
    })

    transaction()

    // Step 3: Enrich school info in batches (non-blocking, process in chunks)
    const universitiesWithoutInfo = db.prepare(
      "SELECT id, gaokao_id, name FROM universities WHERE gaokao_id IS NOT NULL AND province = '未知'"
    ).all() as any[]

    console.log(`[gaokaoService] Enriching info for ${universitiesWithoutInfo.length} schools`)

    for (const u of universitiesWithoutInfo) {
      try {
        const info = await fetchJSON<GaokaoSchoolInfo>(
          `${GAKAO_BASE}/school/${u.gaokao_id}/info.json`
        )

        if (info) {
          const province = info.province_name || '未知'
          const type = buildTypeString(info)
          db.prepare('UPDATE universities SET province = ?, type = ? WHERE id = ?')
            .run(province, type, u.id)
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (err) {
        console.error(`[gaokaoService] Error enriching school ${u.gaokao_id}:`, (err as Error).message)
        errors++
      }
    }

    const totalUniversities = (db.prepare('SELECT COUNT(*) as cnt FROM universities').get() as any).cnt
    updateSyncStatus('universities', 'completed', totalUniversities)

    console.log(`[gaokaoService] Sync completed: ${synced} synced, ${errors} errors`)
  } catch (error) {
    updateSyncStatus('universities', 'failed')
    throw error
  }

  return { synced, errors }
}

export async function syncSchoolScores(gaokaoSchoolId: string): Promise<{
  synced: number
  errors: number
}> {
  const university = db.prepare('SELECT * FROM universities WHERE gaokao_id = ?').get(gaokaoSchoolId) as any
  if (!university) {
    throw new Error(`未找到 gaokao_id=${gaokaoSchoolId} 的大学`)
  }

  const scoreData = await fetchJSON<GaokaoProvinceLine[]>(
    `${GAKAO_BASE}/school/${gaokaoSchoolId}/provinceline.json`
  )

  if (!scoreData) {
    return { synced: 0, errors: 1 }
  }

  // Filter for Liaoning province
  const liaoningScores = scoreData.filter(
    (s: GaokaoProvinceLine) => String(s.province_id) === LIAONING_PROVINCE_ID
  )

  let synced = 0
  let errors = 0

  const upsertScore = db.prepare(`
    INSERT INTO gaokao_admission_scores (id, university_id, year, category, batch, min_score, min_rank, avg_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(university_id, year, category, batch) DO UPDATE SET
      min_score = excluded.min_score,
      min_rank = excluded.min_rank,
      avg_score = excluded.avg_score
  `)

  const transaction = db.transaction(() => {
    for (const score of liaoningScores) {
      try {
        const id = uuidv4()
        const year = parseInt(String(score.year))
        const category = score.local_type_name || '未知'
        const batch = score.local_batch_name || '未知'
        const minScore = score.min ? parseFloat(String(score.min)) : null
        const minRank = score.min_section ? parseInt(String(score.min_section)) : null
        const avgScore = score.average ? parseFloat(String(score.average)) : null

        upsertScore.run(id, university.id, year, category, batch, minScore, minRank, avgScore)
        synced++
      } catch (err) {
        console.error(`[gaokaoService] Error inserting score:`, (err as Error).message)
        errors++
      }
    }
  })

  transaction()

  // Update sync status for scores
  const totalScores = (db.prepare('SELECT COUNT(*) as cnt FROM gaokao_admission_scores').get() as any).cnt
  updateSyncStatus('scores', 'completed', totalScores)

  return { synced, errors }
}

export async function syncAllScores(): Promise<{
  synced: number
  errors: number
}> {
  const existingSync = getSyncStatus('scores')
  if (existingSync?.status === 'syncing') {
    throw new Error('分数同步正在进行中，请稍后再试')
  }

  updateSyncStatus('scores', 'syncing')

  let totalSynced = 0
  let totalErrors = 0

  try {
    const universities = db.prepare(
      'SELECT id, gaokao_id FROM universities WHERE gaokao_id IS NOT NULL'
    ).all() as any[]

    console.log(`[gaokaoService] Syncing scores for ${universities.length} schools`)

    for (const u of universities) {
      try {
        const result = await syncSchoolScores(u.gaokao_id)
        totalSynced += result.synced
        totalErrors += result.errors

        // Small delay between schools
        await new Promise(resolve => setTimeout(resolve, 200))
      } catch (err) {
        console.error(`[gaokaoService] Error syncing scores for ${u.gaokao_id}:`, (err as Error).message)
        totalErrors++
      }
    }

    const totalScores = (db.prepare('SELECT COUNT(*) as cnt FROM gaokao_admission_scores').get() as any).cnt
    updateSyncStatus('scores', 'completed', totalScores)
  } catch (error) {
    updateSyncStatus('scores', 'failed')
    throw error
  }

  return { synced: totalSynced, errors: totalErrors }
}

export function getSyncStatusAll(): {
  universities: any
  scores: any
} {
  return {
    universities: getSyncStatus('universities') || { type: 'universities', status: 'never_synced', record_count: 0 },
    scores: getSyncStatus('scores') || { type: 'scores', status: 'never_synced', record_count: 0 },
  }
}
