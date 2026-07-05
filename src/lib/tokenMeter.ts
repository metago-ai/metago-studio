/**
 * Token 计量服务（V2 - 2026-07-05）
 *
 * 职责：
 *   1. 从 aiProxy 返回的 usage 字段提取 token 用量
 *   2. 本地累计（Free 用户日配额）
 *   3. 云端同步（Pro/Team 月配额）
 *   4. 提供"剩余额度"查询
 *   5. 触发超额警告
 *
 * 存储策略：
 *   - Free 用户：localStorage（按日累计，每天重置）
 *   - Pro/Team：云端 user_profiles.tokenUsage（按月累计，每月1日重置）
 *   - Enterprise：强制 BYOK，不计量
 */

import { callFunction } from './cloudFunctions'
import { getCurrentTier } from './proGate'
import { PRICING_PLANS, type PlanTier } from './pricing'
import { isByokActive } from './byokService'

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cacheHitTokens?: number
  model: string
  timestamp: string
}

export interface QuotaStatus {
  tier: PlanTier
  used: number
  quota: number
  remaining: number
  period: 'day' | 'month' | 'year'
  resetAt: string
  percentage: number
  byokActive: boolean
  byokRequired: boolean
  overageAllowed: boolean
  overagePricePerMillion: number
}

const LOCAL_USAGE_KEY = 'metago_token_usage_v2'

interface LocalUsageStore {
  daily: Record<string, number>
  monthly: Record<string, number>
  lastSyncAt: string | null
}

function loadLocalStore(): LocalUsageStore {
  try {
    const raw = localStorage.getItem(LOCAL_USAGE_KEY)
    if (!raw) return { daily: {}, monthly: {}, lastSyncAt: null }
    return JSON.parse(raw) as LocalUsageStore
  } catch {
    return { daily: {}, monthly: {}, lastSyncAt: null }
  }
}

function saveLocalStore(store: LocalUsageStore): void {
  try {
    localStorage.setItem(LOCAL_USAGE_KEY, JSON.stringify(store))
  } catch (e) {
    console.error('[tokenMeter] 保存本地用量失败', e)
  }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function monthStr(): string {
  return new Date().toISOString().slice(0, 7)
}

function getTomorrowReset(): string {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  return tomorrow.toISOString()
}

function getMonthReset(): string {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return nextMonth.toISOString()
}

/** 记录单次使用（本地+云端） */
export async function recordUsage(usage: TokenUsage): Promise<void> {
  recordLocalUsage(usage)
  try {
    await callFunction('aiProxy', {
      action: 'recordTokenUsage',
      usage,
    })
  } catch (e) {
    console.warn('[tokenMeter] 云端上报失败（不影响使用）', e)
  }
}

function recordLocalUsage(usage: TokenUsage): void {
  const store = loadLocalStore()
  const today = todayStr()
  const month = monthStr()
  store.daily[today] = (store.daily[today] || 0) + usage.totalTokens
  store.monthly[month] = (store.monthly[month] || 0) + usage.totalTokens
  store.lastSyncAt = new Date().toISOString()
  saveLocalStore(store)
}

function getLocalDailyUsage(date = todayStr()): number {
  const store = loadLocalStore()
  return store.daily[date] || 0
}

function getLocalMonthlyUsage(month = monthStr()): number {
  const store = loadLocalStore()
  return store.monthly[month] || 0
}

/** 查询当前配额状态 */
export async function getQuotaStatus(): Promise<QuotaStatus> {
  const tier = getCurrentTier()
  const plan = PRICING_PLANS[tier]

  if (plan.byokRequired) {
    return {
      tier,
      used: 0,
      quota: 0,
      remaining: 0,
      period: 'year',
      resetAt: '',
      percentage: 0,
      byokActive: true,
      byokRequired: true,
      overageAllowed: false,
      overagePricePerMillion: 0,
    }
  }

  const byokActive = isByokActive()

  if (plan.tokenQuotaPeriod === 'day') {
    const used = getLocalDailyUsage()
    const quota = plan.tokenQuota
    return {
      tier,
      used,
      quota,
      remaining: Math.max(0, quota - used),
      period: 'day',
      resetAt: getTomorrowReset(),
      percentage: Math.min(100, (used / quota) * 100),
      byokActive,
      byokRequired: false,
      overageAllowed: false,
      overagePricePerMillion: 0,
    }
  }

  if (plan.tokenQuotaPeriod === 'month') {
    const localUsed = getLocalMonthlyUsage()
    let cloudUsed = 0
    try {
      const res = await callFunction<{ used: number }>('subscription', {
        action: 'getTokenUsage',
      })
      if (res.code === 0 && res.data) {
        cloudUsed = res.data.used || 0
      }
    } catch (e) {
      console.warn('[tokenMeter] 云端配额查询失败，使用本地数据', e)
    }

    const used = Math.max(localUsed, cloudUsed)
    const quota = plan.tokenQuota
    return {
      tier,
      used,
      quota,
      remaining: Math.max(0, quota - used),
      period: 'month',
      resetAt: getMonthReset(),
      percentage: Math.min(100, (used / quota) * 100),
      byokActive,
      byokRequired: false,
      overageAllowed: plan.overagePricePerMillion > 0,
      overagePricePerMillion: plan.overagePricePerMillion,
    }
  }

  return {
    tier,
    used: 0,
    quota: 0,
    remaining: 0,
    period: 'year',
    resetAt: '',
    percentage: 0,
    byokActive,
    byokRequired: false,
    overageAllowed: false,
    overagePricePerMillion: 0,
  }
}

/** 检查是否还能继续对话（基于 Token 配额） */
export async function canSendMessage(): Promise<{ allowed: boolean; reason?: string; status: QuotaStatus }> {
  const status = await getQuotaStatus()

  if (status.byokActive || status.byokRequired) {
    return { allowed: true, status }
  }

  if (status.remaining <= 0) {
    if (status.overageAllowed) {
      return { allowed: true, status, reason: 'overage' }
    }
    return {
      allowed: false,
      status,
      reason: `今日/本月 Token 配额已用完，请升级或绑定自己的 API Key`,
    }
  }

  return { allowed: true, status }
}

/** 从 LLM 返回的 usage 中提取标准化 TokenUsage */
export function extractUsage(
  rawUsage: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    prompt_cache_hit_tokens?: number
    prompt_tokens_details?: { cached_tokens?: number }
  } | undefined,
  model: string,
): TokenUsage {
  const promptTokens = rawUsage?.prompt_tokens || 0
  const completionTokens = rawUsage?.completion_tokens || 0
  const totalTokens = rawUsage?.total_tokens || promptTokens + completionTokens
  const cacheHitTokens =
    rawUsage?.prompt_cache_hit_tokens ||
    rawUsage?.prompt_tokens_details?.cached_tokens ||
    0
  return {
    promptTokens,
    completionTokens,
    totalTokens,
    cacheHitTokens,
    model,
    timestamp: new Date().toISOString(),
  }
}

// ============ BYOK 状态：详见 byokService.ts ============
// 其他文件应直接从 byokService.ts 导入 BYOK 相关函数

/** 清空本地用量（管理员/调试用） */
export function clearLocalUsage(): void {
  localStorage.removeItem(LOCAL_USAGE_KEY)
}
