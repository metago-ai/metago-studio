/**
 * 用户服务（V2 - 2026-07-05）
 *
 * V2 变更：
 *   - 配额从"次数"改为"Token"
 *   - checkQuota() 委托 tokenMeter.getQuotaStatus()，返回 Token 维度的 QuotaInfo
 *   - recordUsage(modelId) 已废弃：改为 no-op，由 aiClient.ts 直接调用 tokenMeter.recordUsage
 *   - Free 用户本地配额：10万 tokens/天（V4 Flash）
 *
 * 保留：
 *   - 注册/登录/getProfile/logout 等身份相关函数不变
 *   - JWT token 仍存 localStorage('metago_token')
 */

import { callFunction } from './cloudFunctions'
import { getCurrentTier } from './proGate'
import { PRICING_PLANS } from './pricing'
import { getQuotaStatus as getTokenQuotaStatus, type QuotaStatus } from './tokenMeter'

export interface UserProfile {
  userId: string
  phone: string
  nickname: string
  avatar: string
  plan: 'free' | 'pro' | 'team' | 'enterprise'
  planExpiresAt: string | null
}

/**
 * Token 维度配额信息（V2）
 * - remaining/total/used 单位均为 tokens
 * - isUnlimited=true 表示不限量（Pro 服务端旧字段兼容 / BYOK 激活 / Enterprise 强制 BYOK）
 * - tier 供调用方判断档位（替代旧 `remaining === -1` 的 hack）
 */
export interface QuotaInfo {
  remaining: number       // 剩余 tokens，isUnlimited 时为 Infinity
  total: number           // 总配额 tokens，isUnlimited 时为 Infinity
  used: number            // 已用 tokens
  tier: string            // 当前档位
  isUnlimited: boolean    // 是否不限量
  period: 'day' | 'month' | 'year'
  byokActive: boolean
  /** @deprecated 已废弃，仅为兼容旧调用方，永远等于 used */
  count?: number
}

function getToken(): string | null {
  return localStorage.getItem('metago_token')
}

function setToken(token: string) {
  localStorage.setItem('metago_token', token)
}

function clearToken() {
  localStorage.removeItem('metago_token')
  localStorage.removeItem('metago_user_id')  // 同步清除 userId
}

/** 获取已登录用户的 userId（用于云函数身份识别） */
export function getUserId(): string | null {
  return localStorage.getItem('metago_user_id')
}

// ============ 身份相关（不变）============

export async function register(phone: string, password: string, nickname?: string): Promise<{ user: UserProfile; token: string }> {
  const res = await callFunction<any>('userManager', { action: 'register', phone, password, nickname })
  if (res.code !== 0) throw new Error(res.message)
  setToken(res.data.token)
  // 关键修复：持久化 userId，用于 aiProxy 云函数身份识别
  if (res.data.user?.userId) {
    localStorage.setItem('metago_user_id', res.data.user.userId)
  }
  return res.data
}

export async function loginWithPassword(phone: string, password: string): Promise<{ user: UserProfile; token: string }> {
  const res = await callFunction<any>('userManager', { action: 'login', phone, password })
  if (res.code !== 0) throw new Error(res.message)
  setToken(res.data.token)
  // 关键修复：持久化 userId，用于 aiProxy 云函数身份识别
  if (res.data.user?.userId) {
    localStorage.setItem('metago_user_id', res.data.user.userId)
  }
  return res.data
}

export async function getProfile(): Promise<UserProfile | null> {
  const token = getToken()
  if (!token) return null
  const res = await callFunction<any>('userManager', { action: 'getProfile', token })
  if (res.code !== 0) { clearToken(); return null }
  return res.data
}

// ============ 配额查询（V2 - Token 维度）============

/**
 * 查询当前 Token 配额状态
 *
 * 委托 tokenMeter.getQuotaStatus()，兼容旧 QuotaInfo 返回结构。
 * 旧调用方仍可读取 remaining/total/used，但语义已从"次数"变为"tokens"。
 * 新调用方应优先使用 tier / isUnlimited / byokActive 字段。
 */
export async function checkQuota(): Promise<QuotaInfo> {
  // 未登录用户：直接走本地免费配额（10万 tokens/天）
  const token = getToken()
  if (!token) {
    return getLocalQuota()
  }

  // 已登录用户：委托 tokenMeter（内部会查询云端月配额）
  try {
    const status = await getTokenQuotaStatus()
    return quotaStatusToInfo(status)
  } catch (e) {
    console.warn('[userService] 云端配额查询失败，降级本地', e)
    return getLocalQuota()
  }
}

function quotaStatusToInfo(status: QuotaStatus): QuotaInfo {
  const isUnlimited = status.byokActive || status.byokRequired
  return {
    remaining: isUnlimited ? Infinity : status.remaining,
    total: isUnlimited ? Infinity : status.quota,
    used: status.used,
    tier: status.tier,
    isUnlimited,
    period: status.period,
    byokActive: status.byokActive,
    count: status.used, // 兼容旧字段
  }
}

// ============ 使用记录（V2 - 已废弃）============

/**
 * @deprecated V2 已废弃
 *
 * 旧版按"次数"记录使用，V2 改为 Token 计量后，此函数不再执行任何操作。
 * Token 上报由 aiClient.ts 在每次 LLM 调用返回后，直接调用：
 *   tokenMeter.recordUsage(tokenMeter.extractUsage(res.data.usage, model.id))
 *
 * 保留此函数仅为兼容旧调用方，调用方应迁移至 tokenMeter。
 */
export async function recordUsage(_modelId: string): Promise<void> {
  console.warn('[userService] recordUsage(modelId) 已废弃，请改用 tokenMeter.recordUsage(usage)')
  // no-op
}

// ============ 退出 ============

export function logout() {
  clearToken()
}

// ============ 本地配额（未登录降级方案）============

function getLocalQuota(): QuotaInfo {
  const tier = getCurrentTier()
  const plan = PRICING_PLANS[tier]
  const period = plan.tokenQuotaPeriod
  const used = period === 'day' ? getLocalDailyUsage() : getLocalMonthlyUsage()
  const quota = plan.tokenQuota
  return {
    remaining: Math.max(0, quota - used),
    total: quota,
    used,
    tier,
    isUnlimited: false,
    period,
    byokActive: false,
    count: used,
  }
}

const LOCAL_USAGE_KEY = 'metago_token_usage_v2'

function getLocalDailyUsage(date = new Date().toISOString().slice(0, 10)): number {
  try {
    const raw = localStorage.getItem(LOCAL_USAGE_KEY)
    if (!raw) return 0
    const store = JSON.parse(raw) as { daily?: Record<string, number> }
    return store.daily?.[date] || 0
  } catch {
    return 0
  }
}

function getLocalMonthlyUsage(month = new Date().toISOString().slice(0, 7)): number {
  try {
    const raw = localStorage.getItem(LOCAL_USAGE_KEY)
    if (!raw) return 0
    const store = JSON.parse(raw) as { monthly?: Record<string, number> }
    return store.monthly?.[month] || 0
  } catch {
    return 0
  }
}

export function isLoggedIn(): boolean {
  return !!getToken()
}
