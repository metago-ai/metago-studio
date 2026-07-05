/**
 * Admin 云函数 HTTP 直连封装
 *
 * 通过 CloudBase HTTP 访问服务调用 admin 云函数，
 * 绕过 CloudBase SDK 用户认证系统。
 * admin 云函数使用独立的 adminToken 认证，不依赖 CloudBase 用户登录。
 */

const ADMIN_API_URL = 'https://metago.life/api/admin'

export interface AdminCallResult<T = any> {
  code: number
  message?: string
  data: T | null
}

export async function callAdminHttp<T = any>(
  action: string,
  params: Record<string, unknown> = {},
): Promise<AdminCallResult<T>> {
  const adminToken = localStorage.getItem('metago_admin_token') || ''
  const body = JSON.stringify({ action, adminToken, ...params })

  try {
    const res = await fetch(ADMIN_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    if (!res.ok) {
      return { code: res.status, message: `HTTP ${res.status}`, data: null }
    }
    const json = await res.json()
    return json ?? { code: 500, message: '返回空', data: null }
  } catch (e: any) {
    console.error('[adminHttp] 调用失败:', e)
    return { code: 500, message: e?.message || '网络请求失败', data: null }
  }
}
