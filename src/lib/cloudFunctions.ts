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
  // subscription 使用 _clientUid 识别用户（与 aiProxy 一致），不依赖 CloudBase 登录态
  //   修复（2026-07-08）：userManager JWT 用户无 CloudBase 非匿名登录态，subscription 不在 skipAuth 中会导致 401
  //   support 使用独立工单系统，不依赖 CloudBase 登录态
  // events 使用 _clientUid 识别用户，不依赖 CloudBase 登录态
  // payment 使用独立支付系统，不依赖 CloudBase 登录态
  // github-oauth 使用独立 OAuth 流程，不依赖 CloudBase 登录态
  const skipAuth = name === 'admin' || name === 'aiProxy' || name === 'sync' && data.action === 'submitFeedback' || name === 'userManager' || name === 'behaviorBank' || name === 'subscription' || name === 'support' || name === 'events' || name === 'payment' || name === 'github-oauth'
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
      // 兜底：从 currentUser 获取（修复：currentUser 是属性不是方法）
      if (!currentUid) {
        const currentUser = auth.currentUser
        if (currentUser?.uid) {
          currentUid = currentUser.uid
        }
      }
    } catch (e) {
      // 匿名登录失败（可能控制台未启用），不阻塞——用本地 anon ID 兜底
      console.warn(`[cloudFunctions] ${name} 匿名登录失败，使用本地 anon ID:`, e)
    }
    // 终极兜底：本地生成匿名 ID（持久化到 localStorage）
    // 必须在 try/catch 外面，确保即使匿名登录抛异常也能执行
    if (!currentUid) {
      const LOCAL_KEY = 'metago_anon_uid'
      let anonUid: string | null = null
      try {
        anonUid = localStorage.getItem(LOCAL_KEY)
        if (!anonUid) {
          anonUid = 'anon_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10)
          localStorage.setItem(LOCAL_KEY, anonUid)
        }
      } catch {
        anonUid = 'anon_' + Date.now().toString(36)
      }
      currentUid = anonUid
    }
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

    // aiProxy 通过 HTTP 访问服务调用，绕过 CloudBase 网关层对匿名用户的 403 EXCEED_AUTHORITY 限制
    // HTTP 访问服务 URL: https://{envId}-{appId}.{region}.app.tcloudbase.com/api/aiproxy
    // 云函数内部已支持 HTTP 访问服务的 event 格式（event.body 是 JSON 字符串）
    if (name === 'aiProxy') {
      const AIPROXY_HTTP_URL = 'https://metago-d6gfw1e4rf2a5bcad-1257074864.ap-shanghai.app.tcloudbase.com/api/aiproxy'
      // V4.2：120 秒超时（覆盖分段生成每段 4096 token 的响应时间）
      // 分段生成方案下，每段 4096 token 需要 10-30 秒，120 秒足够覆盖极端慢场景
      // 如果 120 秒还没响应，说明 API 真的有问题，给用户明确错误
      const AI_TIMEOUT_MS = 120_000
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
      try {
        const httpRes = await fetch(AIPROXY_HTTP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        const httpData = await httpRes.json()
        if (httpData && httpData.code !== undefined) {
          return { code: httpData.code, message: httpData.message, data: httpData.data ?? null }
        }
        return { code: 0, message: 'ok', data: httpData }
      } catch (e: any) {
        clearTimeout(timeoutId)
        if (e?.name === 'AbortError') {
          console.error(`[cloudFunctions] aiProxy HTTP 超时（${AI_TIMEOUT_MS / 1000}s）`)
          return { code: 504, message: `AI 响应超时（${AI_TIMEOUT_MS / 1000}秒），请稍后重试或简化问题`, data: null }
        }
        console.error(`[cloudFunctions] aiProxy HTTP 调用失败:`, e)
        return { code: 500, message: e?.message || 'aiProxy HTTP 调用失败', data: null }
      }
    }

    const res = await app.callFunction({
      name,
      data: payload,
    })
    // 修复：CloudBase SDK 返回值可能是 { requestId, result } 或 { requestId, code, message }
    // 云函数返回 { code: 401, message: "未登录" } 时，SDK 可能把它放在顶层而不是 result 里
    if (res?.result !== undefined && res?.result !== null) {
      return res.result
    }
    // result 为空，检查顶层是否有 code/message（云函数业务错误直接放顶层的情况）
    if (res?.code !== undefined) {
      // 云函数返回了业务错误（如 401 未登录）
      return { code: res.code, message: res.message || '云函数业务错误', data: res.data ?? null }
    }
    console.error(`[cloudFunctions] ${name} 返回空 result, 完整响应:`, JSON.stringify(res))
    return { code: 500, message: '云函数返回空', data: null }
  } catch (e: any) {
    console.error(`[cloudFunctions] ${name} 调用失败:`, e)
    return { code: 500, message: e?.message || '云函数调用失败', data: null }
  }
}

// ============ 订阅管理 ============

/**
 * 获取用户订阅状态（服务端权威）
 *
 * V4.5（2026-07-08）：传入 licenseKey 作为 fallback，解决 openid 不匹配问题
 */
export async function getProfile(): Promise<UserProfile | null> {
  // 从 localStorage 读取 licenseKey，用于 openid 不匹配时的 fallback
  let licenseKey: string | undefined
  try {
    const raw = localStorage.getItem('metago_pro_license_v3')
    if (raw) {
      const info = JSON.parse(raw)
      licenseKey = info.licenseKey
    }
  } catch { /* ignore */ }

  const res = await callFunction<UserProfile>('subscription', {
    action: 'getProfile',
    ...(licenseKey ? { licenseKey } : {}),
  })
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
 *
 * shieldDimensions 8维护盾各维度详细数据结构（P1 深度分析面板数据源）：
 * - reliability/evolution 为特殊结构（基于决策锁/进化事件聚合）
 * - traceability/objectivity/compliance/integrity/lifeform 为通用技能维度结构（buildDimension）
 */
export interface SkillDimensionStats {
  callCount: number
  successCount: number
  successRate: number
  skills: Record<string, { count: number; successCount: number; lastCalled: string | null }>
  recentCalls: Array<{ skillId: string; timestamp: string; success: boolean; duration: number }>
}

export interface ShieldDimensions {
  reliability: {
    callCount: number
    passRate: number
    blocked: number
    stageBlocks: Record<string, number>
    recentCalls: Array<{ passed: boolean; stages?: Array<{ name: string; ok: boolean }>; timestamp: string }>
  }
  evolution: {
    callCount: number
    successRate: number
    maxDepth: number
    recentCalls: Array<{ trigger: string; boundary: string; verified: boolean; depth: number; timestamp: string }>
  }
  traceability: SkillDimensionStats
  objectivity: SkillDimensionStats
  compliance: SkillDimensionStats
  integrity: SkillDimensionStats
  lifeform: SkillDimensionStats
}

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
  shieldDimensions?: ShieldDimensions
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

// ============ FDE 服务模式项目管理 ============

export interface FdeTeamMember {
  role: 'tech_lead' | 'ai_engineer' | 'domain_expert' | 'ai_agent' | 'pm'
  name: string
  uid?: string
  agentId?: string
}

export interface FdeStage {
  name: string
  status: 'pending' | 'in_progress' | 'completed'
  startDate: string | null
  endDate: string | null
}

export interface FdeProject {
  _id: string
  projectName: string
  client: string
  clientContact: string
  description: string
  budget: number
  team: FdeTeamMember[]
  stages: FdeStage[]
  status: 'active' | 'completed' | 'paused' | 'cancelled'
  progress: number
  createdAt: string
  updatedAt: string
}

export async function createFdeProject(params: {
  projectName: string
  client: string
  clientContact?: string
  description?: string
  budget?: number
  team?: FdeTeamMember[]
  stages?: FdeStage[]
}): Promise<{ success: boolean; message: string; projectId?: string }> {
  const res = await callAdminFunction<{ _id: string }>('createFdeProject', params)
  return {
    success: res.code === 0,
    message: res.message || '创建失败',
    projectId: res.data?._id,
  }
}

export async function listFdeProjects(status?: string): Promise<FdeProject[]> {
  const res = await callAdminFunction<{ list: FdeProject[]; total: number }>('listFdeProjects', { status: status || '' })
  if (res.code !== 0 || !res.data) return []
  return res.data.list || []
}

export async function getFdeProject(projectId: string): Promise<FdeProject | null> {
  const res = await callAdminFunction<FdeProject>('getFdeProject', { projectId })
  if (res.code !== 0 || !res.data) return null
  return res.data
}

export async function updateFdeProject(projectId: string, updates: Partial<FdeProject>): Promise<{ success: boolean; message: string }> {
  const res = await callAdminFunction('updateFdeProject', { projectId, updates })
  return { success: res.code === 0, message: res.message || '更新失败' }
}

export async function deleteFdeProject(projectId: string): Promise<{ success: boolean; message: string }> {
  const res = await callAdminFunction('deleteFdeProject', { projectId })
  return { success: res.code === 0, message: res.message || '删除失败' }
}
