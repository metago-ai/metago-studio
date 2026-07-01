import cloudbase from '@cloudbase/js-sdk'

const ENV_ID = 'metago-d6gfw1e4rf2a5bcad'
const REGION = 'ap-shanghai'

export const isCloudConfigured = Boolean(ENV_ID)

let app: any = null
let initializing: Promise<string | null> | null = null

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
  return {
    uid,
    email: user.email,
    phone: user.phoneNumber || user.phone,
    displayName: user.displayName || user.nickName || user.nickname,
    isAnonymous: user.isAnonymous ?? (user.loginType === 'ANONYMOUS'),
    loginType: user.loginType,
  }
}

export async function ensureLoggedIn(): Promise<string | null> {
  if (initializing) {
    return initializing
  }
  initializing = (async () => {
    const a = getApp()
    if (!a) return null
    const auth = a.auth({ persistence: 'local' })

    // 1. 检查已有登录态
    try {
      const state = auth.hasLoginState()
      const uid = extractUid(state)
      if (uid) return uid
    } catch { /* ignore */ }

    // 2. 尝试匿名登录
    try {
      const loginRes = await auth.signInAnonymously()
      const uid = extractUid(loginRes) || extractUid(auth.hasLoginState())
      if (uid) return uid
    } catch { /* ignore */ }

    // 3. 最后尝试从currentUser获取
    try {
      const currentUser = auth.currentUser
      if (currentUser?.uid) return currentUser.uid
    } catch { /* ignore */ }

    return null
  })()
  const uid = await initializing
  initializing = null
  return uid
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
    if (info) return info
  } catch { /* ignore */ }
  // 确保已登录
  const uid = await ensureLoggedIn()
  if (!uid) return null
  try {
    const state = auth.hasLoginState()
    const info = extractUserInfo(state)
    if (info) return info
    return { uid, isAnonymous: true, loginType: 'ANONYMOUS' }
  } catch {
    return { uid, isAnonymous: true, loginType: 'ANONYMOUS' }
  }
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
  await ensureLoggedIn()
  const a = getApp()
  if (!a) return null
  return a.database()
}

export async function signOutCloud(): Promise<void> {
  const a = getApp()
  if (!a) return
  try {
    await a.auth({ persistence: 'local' }).signOut()
  } catch { /* ignore */ }
}
