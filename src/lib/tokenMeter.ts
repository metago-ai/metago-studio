/**
 * Token 计量服务（V3 - 2026-07-06 安全加固版）
 *
 * V3 变更（修复严重漏洞）：
 *   - 旧版 Free 档位只读 localStorage，清缓存即可重置 100K 配额，可无限白嫖
 *   - V3 改为云端权威：所有 tier 配额查询走 aiProxy.getTokenUsage
 *   - localStorage 仅作显示缓存（避免每次发消息都查云），真实配额以云端为准
 *   - aiProxy.handleChat 已加服务端硬阻断，超额直接 402 拒绝（不调 LLM）
 *
 * 职责：
 *   1. 从 aiProxy 返回的 usage 字段提取 token 用量
 *   2. 本地累计（显示缓存，非权威源）
 *   3. 云端权威查询（所有 tier 都走 aiProxy.getTokenUsage）
 *   4. 提供"剩余额度"查询
 *   5. 触发超额警告
 *
 * 存储策略：
 *   - 所有 tier：云端 user_profiles.tokenUsage（权威源）
 *   - localStorage：仅作显示缓存，1 分钟内不重复查云
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

/** 查询当前配额状态（V3：所有 tier 都走云端权威查询） */
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

  // V3：所有 tier（包括 free）都走云端 aiProxy.getTokenUsage 权威查询
  // 旧版漏洞：free 只读 localStorage，清缓存即可重置 100K 配额
  // 现在：云端 user_profiles.tokenUsage.daily 是唯一权威源
  // V4.5（2026-07-08）：传入 licenseKey 作为 fallback，解决 openid 不匹配问题
  let cloudUsed = 0
  let cloudQuota = plan.tokenQuota
  let cloudPeriod: 'day' | 'month' | 'year' = plan.tokenQuotaPeriod
  let cloudTier = tier
  try {
    // 从 localStorage 读取 licenseKey，用于 openid 不匹配时的 fallback
    let licenseKey: string | undefined
    try {
      const raw = localStorage.getItem('metago_pro_license_v3')
      if (raw) {
        const info = JSON.parse(raw)
        licenseKey = info.licenseKey
      }
    } catch { /* ignore */ }

    const res = await callFunction<{
      used: number
      quota: number
      remaining: number
      tier: string
      period: 'day' | 'month' | 'year'
    }>('aiProxy', { action: 'getTokenUsage', ...(licenseKey ? { licenseKey } : {}) })
    if (res.code === 0 && res.data) {
      cloudUsed = res.data.used || 0
      cloudQuota = res.data.quota || plan.tokenQuota
      cloudPeriod = res.data.period || plan.tokenQuotaPeriod
      cloudTier = (res.data.tier as PlanTier) || tier
    }
  } catch (e) {
    console.warn('[tokenMeter] 云端配额查询失败，降级本地缓存', e)
    // 降级方案：用本地缓存（仅作显示，真实阻断由服务端保证）
    const localUsed = cloudPeriod === 'day' ? getLocalDailyUsage() : getLocalMonthlyUsage()
    cloudUsed = localUsed
  }

  // 同步本地缓存（用于离线显示，非权威）
  const used = cloudUsed
  const quota = cloudQuota
  const period = cloudPeriod
  const resetAt = period === 'day' ? getTomorrowReset() : period === 'month' ? getMonthReset() : ''

  return {
    tier: cloudTier,
    used,
    quota,
    remaining: Math.max(0, quota - used),
    period,
    resetAt,
    percentage: quota > 0 ? Math.min(100, (used / quota) * 100) : 0,
    byokActive,
    byokRequired: false,
    overageAllowed: plan.overagePricePerMillion > 0 && period === 'month',
    overagePricePerMillion: plan.overagePricePerMillion,
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
