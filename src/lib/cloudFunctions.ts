/**
 * CloudBase 云函数调用封装
 *
 * 封装所有云函数调用，提供类型安全的接口。
 * 云函数部署在CloudBase服务端，具有服务端权威性。
 */

import { getApp, ensureLoggedIn } from './cloudbase'

export interface UserProfile {
  tier: 'free' | 'trial' | 'pro' | 'team'
  email: string
  licenseKey: string
  activatedAt: string | null
  expiresAt: string | null
  trialStartedAt: string | null
  seats: number
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
  // admin的login和checkAuth不需要CloudBase用户登录
  const skipAuth = name === 'admin' && (data.action === 'login' || data.action === 'checkAuth')
  if (!skipAuth) {
    await ensureLoggedIn()
  }
  try {
    const res = await app.callFunction({
      name,
      data,
    })
    return res?.result ?? { code: 500, message: '云函数返回空', data: null }
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
 * 启动14天免费试用
 */
export async function startTrialCloud(email: string): Promise<{ success: boolean; message: string; profile?: UserProfile }> {
  const res = await callFunction<UserProfile>('subscription', { action: 'startTrial', email })
  if (res.code !== 0 || !res.data) {
    return { success: false, message: res.message || '启动试用失败' }
  }
  return { success: true, message: '14天免费试用已启动', profile: res.data }
}

/**
 * 激活Pro授权码（服务端验证）
 */
export async function activateProCloud(licenseKey: string, email: string): Promise<{ success: boolean; message: string; profile?: UserProfile }> {
  const res = await callFunction<UserProfile>('subscription', { action: 'activatePro', licenseKey, email })
  if (res.code !== 0 || !res.data) {
    return { success: false, message: res.message || '激活失败' }
  }
  return { success: true, message: 'Pro 激活成功', profile: res.data }
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
