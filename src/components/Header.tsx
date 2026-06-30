import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Sparkles, Shield, Dna, Play, Package,
  Crown, Lock, Settings as SettingsIcon, ExternalLink,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { UserMenu } from './UserMenu'

const NAV_ITEMS = [
  { to: '/', label: '首页', icon: LayoutDashboard, end: true },
  { to: '/skills', label: '技能库', icon: Sparkles, end: false },
  { to: '/decision-lock', label: '决策锁', icon: Shield, end: false },
  { to: '/evolution', label: '进化', icon: Dna, end: false },
  { to: '/templates', label: '模板', icon: Play, end: false },
  { to: '/kit', label: 'Kit', icon: Package, end: false },
]

const OFFICIAL_WEBSITE_URL = 'https://metago-ai.github.io/metago-website/'

export function Header() {
  const { tier, trialDaysRemaining } = useStore()
  const isPro = tier === 'pro' || tier === 'team' || tier === 'trial'

  return (
    <header className="h-16 flex-shrink-0 border-b border-border-subtle bg-bg-card/60 backdrop-blur-md flex items-center justify-between px-4 lg:px-6 z-10">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg overflow-hidden bg-gradient-to-br from-accent-emerald to-accent-teal flex items-center justify-center shadow-glow flex-shrink-0">
          <img
            src="./metago-logo-icon.png"
            alt="MetaGO Logo"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              const parent = e.currentTarget.parentElement
              if (parent) {
                const fallback = document.createElement('span')
                fallback.className = 'text-bg-deep font-bold text-lg leading-none'
                fallback.textContent = 'M'
                parent.appendChild(fallback)
              }
            }}
          />
        </div>
        <div className="min-w-0 hidden sm:block">
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-semibold text-zinc-100 leading-tight truncate">
              MetaGO Studio
            </h1>
          </div>
          <p className="text-[11px] text-zinc-500 leading-tight truncate">
            元构超级智能生命体可视化操作台
          </p>
        </div>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30'
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-bg-hover border border-transparent'
                }`
              }
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{item.label}</span>
            </NavLink>
          )
        })}

        {/* Pro 入口 */}
        <NavLink
          to="/private-skills"
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              isActive
                ? 'bg-accent-teal/15 text-accent-teal border border-accent-teal/30'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-bg-hover border border-transparent'
            }`
          }
          title="私有技能库"
        >
          <Lock className="w-3.5 h-3.5" />
          <span className="hidden md:inline">私有</span>
        </NavLink>

        <NavLink
          to="/pro"
          className={() =>
            `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              isPro
                ? 'bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30'
                : 'bg-accent-amber/10 text-accent-amber border border-accent-amber/30 hover:bg-accent-amber/20'
            }`
          }
          title={isPro ? `Pro${trialDaysRemaining > 0 ? ` · ${trialDaysRemaining}d` : ''}` : '升级 Pro'}
        >
          <Crown className="w-3.5 h-3.5" />
          <span className="hidden md:inline">
            {isPro ? (trialDaysRemaining > 0 ? `${trialDaysRemaining}d` : 'Pro') : 'Pro'}
          </span>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              isActive
                ? 'bg-zinc-700 text-zinc-100 border border-border-default'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-bg-hover border border-transparent'
            }`
          }
          title="设置"
        >
          <SettingsIcon className="w-3.5 h-3.5" />
        </NavLink>

        {/* 返回官网 */}
        <a
          href={OFFICIAL_WEBSITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap text-zinc-500 hover:text-accent-blue hover:bg-bg-hover border border-transparent"
          title="返回 MetaGO 官网"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden md:inline">官网</span>
        </a>

        {/* 用户菜单 */}
        <UserMenu />
      </nav>
    </header>
  )
}

