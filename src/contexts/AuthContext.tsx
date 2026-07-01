import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getAuth, isCloudConfigured, ensureLoggedIn, signOutCloud, getCurrentUserInfo } from '../lib/cloudbase'

interface CloudUser {
  uid: string
  email?: string
  phone?: string
  displayName?: string
  isAnonymous: boolean
  loginType?: string
}

type PhoneVerifyFn = (token: string) => Promise<{ error: string | null }>

interface AuthContextValue {
  user: CloudUser | null
  loading: boolean
  isCloudMode: boolean
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithGitHub: () => Promise<{ error: string | null }>
  signInWithPhone: (phone: string) => Promise<{ error: string | null; verifyFn?: PhoneVerifyFn }>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CloudUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    if (!isCloudConfigured) return
    const info = await getCurrentUserInfo()
    setUser(info)
  }

  useEffect(() => {
    let cancelled = false
    const initAuth = async () => {
      if (!isCloudConfigured) {
        setLoading(false)
        return
      }
      try {
        // 确保匿名登录（如果没有登录态）
        await ensureLoggedIn()
        // 获取当前用户信息
        const info = await getCurrentUserInfo()
        if (!cancelled) {
          setUser(info)
        }
      } catch {
        // ignore init errors
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    initAuth()
    return () => { cancelled = true }
  }, [])

  const signUpWithEmail = async (email: string, password: string) => {
    const auth = getAuth()
    if (!auth) return { error: '云服务未配置' }
    try {
      const res = await auth.signUp({ email, password })
      if (res?.error) return { error: res.error.message || '注册失败' }
      // 注册后自动登录
      await refreshUser()
      return { error: null }
    } catch (e: any) {
      return { error: e?.message || '注册失败' }
    }
  }

  const signInWithEmail = async (email: string, password: string) => {
    const auth = getAuth()
    if (!auth) return { error: '云服务未配置' }
    try {
      const res = await auth.signInWithPassword({ email, password })
      if (res?.error) return { error: res.error.message || '登录失败' }
      await refreshUser()
      return { error: null }
    } catch (e: any) {
      return { error: e?.message || '登录失败' }
    }
  }

  const signInWithGitHub = async () => {
    const auth = getAuth()
    if (!auth) return { error: '云服务未配置' }
    try {
      await auth.signInWithOAuth({ provider: 'github' })
      return { error: null }
    } catch (e: any) {
      return { error: e?.message || 'GitHub 登录暂未配置' }
    }
  }

  const signInWithPhone = async (phone: string) => {
    const auth = getAuth()
    if (!auth) return { error: '云服务未配置' }
    try {
      const phoneNum = phone.startsWith('+') ? phone : `+86${phone.replace(/\s/g, '')}`
      const res = await auth.signInWithOtp({ phone: phoneNum })
      if (res?.error) return { error: res.error.message || '发送验证码失败' }
      if (!res?.data?.verifyOtp) return { error: '验证码发送异常：未返回验证函数' }
      const verifyFn: PhoneVerifyFn = async (token: string) => {
        try {
          const { error } = await res.data.verifyOtp({ token: String(token) })
          if (error) return { error: error.message || '验证码错误' }
          await refreshUser()
          return { error: null }
        } catch (e: any) {
          return { error: e?.message || '验证码错误' }
        }
      }
      return { error: null, verifyFn }
    } catch (e: any) {
      return { error: e?.message || '发送验证码失败' }
    }
  }

  const signOut = async () => {
    await signOutCloud()
    setUser(null)
    // 退出后重新匿名登录，保持基本功能可用
    await ensureLoggedIn()
    const info = await getCurrentUserInfo()
    setUser(info)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isCloudMode: isCloudConfigured,
        signUpWithEmail,
        signInWithEmail,
        signInWithGitHub,
        signInWithPhone,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
