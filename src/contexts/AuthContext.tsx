import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getAuth, isCloudConfigured, signOutCloud, getCurrentUserInfo } from '../lib/cloudbase'
import { callFunction } from '../lib/cloudFunctions'
import * as userService from '../lib/userService'

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
  // 真实用户系统（userManager 云函数 + JWT）
  registerWithPhone: (phone: string, password: string, nickname?: string) => Promise<{ error: string | null }>
  signInWithPhonePassword: (phone: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

/** 将 userService 的 UserProfile 映射为 CloudUser，统一用户态 */
function profileToCloudUser(p: userService.UserProfile): CloudUser {
  return {
    uid: p.userId,
    phone: p.phone,
    displayName: p.nickname,
    isAnonymous: false,
    loginType: 'PHONE',
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CloudUser | null>(null)
  const [loading, setLoading] = useState(true)

  const syncProfileToCloud = async (info: CloudUser | null) => {
    if (!info?.uid) return
    try {
      await callFunction('sync', {
        action: 'syncProfile',
        email: info.email,
        phone: info.phone,
        displayName: info.displayName,
        loginType: info.loginType || (info.isAnonymous ? 'ANONYMOUS' : 'EMAIL'),
      })
    } catch {
      // 同步失败不阻塞主流程，下次登录会再尝试
    }
  }

  const refreshUser = async () => {
    if (!isCloudConfigured) return
    const info = await getCurrentUserInfo()
    setUser(info)
    // 关键：将用户档案写入 user_profiles 集合，打通管理后台数据
    await syncProfileToCloud(info)
  }

  useEffect(() => {
    let cancelled = false
    const initAuth = async () => {
      // 1. 优先尝试 userService（JWT 真实用户系统）恢复会话
      try {
        const profile = await userService.getProfile()
        if (!cancelled && profile) {
          setUser(profileToCloudUser(profile))
          setLoading(false)
          return // 已通过 JWT 恢复会话
        }
      } catch {
        // 无 JWT token 或 token 失效，继续降级到 CloudBase 逻辑
      }

      // 2. 降级到 CloudBase 原有逻辑（邮箱 / GitHub 登录）
      if (!isCloudConfigured) {
        setLoading(false)
        return
      }
      try {
        // 安全策略：不主动清除匿名登录态。
        // 原因：CloudBase SDK 的 callFunction 需要登录态（匿名也行）。
        // getCurrentUserInfo() 已过滤匿名用户（返回 null），所以 UI 不会误显示。
        // 匿名态仅保留在 SDK 层，供 callFunction 使用，不影响用户界面。
        const info = await getCurrentUserInfo()
        if (!cancelled && info && !info.isAnonymous) {
          setUser(info)
          // 页面刷新场景：已登录用户档案同步到 user_profiles
          syncProfileToCloud(info)
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

  // ===== 真实用户系统（userManager 云函数 + JWT）=====

  const registerWithPhone = async (phone: string, password: string, nickname?: string) => {
    try {
      const { user: u } = await userService.register(phone, password, nickname)
      setUser(profileToCloudUser(u))
      return { error: null }
    } catch (e: any) {
      return { error: e?.message || '注册失败' }
    }
  }

  const signInWithPhonePassword = async (phone: string, password: string) => {
    try {
      const { user: u } = await userService.loginWithPassword(phone, password)
      setUser(profileToCloudUser(u))
      return { error: null }
    } catch (e: any) {
      return { error: e?.message || '登录失败' }
    }
  }

  const signOut = async () => {
    userService.logout() // 清理 JWT token（真实用户系统）
    await signOutCloud()
    setUser(null)
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
        registerWithPhone,
        signInWithPhonePassword,
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
