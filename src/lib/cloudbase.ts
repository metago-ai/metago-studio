import cloudbase from '@cloudbase/js-sdk'

const ENV_ID = 'metago-d6gfw1e4rf2a5bcad'
const REGION = 'ap-shanghai'

export const isCloudConfigured = Boolean(ENV_ID)

let app: any = null

export function getApp(): any {
  if (app) return app
  try {
    app = cloudbase.init({
      env: ENV_ID,
      region: REGION,
      persistence: 'local',
    })
    return app
  } catch {
    return null
  }
}

export function getAuth(): any {
  const a = getApp()
  if (!a) return null
  return a.auth({ persistence: 'local' })
}

function extractUid(loginState: any): string | null {
  if (!loginState) return null
  return (
    loginState?.user?.uid ||
    loginState?.user?.id ||
    loginState?.uid ||
    loginState?.data?.user?.uid ||
    loginState?.data?.user?.id ||
    loginState?.data?.uid ||
    null
  )
}

function extractUserInfo(loginState: any): {
  uid: string
  email?: string
  phone?: string
  displayName?: string
  isAnonymous: boolean
  loginType?: string
} | null {
  const uid = extractUid(loginState)
  if (!uid) return null
  const user = loginState?.user || loginState?.data?.user || {}
  const isAnonymous = user.isAnonymous ?? (user.loginType === 'ANONYMOUS')
  // loginType 多源提取：不同 SDK 版本把登录类型存在不同位置
  const loginType = user.loginType
    || loginState?.loginType
    || loginState?.data?.loginType
    || loginState?.login_type
    || (user.provider ? String(user.provider).toUpperCase() : undefined)
  return {
    uid,
    email: user.email,
    phone: user.phoneNumber || user.phone,
    displayName: user.displayName || user.nickName || user.nickname || user.username,
    isAnonymous,
    loginType,
  }
}

export async function ensureLoggedIn(): Promise<string | null> {
  // 安全修复：此函数不再自动匿名登录，仅检查已有登录态。
  // 保留函数签名以避免破坏性变更，但行为已改为只读检查。
  const a = getApp()
  if (!a) return null
  const auth = a.auth({ persistence: 'local' })

  // 1. 检查已有登录态
  try {
    const state = auth.hasLoginState()
    const uid = extractUid(state)
    if (uid) {
      // 过滤匿名登录态
      const info = extractUserInfo(state)
      if (info && info.isAnonymous) return null
      return uid
    }
  } catch { /* ignore */ }

  // 2. 从 currentUser 获取
  try {
    const currentUser = auth.currentUser
    if (currentUser?.uid && !currentUser.isAnonymous) return currentUser.uid
  } catch { /* ignore */ }

  return null
}

export async function getCurrentUserInfo(): Promise<{
  uid: string
  email?: string
  phone?: string
  displayName?: string
  isAnonymous: boolean
  loginType?: string
} | null> {
  const a = getApp()
  if (!a) return null
  const auth = a.auth({ persistence: 'local' })
  try {
    const state = auth.hasLoginState()
    const info = extractUserInfo(state)
    // 安全修复：匿名登录态视为未登录，返回 null
    if (info && !info.isAnonymous) return info
  } catch { /* ignore */ }
  // 未登录或匿名：返回 null，由上层引导用户主动登录
  return null
}

export function getCurrentUserId(): string | null {
  const auth = getAuth()
  if (!auth) return null
  try {
    const state = auth.hasLoginState()
    return extractUid(state)
  } catch {
    return null
  }
}

export async function getDb(): Promise<any> {
  // 安全修复：不再自动匿名登录。仅对已登录用户提供数据库访问。
  const a = getApp()
  if (!a) return null
  try {
    const auth = a.auth({ persistence: 'local' })
    const state = auth.hasLoginState()
    const info = extractUserInfo(state)
    if (!info || info.isAnonymous) return null
  } catch { /* ignore */ }
  return a.database()
}

export async function signOutCloud(): Promise<void> {
  const a = getApp()
  if (!a) return
  try {
    await a.auth({ persistence: 'local' }).signOut()
  } catch { /* ignore */ }
}
