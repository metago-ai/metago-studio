/**
 * CloudBase 云函数调用封装
 *
 * 封装所有云函数调用，提供类型安全的接口。
 * 云函数部署在CloudBase服务端，具有服务端权威性。
 */

import { getApp, getCurrentUserInfo } from './cloudbase'
import type { BehaviorRecord, BehaviorCategory, CreditScore, CreditHistoryEntry, LeaderboardEntry } from '../types'

/** 从 localStorage 获取已登录用户的 userId（不依赖 CloudBase SDK 登录态） */
function getLoggedInUserId(): string | null {
  try {
    return localStorage.getItem('metago_user_id')
  } catch {
    return null
  }
}

export interface UserProfile {
  tier: 'free' | 'pro' | 'pro_plus' | 'team' | 'enterprise'
  email: string
  licenseKey: string
  activatedAt: string | null
  expiresAt: string | null
  seats: number
  teamHoursBalance?: number
  enterpriseSeats?: number
}

export interface DataStats {
  evolution_records: number
  decision_locks: number
  private_skills: number
  platform_configs: number
  sync_logs: number
}

/**
 * 调用云函数
 */
export async function callFunction<T = any>(name: string, data: Record<string, unknown>): Promise<{ code: number; message?: string; data: T | null }> {
  const app = getApp()
  if (!app) {
    return { code: 500, message: '云服务未配置', data: null }
  }
  // admin所有操作使用独立adminToken认证，不需要CloudBase用户登录
  // sync的submitFeedback允许未登录用户提交反馈
  // userManager 使用自带的 JWT 认证（token 在 payload 中传递），不依赖 CloudBase 登录态
  // aiProxy 允许未登录用户调用（Free 用户本地 10万 tokens/天 配额，由 tokenMeter 本地追踪）
  // behaviorBank 允许未登录用户调用读操作（getLevelInfo/getLeaderboard/getCreditScore 等），
  //   写操作（recordBehavior/recordBatch）的权限由云函数内部根据 openid 判断
  const skipAuth = name === 'admin' || name === 'aiProxy' || name === 'sync' && data.action === 'submitFeedback' || name === 'userManager' || name === 'behaviorBank'
  let currentUid: string | null = null
  if (skipAuth) {
    // 优先使用已登录用户的 userId（来自 userManager JWT 认证）
    currentUid = getLoggedInUserId()

    // CloudBase SDK 的 callFunction 需要登录态（匿名也行）。
    // 此匿名态仅保留在 SDK 层，getCurrentUserInfo() 会过滤匿名用户，UI 不会误显示。
    try {
      const auth = app.auth({ persistence: 'local' })
      if (!auth.hasLoginState()) {
        const loginResult = await auth.signInAnonymously()
        // 匿名用户兜底（仅在未登录用户场景）
        if (!currentUid) {
          if (loginResult?.user?.uid) {
            currentUid = loginResult.user.uid
          } else if (loginResult?.uid) {
            currentUid = loginResult.uid
          }
        }
      }
      // 兜底：从 currentUser 获取
      if (!currentUid) {
        const currentUser = await auth.currentUser?.()
        if (currentUser?.uid) {
          currentUid = currentUser.uid
        }
      }
      // 终极兜底：本地生成匿名 ID（持久化到 localStorage）
      // 此 ID 仅用于云函数识别"同一个未登录用户"，无安全含义
      if (!currentUid) {
        const LOCAL_KEY = 'metago_anon_uid'
        let anonUid = localStorage.getItem(LOCAL_KEY)
        if (!anonUid) {
          anonUid = 'anon_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10)
          localStorage.setItem(LOCAL_KEY, anonUid)
        }
        currentUid = anonUid
      }
    } catch { /* ignore */ }
  } else {
    // 需要用户登录的云函数：只检查已有登录态，绝不自动匿名登录
    const info = await getCurrentUserInfo()
    if (!info) {
      return { code: 401, message: '未登录', data: null }
    }
    currentUid = info.uid
  }
  try {
    // 关键修复：显式注入 uid，解决 CloudBase Web SDK 端云函数 getWXContext().OPENID 为空的问题。
    // Web SDK 的身份标识在 UID 字段，与小程序端的 OPENID 不同。
    // 传入 uid 作为 fallback，云函数据此识别用户（业务数据查询仍以该标识为主键）。
    const payload = { ...data }
    if (currentUid && !payload._clientUid) {
      payload._clientUid = currentUid
    }
    const res = await app.callFunction({
      name,
      data: payload,
    })
    if (res?.result === undefined || res?.result === null) {
      console.error(`[cloudFunctions] ${name} 返回空 result, 完整响应:`, JSON.stringify(res))
      return { code: 500, message: '云函数返回空', data: null }
    }
    return res.result
  } catch (e: any) {
    console.error(`[cloudFunctions] ${name} 调用失败:`, e)
    return { code: 500, message: e?.message || '云函数调用失败', data: null }
  }
}

// ============ 订阅管理 ============

/**
 * 获取用户订阅状态（服务端权威）
 */
export async function getProfile(): Promise<UserProfile | null> {
  const res = await callFunction<UserProfile>('subscription', { action: 'getProfile' })
  if (res.code !== 0 || !res.data) {
    console.warn('[subscription] getProfile failed:', res.message)
    return null
  }
  return res.data
}

/**
 * @deprecated V3 已下线 14 天免费试用。保留函数签名以兼容旧调用，将返回失败提示。
 * 新定价模式：Free / Pro / Pro+ / Team / Enterprise（无 Trial）
 */
export async function startTrialCloud(_contact: string): Promise<{ success: boolean; message: string; profile?: UserProfile }> {
  return { success: false, message: '14 天免费试用已下线，请直接订阅 Pro 或 Pro+' }
}

/**
 * 激活Pro授权码（服务端验证）
 * @param contact 联系标识：邮箱 / 手机号 / 昵称 / uid
 */
export async function activateProCloud(licenseKey: string, contact: string): Promise<{ success: boolean; message: string; profile?: UserProfile }> {
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)
  const payload = isEmail
    ? { action: 'activatePro', licenseKey, email: contact }
    : { action: 'activatePro', licenseKey, contact }
  const res = await callFunction<UserProfile>('subscription', payload)
  if (res.code !== 0 || !res.data) {
    return { success: false, message: res.message || '激活失败' }
  }
  return { success: true, message: res.message || 'Pro 激活成功', profile: res.data }
}

/**
 * 取消订阅
 */
export async function cancelSubscriptionCloud(): Promise<{ success: boolean; message: string }> {
  const res = await callFunction('subscription', { action: 'cancelSubscription' })
  if (res.code !== 0) {
    return { success: false, message: res.message || '取消失败' }
  }
  return { success: true, message: '订阅已取消' }
}

// ============ 数据同步 ============

/**
 * 获取数据统计
 */
export async function getDataStats(): Promise<DataStats | null> {
  const res = await callFunction<DataStats>('sync', { action: 'getStats' })
  if (res.code !== 0 || !res.data) {
    return null
  }
  return res.data
}

/**
 * 导出所有数据
 */
export async function exportAllData(): Promise<Record<string, any> | null> {
  const res = await callFunction('sync', { action: 'exportAll' })
  if (res.code !== 0 || !res.data) {
    return null
  }
  return res.data as Record<string, any>
}

/**
 * 清空所有数据
 */
export async function clearAllData(): Promise<{ success: boolean; message: string }> {
  const res = await callFunction('sync', { action: 'clearAll' })
  if (res.code !== 0) {
    return { success: false, message: res.message || '清空失败' }
  }
  return { success: true, message: '所有数据已清空' }
}

// ============ 事件上报（数据打通通道） ============

/**
 * 上报单条事件到 CloudBase（决策锁/进化/技能调用/活动）
 * 数据来源：Studio 前端操作、模板运行
 */
export async function reportEventCloud(
  eventType: string,
  data: Record<string, unknown>,
  platform?: string
): Promise<{ success: boolean; message: string }> {
  const res = await callFunction('events', {
    action: 'reportEvent',
    eventType,
    data,
    platform: platform || 'web-studio',
  })
  return { success: res.code === 0, message: res.message || '上报失败' }
}

/**
 * 查询当前用户的事件列表
 */
export async function getEventsCloud(options?: {
  type?: string
  platform?: string
  limit?: number
}): Promise<any[]> {
  const res = await callFunction<any[]>('events', { action: 'getEvents', ...options })
  return res.code === 0 ? (res.data || []) : []
}

/**
 * 获取度量统计（真实数据聚合，来自 events 集合）
 * 这是度量/进化页面的真实数据源
 */
export async function getMetricsFromCloud(days?: number): Promise<CloudMetrics | null> {
  const res = await callFunction<CloudMetrics>('events', { action: 'getMetrics', days: days || 30 })
  if (res.code !== 0 || !res.data) return null
  return res.data
}

/**
 * CloudMetrics 类型定义
 */
export interface CloudMetrics {
  decisionLock: {
    total: number
    passed: number
    blocked: number
    passRate: number
    stageBlocks: Record<string, number>
  }
  evolution: {
    total: number
    successRate: number
    maxDepth: number
    avgDuration: number
  }
  skills: {
    uniqueUsed: number
    totalCalls: number
    coverage: number
  }
  platforms: Record<string, number>
  recentEvents: Array<Record<string, unknown>>
}

// ============ 工单系统（优先支持） ============

/**
 * 创建工单
 */
export async function createTicketCloud(subject: string, body: string, category: string, priority: string): Promise<{ success: boolean; message: string }> {
  const res = await callFunction('support', { action: 'createTicket', subject, body, category, priority })
  return { success: res.code === 0, message: res.message || '创建失败' }
}

/**
 * 查询我的工单
 */
export async function listTicketsCloud(status?: string): Promise<any[]> {
  const res = await callFunction<Record<string, unknown>>('support', { action: 'listTickets', status: status || '' })
  if (res.code !== 0 || !res.data) return []
  const data = res.data as Record<string, unknown>
  return (data.tickets as any[]) || []
}

// ============ 管理后台 ============

/**
 * 调用管理后台云函数
 */
export async function callAdminFunction<T = any>(action: string, params: Record<string, unknown> = {}): Promise<{ code: number; message?: string; data: T | null }> {
  return callFunction<T>('admin', { action, ...params })
}

/**
 * 调用支付云函数
 */
export async function callPaymentFunction<T = any>(action: string, params: Record<string, unknown> = {}): Promise<{ code: number; message?: string; data: T | null }> {
  return callFunction<T>('payment', { action, ...params })
}

/**
 * 调用GitHub OAuth云函数
 */
export async function callGithubFunction<T = any>(action: string, params: Record<string, unknown> = {}): Promise<{ code: number; message?: string; data: T | null }> {
  return callFunction<T>('github-oauth', { action, ...params })
}

// ============ 行为银行（behaviorBank） ============

/**
 * 记录单条行为到行为银行（A/B 引擎入口）
 *
 * - digital 类别：用户数字贡献（代码/文档/社区/技能/Bug/模板）
 * - ai 类别：AI 自主行为（决策锁/元进化/合规/溯源/技能调用/输出完整性）
 *
 * 调用此函数后，云函数会自动重算信用分并更新 credit_scores 集合。
 */
export async function recordBehaviorCloud(params: {
  category: BehaviorCategory
  action?: string
  metadata?: Record<string, unknown>
  source?: string
  timestamp?: string
}): Promise<{ success: boolean; message: string; value?: number }> {
  const res = await callFunction<{ value: number; type: string; category: string }>('behaviorBank', {
    action: 'recordBehavior',
    ...params,
  })
  if (res.code !== 0) {
    return { success: false, message: res.message || '行为记录失败' }
  }
  return {
    success: true,
    message: res.message || '行为已记录',
    value: res.data?.value,
  }
}

/**
 * 批量记录行为（脚本同步用）
 */
export async function recordBehaviorBatchCloud(
  behaviors: Array<{ category: BehaviorCategory; action?: string; metadata?: Record<string, unknown>; source?: string; timestamp?: string }>,
  source?: string,
): Promise<{ success: boolean; message: string; inserted?: number }> {
  const res = await callFunction<{ inserted: string[] }>('behaviorBank', {
    action: 'recordBatch',
    behaviors,
    source,
  })
  if (res.code !== 0) {
    return { success: false, message: res.message || '批量记录失败' }
  }
  return {
    success: true,
    message: res.message || '批量记录成功',
    inserted: res.data?.inserted?.length,
  }
}

/**
 * 获取当前用户的信用分快照
 * 如果云端不存在，云函数会自动计算并写入。
 */
export async function getCreditScoreCloud(): Promise<CreditScore | null> {
  const res = await callFunction<CreditScore>('behaviorBank', { action: 'getCreditScore' })
  if (res.code !== 0 || !res.data) {
    console.warn('[behaviorBank] getCreditScore failed:', res.message)
    return null
  }
  return res.data
}

/**
 * 查询当前用户的行为记录（分页+过滤）
 */
export async function getBehaviorRecordsCloud(options?: {
  type?: 'digital' | 'ai'
  category?: BehaviorCategory
  limit?: number
  offset?: number
  startTime?: string
  endTime?: string
}): Promise<BehaviorRecord[]> {
  const res = await callFunction<BehaviorRecord[]>('behaviorBank', {
    action: 'getBehaviorRecords',
    ...options,
  })
  return res.code === 0 ? (res.data || []) : []
}

/**
 * 获取信用分历史（按日聚合）
 */
export async function getCreditHistoryCloud(days?: number): Promise<CreditHistoryEntry[]> {
  const res = await callFunction<CreditHistoryEntry[]>('behaviorBank', {
    action: 'getCreditHistory',
    days: days || 30,
  })
  return res.code === 0 ? (res.data || []) : []
}

/**
 * 获取信用分排行榜（开放 API 预留）
 */
export async function getLeaderboardCloud(limit?: number): Promise<LeaderboardEntry[]> {
  const res = await callFunction<LeaderboardEntry[]>('behaviorBank', {
    action: 'getLeaderboard',
    limit: limit || 20,
  })
  return res.code === 0 ? (res.data || []) : []
}

/**
 * 获取信用等级元信息（公开接口，未登录可调用）
 */
export async function getLevelInfoCloud(): Promise<{
  levels: Array<{ id: string; name: string; minScore: number; maxScore: number }>
  behaviorValues: Record<string, number>
  digitalCategories: string[]
  aiCategories: string[]
} | null> {
  const res = await callFunction<{
    levels: Array<{ id: string; name: string; minScore: number; maxScore: number }>
    behaviorValues: Record<string, number>
    digitalCategories: string[]
    aiCategories: string[]
  }>('behaviorBank', { action: 'getLevelInfo' })
  if (res.code !== 0 || !res.data) return null
  return res.data
}
