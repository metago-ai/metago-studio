import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sparkles, Dna, Shield, Code2, Scale, Play, ArrowRight, TrendingUp,
  Activity as ActivityIcon, Crown, Settings as SettingsIcon,
} from 'lucide-react'
import { StatCard } from '../components/StatCard'
import { ActivityList } from '../components/ActivityList'
import { useStore } from '../store/useStore'
import { useAuth } from '../contexts/AuthContext'
import { TIER_INFO } from '../lib/proGate'

const QUICK_ENTRIES = [
  {
    id: 'tpl-code-review',
    name: '代码审查',
    icon: Code2,
    description: '检出 CWE-89/79/22 等安全漏洞',
    accent: 'emerald' as const,
    to: '/templates',
  },
  {
    id: 'tpl-risk-decision',
    name: '风险决策',
    icon: Scale,
    description: '5 维度评估：价值/成本/风险',
    accent: 'amber' as const,
    to: '/templates',
  },
  {
    id: 'tpl-meta-evolve',
    name: '元进化',
    icon: Dna,
    description: '五阶段循环：边界→递归',
    accent: 'teal' as const,
    to: '/evolution',
  },
]

const ACCENT_MAP = {
  emerald: 'from-accent-emerald/20 to-accent-emerald/5 border-accent-emerald/30 hover:border-accent-emerald/60',
  teal: 'from-accent-teal/20 to-accent-teal/5 border-accent-teal/30 hover:border-accent-teal/60',
  amber: 'from-accent-amber/20 to-accent-amber/5 border-accent-amber/30 hover:border-accent-amber/60',
}

export function Dashboard() {
  const { skills, evolutionStats, activities, decisionLockHistory, tier, lockStats } = useStore()
  const { user } = useAuth()

  const passRate = lockStats.passRate.toFixed(1)
  const displayName = user?.displayName || user?.email || user?.phone || (user?.isAnonymous ? '探索者' : '开发者')
  const isLoggedIn = user && !user.isAnonymous
  const maxDailyCount = Math.max(...evolutionStats.dailyCounts.map(d => d.count), 1)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            {isLoggedIn ? '欢迎回来' : '欢迎'}，{displayName}
            <span className="text-2xl">👋</span>
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            MetaGO Studio · 元构超级智能生命体可视化操作台
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/pro"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
              tier === 'free'
                ? 'bg-accent-amber/10 border-accent-amber/30 text-accent-amber hover:bg-accent-amber/20'
                : 'bg-accent-emerald/10 border-accent-emerald/30 text-accent-emerald'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            {tier === 'free' ? '升级 Pro' : TIER_INFO[tier].name}
          </Link>
          <Link
            to="/settings"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bg-elevated border border-border-subtle text-zinc-400 hover:text-zinc-200 text-xs"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
          </Link>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard
          icon={Sparkles}
          label="技能总数"
          value={skills.length}
          hint="10 大能力族"
          accent="emerald"
        />
        <StatCard
          icon={Dna}
          label="进化次数"
          value={evolutionStats.totalEvolutions}
          hint={evolutionStats.totalEvolutions > 0 ? `成功率 ${evolutionStats.successRate.toFixed(1)}%` : '尚未开始'}
          accent="teal"
          trend={evolutionStats.last7Days > 0 ? { value: `+${evolutionStats.last7Days}`, positive: true } : undefined}
        />
        <StatCard
          icon={Shield}
          label="校验通过率"
          value={decisionLockHistory.length > 0 ? `${passRate}%` : '—'}
          hint={decisionLockHistory.length > 0 ? `${decisionLockHistory.length} 次校验` : '尚未校验'}
          accent="blue"
        />
        <StatCard
          icon={ActivityIcon}
          label="平均进化耗时"
          value={evolutionStats.averageDurationMs > 0 ? `${evolutionStats.averageDurationMs}ms` : '—'}
          hint="P50 延迟"
          accent="amber"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Play className="w-4 h-4 text-accent-emerald" />
            快速入口
          </h2>
          <Link
            to="/templates"
            className="text-xs text-zinc-500 hover:text-accent-emerald transition-colors flex items-center gap-1"
          >
            查看全部 <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {QUICK_ENTRIES.map((entry) => {
            const Icon = entry.icon
            return (
              <Link
                key={entry.id}
                to={entry.to}
                className={`card-base p-5 bg-gradient-to-br ${ACCENT_MAP[entry.accent]} border transition-all duration-200 hover:scale-[1.02] hover:shadow-glow group`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-bg-deep/60 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icon className="w-6 h-6 text-zinc-100" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-zinc-100 mb-1">{entry.name}</h3>
                    <p className="text-xs text-zinc-400">{entry.description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-100 group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            )
          })}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
      >
        <div className="lg:col-span-2">
          <ActivityList activities={activities} />
        </div>
        <div className="card-base p-5">
          <h3 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent-teal" />
            进化趋势（7 天）
          </h3>
          {evolutionStats.dailyCounts.length === 0 ? (
            <div className="text-center py-8">
              <Dna className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">暂无进化记录</p>
              <p className="text-[10px] text-zinc-600 mt-1">添加进化档案后将显示趋势</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {evolutionStats.dailyCounts.map((day, i) => (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500 w-12">{day.date.slice(5)}</span>
                    <div className="flex-1 h-6 bg-bg-elevated/50 rounded overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(day.count / maxDailyCount) * 100}%` }}
                        transition={{ duration: 0.5, delay: 0.2 + i * 0.05 }}
                        className="h-full bg-gradient-to-r from-accent-emerald/60 to-accent-teal/60 rounded"
                      />
                    </div>
                    <span className="text-xs text-zinc-400 w-6 text-right">{day.count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border-subtle">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">本周合计</span>
                  <span className="text-accent-emerald font-semibold">
                    {evolutionStats.last7Days} 次进化
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Footer */}
      <footer className="card-base p-4 mt-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-zinc-600">
          <div className="flex items-center gap-3">
            <span>© 2026 MetaGO</span>
            <span className="text-zinc-700">·</span>
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">
              蜀ICP备2026035958号
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/terms" className="hover:text-zinc-400 transition-colors">用户协议</Link>
            <Link to="/privacy" className="hover:text-zinc-400 transition-colors">隐私政策</Link>
            <Link to="/refund" className="hover:text-zinc-400 transition-colors">退款政策</Link>
            <Link to="/help" className="hover:text-zinc-400 transition-colors">帮助中心</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
