import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Sparkles, Shield, Dna, Play, Package, Activity,
  Crown, Lock, Settings as SettingsIcon, ExternalLink,
  HelpCircle, User as UserIcon, Menu, X, Bot, Briefcase, Award, ShieldCheck,
  Microscope, Rocket, ChevronDown,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { UserMenu } from './UserMenu'
import { LifeformStatus } from './LifeformStatus'

// 主导航：核心 6 项，直接显示在顶栏
const PRIMARY_NAV = [
  { to: '/', label: '首页', icon: LayoutDashboard, end: true },
  { to: '/agent', label: '智能体', icon: Bot, end: false },
  { to: '/roles', label: 'AI员工', icon: Briefcase, end: false },
  { to: '/skills', label: '技能库', icon: Sparkles, end: false },
  { to: '/evolution', label: '进化', icon: Dna, end: false },
  { to: '/shield', label: '护盾', icon: ShieldCheck, end: false },
]

// 次要导航：收进"更多"下拉
const MORE_NAV = [
  { to: '/decision-lock', label: '决策锁', icon: Shield, end: false },
  { to: '/depth-analysis', label: '深度分析', icon: Microscope, end: false },
  { to: '/fde', label: 'FDE工作台', icon: Rocket, end: false },
  { to: '/metrics', label: '度量', icon: Activity, end: false },
  { to: '/behavior-bank', label: '行为银行', icon: Award, end: false },
  { to: '/templates', label: '模板', icon: Play, end: false },
  { to: '/kit', label: 'Kit', icon: Package, end: false },
]

const SECONDARY_ITEMS = [
  { to: '/private-skills', label: '私有技能', icon: Lock },
  { to: '/certify', label: '认证', icon: ShieldCheck },
  { to: '/pro', label: 'Pro', icon: Crown },
  { to: '/profile', label: '我的', icon: UserIcon },
  { to: '/settings', label: '设置', icon: SettingsIcon },
  { to: '/help', label: '帮助', icon: HelpCircle },
]

const OFFICIAL_WEBSITE_URL = 'https://metago.life'

export function Header() {
  const { tier } = useStore()
  const isPro = tier === 'pro' || tier === 'pro_plus' || tier === 'team' || tier === 'enterprise'
  const [mobileOpen, setMobileOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <header className="h-16 flex-shrink-0 border-b border-border-subtle bg-bg-card/60 backdrop-blur-md flex items-center justify-between px-4 lg:px-6 z-30 relative">
      {/* 左侧：Logo + 标题（精简，副标题改短为"驭智层操作台"） */}
      <div className="flex items-center gap-2.5 min-w-0 flex-shrink-0">
        <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
          <img
            src="./metago-logo-icon.png"
            alt="MetaGO Logo"
            className="w-full h-full object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              const parent = e.currentTarget.parentElement
              if (parent) {
                const fallback = document.createElement('span')
                fallback.className = 'text-accent-emerald font-bold text-lg leading-none'
                fallback.textContent = 'M'
                parent.appendChild(fallback)
              }
            }}
          />
        </div>
        <div className="min-w-0 hidden sm:block">
          <h1 className="text-sm font-semibold text-zinc-100 leading-tight truncate">
            MetaGO Studio
          </h1>
          <p className="text-[10px] text-zinc-500 leading-tight truncate">
            驭智层操作台
          </p>
        </div>
      </div>

      {/* 桌面端导航（md 及以上） */}
      <nav className="hidden md:flex items-center gap-1 flex-1 justify-center min-w-0 px-2">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30'
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-bg-hover border border-transparent'
                }`
              }
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}

        {/* 更多下拉：收进 7 个次要项 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            onBlur={() => setTimeout(() => setMoreOpen(false), 150)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              moreOpen
                ? 'bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-bg-hover border border-transparent'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>更多</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
          </button>
          {moreOpen && (
            <div className="absolute top-full left-0 mt-1 w-44 bg-bg-card border border-border-subtle rounded-lg shadow-xl py-1 z-50">
              {MORE_NAV.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onMouseDown={(e) => e.preventDefault()}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-2 text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-accent-emerald/15 text-accent-emerald'
                          : 'text-zinc-400 hover:text-zinc-100 hover:bg-bg-hover'
                      }`
                    }
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          )}
        </div>
      </nav>

      {/* 右侧：状态 + 用户区（图标化节省空间） */}
      <div className="hidden md:flex items-center gap-1 flex-shrink-0">
        <NavLink
          to="/pro"
          className={() =>
            `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              isPro
                ? 'bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30'
                : 'bg-accent-amber/10 text-accent-amber border border-accent-amber/30 hover:bg-accent-amber/20'
            }`
          }
          title={isPro ? 'Pro 已激活' : '升级 Pro'}
        >
          <Crown className="w-3.5 h-3.5" />
          <span>Pro</span>
        </NavLink>

        <NavLink
          to="/private-skills"
          className={({ isActive }) =>
            `flex items-center justify-center w-8 h-8 rounded-lg text-xs font-medium transition-all ${
              isActive
                ? 'bg-accent-teal/15 text-accent-teal border border-accent-teal/30'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-bg-hover border border-transparent'
            }`
          }
          title="私有技能库"
        >
          <Lock className="w-3.5 h-3.5" />
        </NavLink>

        <NavLink
          to="/certify"
          className={({ isActive }) =>
            `flex items-center justify-center w-8 h-8 rounded-lg text-xs font-medium transition-all ${
              isActive
                ? 'bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-bg-hover border border-transparent'
            }`
          }
          title="认证"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center justify-center w-8 h-8 rounded-lg text-xs font-medium transition-all ${
              isActive
                ? 'bg-zinc-700 text-zinc-100 border border-border-default'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-bg-hover border border-transparent'
            }`
          }
          title="设置"
        >
          <SettingsIcon className="w-3.5 h-3.5" />
        </NavLink>

        <NavLink
          to="/help"
          className={({ isActive }) =>
            `flex items-center justify-center w-8 h-8 rounded-lg text-xs font-medium transition-all ${
              isActive
                ? 'bg-zinc-700 text-zinc-100 border border-border-default'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-bg-hover border border-transparent'
            }`
          }
          title="帮助"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </NavLink>

        <a
          href={OFFICIAL_WEBSITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-xs font-medium transition-all text-zinc-500 hover:text-accent-blue hover:bg-bg-hover border border-transparent"
          title="返回 MetaGO 官网"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>

        <LifeformStatus compact />

        <UserMenu />
      </div>

      {/* 移动端汉堡按钮（md 以下） */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-zinc-300 hover:bg-bg-hover border border-border-subtle"
        aria-label="菜单"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* 移动端下拉菜单 */}
      {mobileOpen && (
        <>
          {/* 遮罩 */}
          <div
            className="md:hidden fixed inset-0 top-16 bg-bg-deep/60 backdrop-blur-sm z-20"
            onClick={() => setMobileOpen(false)}
          />
          {/* 菜单面板 */}
          <div className="md:hidden absolute top-16 left-0 right-0 bg-bg-card border-b border-border-subtle shadow-lg z-30 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="p-3 space-y-1">
              {/* 主导航 */}
              <div className="text-[10px] text-zinc-600 uppercase tracking-wider px-2 py-1">导航</div>
              {[...PRIMARY_NAV, ...MORE_NAV].map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30'
                          : 'text-zinc-300 hover:bg-bg-hover border border-transparent'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </NavLink>
                )
              })}

              {/* 次要导航 */}
              <div className="text-[10px] text-zinc-600 uppercase tracking-wider px-2 py-1 pt-3">账户</div>
              {SECONDARY_ITEMS.map((item) => {
                const Icon = item.icon
                const label = item.to === '/pro' && isPro
                  ? 'Pro 已激活'
                  : item.label
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30'
                          : 'text-zinc-300 hover:bg-bg-hover border border-transparent'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </NavLink>
                )
              })}

              {/* 官网链接 */}
              <a
                href={OFFICIAL_WEBSITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-300 hover:bg-bg-hover border border-transparent"
              >
                <ExternalLink className="w-4 h-4" />
                返回官网
              </a>

              {/* 用户菜单 */}
              <div className="pt-2 border-t border-border-subtle">
                <UserMenu />
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  )
}
