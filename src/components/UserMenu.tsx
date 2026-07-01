import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut, Settings as SettingsIcon, ChevronDown, User as UserIcon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export function UserMenu() {
  const { user, signOut, isCloudMode } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (!isCloudMode) {
    return (
      <span
        title="云服务未配置，数据存储于本地浏览器"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-zinc-700/50 text-zinc-400 border border-border-subtle whitespace-nowrap"
      >
        本地模式
      </span>
    )
  }

  if (!user) {
    return (
      <button
        onClick={() => navigate('/auth')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30 hover:bg-accent-emerald/25 transition-colors whitespace-nowrap"
      >
        登录
      </button>
    )
  }

  const displayName = user.displayName ?? user.email ?? user.phone ?? '用户'
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs hover:bg-bg-hover transition-colors"
      >
        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-accent-emerald to-accent-teal flex items-center justify-center text-bg-deep font-bold text-xs">
          {initial}
        </span>
        <ChevronDown className="w-3 h-3 text-zinc-500" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-border-subtle bg-bg-card shadow-xl py-2 z-50">
          <div className="px-3 py-2 border-b border-border-subtle">
            <p className="text-xs text-zinc-500">
              {user.isAnonymous ? '游客模式' : '已登录'}
            </p>
            <p className="text-sm text-zinc-200 truncate">{displayName}</p>
          </div>
          <NavLink
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:bg-bg-hover hover:text-zinc-200 transition-colors"
          >
            <UserIcon className="w-3.5 h-3.5" /> 我的
          </NavLink>
          <NavLink
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:bg-bg-hover hover:text-zinc-200 transition-colors"
          >
            <SettingsIcon className="w-3.5 h-3.5" /> 设置
          </NavLink>
          <button
            onClick={async () => { await signOut(); setOpen(false); navigate('/') }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-accent-rose hover:bg-bg-hover transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> {user.isAnonymous ? '退出游客' : '登出'}
          </button>
        </div>
      )}
    </div>
  )
}
