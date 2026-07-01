import { getDb } from './cloudbase'
import type { EvolutionRecord, DecisionLockRecord } from '../types'
import type { PrivateSkill } from './privateSkills'
import type { PlatformInfo, SyncLog } from './crossPlatformSync'

// ========== 进化档案 ==========

export async function cloudLoadEvolutionRecords(userId: string): Promise<EvolutionRecord[]> {
  const db = await getDb()
  if (!db) return []
  try {
    const res = await db.collection('evolution_records')
      .where({ _openid: userId })
      .orderBy('created_at', 'desc')
      .limit(1000)
      .get()
    const data = res?.data ?? []
    return data.map((r: Record<string, unknown>) => ({
      id: r._id ?? r.id,
      timestamp: r.created_at,
      trigger: r.trigger,
      boundary: r.boundary,
      gap: r.gap ?? '',
      generated: r.action ?? '',
      verified: r.result === 'verified',
      recursed: false,
      durationMs: 0,
      depth: 0,
    })) as EvolutionRecord[]
  } catch {
    return []
  }
}

export async function cloudSaveEvolutionRecord(userId: string, record: EvolutionRecord): Promise<void> {
  const db = await getDb()
  if (!db) return
  try {
    await db.collection('evolution_records').add({
      _id: record.id,
      _openid: userId,
      trigger: record.trigger,
      boundary: record.boundary,
      gap: record.gap,
      action: record.generated,
      result: record.verified ? 'verified' : 'pending',
      created_at: record.timestamp,
    })
  } catch { /* ignore */ }
}

export async function cloudDeleteEvolutionRecord(userId: string, recordId: string): Promise<void> {
  const db = await getDb()
  if (!db) return
  try {
    await db.collection('evolution_records')
      .where({ _openid: userId, _id: recordId })
      .remove()
  } catch { /* ignore */ }
}

// ========== 决策锁记录 ==========

export async function cloudLoadDecisionLocks(userId: string): Promise<DecisionLockRecord[]> {
  const db = await getDb()
  if (!db) return []
  try {
    const res = await db.collection('decision_locks')
      .where({ _openid: userId })
      .orderBy('created_at', 'desc')
      .limit(500)
      .get()
    const data = res?.data ?? []
    return data.map((r: Record<string, unknown>) => ({
      id: r._id ?? r.id,
      timestamp: r.created_at,
      input: r.input_text,
      stages: [],
      totalDurationMs: 0,
      passed: r.overall_passed as boolean,
    })) as DecisionLockRecord[]
  } catch {
    return []
  }
}

export async function cloudSaveDecisionLock(userId: string, record: DecisionLockRecord): Promise<void> {
  const db = await getDb()
  if (!db) return
  try {
    await db.collection('decision_locks').add({
      _id: record.id,
      _openid: userId,
      input_text: record.input,
      output_text: record.stages.map((s) => s.details.map((d) => d.value).join(' ')).join('\n'),
      ivl_passed: record.stages[0]?.passed ?? false,
      ilt_passed: record.stages[1]?.passed ?? false,
      osg_passed: record.stages[2]?.passed ?? false,
      integrity_passed: record.stages[3]?.passed ?? false,
      overall_passed: record.passed,
      created_at: record.timestamp,
    })
  } catch { /* ignore */ }
}

// ========== 私有技能 ==========

export async function cloudLoadPrivateSkills(userId: string): Promise<PrivateSkill[]> {
  const db = await getDb()
  if (!db) return []
  try {
    const res = await db.collection('private_skills')
      .where({ _openid: userId })
      .orderBy('created_at', 'desc')
      .get()
    const data = res?.data ?? []
    return data.map((r: Record<string, unknown>) => ({
      id: r._id ?? r.id,
      name: r.name,
      description: r.description ?? '',
      encryptedContent: r.encrypted_content ?? '',
      tags: r.tags ?? [],
      history: r.history ?? [],
      createdAt: r.created_at,
    })) as PrivateSkill[]
  } catch {
    return []
  }
}

export async function cloudSavePrivateSkill(userId: string, skill: PrivateSkill): Promise<void> {
  const db = await getDb()
  if (!db) return
  try {
    await db.collection('private_skills').doc(skill.id).set({
      _openid: userId,
      name: skill.name,
      description: skill.description,
      encrypted_content: skill.encryptedContent,
      tags: skill.tags,
      history: skill.history,
      created_at: skill.createdAt,
    })
  } catch { /* ignore */ }
}

export async function cloudDeletePrivateSkill(userId: string, skillId: string): Promise<void> {
  const db = await getDb()
  if (!db) return
  try {
    await db.collection('private_skills')
      .where({ _openid: userId, _id: skillId })
      .remove()
  } catch { /* ignore */ }
}

// ========== 平台配置 ==========

export async function cloudLoadPlatforms(userId: string): Promise<PlatformInfo[] | null> {
  const db = await getDb()
  if (!db) return null
  try {
    const res = await db.collection('platform_configs')
      .where({ _openid: userId })
      .get()
    return (res?.data ?? []) as unknown as PlatformInfo[]
  } catch {
    return null
  }
}

export async function cloudLoadSyncLogs(userId: string): Promise<SyncLog[] | null> {
  const db = await getDb()
  if (!db) return null
  try {
    const res = await db.collection('sync_logs')
      .where({ _openid: userId })
      .orderBy('created_at', 'desc')
      .limit(100)
      .get()
    return (res?.data ?? []) as unknown as SyncLog[]
  } catch {
    return null
  }
}

// ========== 批量同步 ==========

export interface CloudData {
  evolutionRecords: EvolutionRecord[]
  decisionLocks: DecisionLockRecord[]
  privateSkills: PrivateSkill[]
  platforms: PlatformInfo[] | null
  syncLogs: SyncLog[] | null
}

export async function loadAllFromCloud(userId: string): Promise<CloudData> {
  const [evolutionRecords, decisionLocks, privateSkills, platforms, syncLogs] = await Promise.all([
    cloudLoadEvolutionRecords(userId),
    cloudLoadDecisionLocks(userId),
    cloudLoadPrivateSkills(userId),
    cloudLoadPlatforms(userId),
    cloudLoadSyncLogs(userId),
  ])
  return { evolutionRecords, decisionLocks, privateSkills, platforms, syncLogs }
}
