import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useStore } from '../store/useStore'

interface AuthContextValue {
  user: User | null
  loading: boolean
  isCloudMode: boolean
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithGitHub: () => Promise<{ error: string | null }>
  signInWithPhone: (phone: string) => Promise<{ error: string | null }>
  verifyPhone: (phone: string, token: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      setLoading(false)
      useStore.getState().setCloudUser(u?.id ?? null)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      useStore.getState().setCloudUser(u?.id ?? null)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const signUpWithEmail = async (email: string, password: string) => {
    if (!supabase) return { error: '云服务未配置' }
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null }
  }

  const signInWithEmail = async (email: string, password: string) => {
    if (!supabase) return { error: '云服务未配置' }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signInWithGitHub = async () => {
    if (!supabase) return { error: '云服务未配置' }
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'github' })
    return { error: error?.message ?? null }
  }

  const signInWithPhone = async (phone: string) => {
    if (!supabase) return { error: '云服务未配置' }
    const { error } = await supabase.auth.signInWithOtp({ phone })
    return { error: error?.message ?? null }
  }

  const verifyPhone = async (phone: string, token: string) => {
    if (!supabase) return { error: '云服务未配置' }
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isCloudMode: isSupabaseConfigured,
        signUpWithEmail,
        signInWithEmail,
        signInWithGitHub,
        signInWithPhone,
        verifyPhone,
        signOut,
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
