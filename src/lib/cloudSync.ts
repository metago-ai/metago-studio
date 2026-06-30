import { supabase } from './supabase'
import type { EvolutionRecord, DecisionLockRecord } from '../types'
import type { PrivateSkill } from './privateSkills'
import type { PlatformInfo, SyncLog } from './crossPlatformSync'

// ========== 进化档案 ==========

export async function cloudLoadEvolutionRecords(userId: string): Promise<EvolutionRecord[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('evolution_records')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error || !data) return []
  return data.map((r: Record<string, unknown>) => ({
    id: r.id,
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
}

export async function cloudSaveEvolutionRecord(userId: string, record: EvolutionRecord): Promise<void> {
  if (!supabase) return
  await supabase.from('evolution_records').insert({
    id: record.id,
    user_id: userId,
    trigger: record.trigger,
    boundary: record.boundary,
    action: record.generated,
    result: record.verified ? 'verified' : 'pending',
  })
}

export async function cloudDeleteEvolutionRecord(userId: string, recordId: string): Promise<void> {
  if (!supabase) return
  await supabase.from('evolution_records').delete().eq('user_id', userId).eq('id', recordId)
}

// ========== 决策锁记录 ==========

export async function cloudLoadDecisionLocks(userId: string): Promise<DecisionLockRecord[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('decision_locks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error || !data) return []
  return data.map((r: Record<string, unknown>) => ({
    id: r.id,
    timestamp: r.created_at,
    input: r.input_text,
    stages: [],
    totalDurationMs: 0,
    passed: r.overall_passed as boolean,
  })) as DecisionLockRecord[]
}

export async function cloudSaveDecisionLock(userId: string, record: DecisionLockRecord): Promise<void> {
  if (!supabase) return
  await supabase.from('decision_locks').insert({
    id: record.id,
    user_id: userId,
    input_text: record.input,
    output_text: record.stages.map((s) => s.details.map((d) => d.value).join(' ')).join('\n'),
    ivl_passed: record.stages[0]?.passed ?? false,
    ilt_passed: record.stages[1]?.passed ?? false,
    osg_passed: record.stages[2]?.passed ?? false,
    integrity_passed: record.stages[3]?.passed ?? false,
    overall_passed: record.passed,
  })
}

// ========== 私有技能 ==========

export async function cloudLoadPrivateSkills(userId: string): Promise<PrivateSkill[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('private_skills')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map((r: Record<string, unknown>) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    encryptedContent: r.encrypted_content ?? '',
    tags: r.tags ?? [],
    history: r.history ?? [],
    createdAt: r.created_at,
  })) as PrivateSkill[]
}

export async function cloudSavePrivateSkill(userId: string, skill: PrivateSkill): Promise<void> {
  if (!supabase) return
  await supabase.from('private_skills').upsert({
    id: skill.id,
    user_id: userId,
    name: skill.name,
    description: skill.description,
    encrypted_content: skill.encryptedContent,
    tags: skill.tags,
    history: skill.history,
  })
}

export async function cloudDeletePrivateSkill(userId: string, skillId: string): Promise<void> {
  if (!supabase) return
  await supabase.from('private_skills').delete().eq('user_id', userId).eq('id', skillId)
}

// ========== 平台配置 ==========

export async function cloudLoadPlatforms(userId: string): Promise<PlatformInfo[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('platform_configs')
    .select('*')
    .eq('user_id', userId)
  if (error || !data) return null
  return data as unknown as PlatformInfo[]
}

export async function cloudLoadSyncLogs(userId: string): Promise<SyncLog[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('sync_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error || !data) return null
  return data as unknown as SyncLog[]
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
