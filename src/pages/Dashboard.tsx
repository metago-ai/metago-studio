import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sparkles,
  Dna,
  Shield,
  Code2,
  Scale,
  Play,
  ArrowRight,
  TrendingUp,
  Activity as ActivityIcon,
} from 'lucide-react'
import { StatCard } from '../components/StatCard'
import { ActivityList } from '../components/ActivityList'
import { useStore } from '../store/useStore'

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
  const { skills, evolutionStats, activities, decisionLockHistory } = useStore()

  const passRate = (
    (decisionLockHistory.filter((r) => r.passed).length / decisionLockHistory.length) *
    100
  ).toFixed(1)

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
            欢迎回来，易霄
            <span className="text-2xl">👋</span>
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            MetaGO Studio · 元构超级智能生命体可视化操作台
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-emerald/10 border border-accent-emerald/30">
          <div className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse-glow" />
          <span className="text-xs text-accent-emerald font-medium">系统运行中</span>
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
          trend={{ value: '2 新增', positive: true }}
        />
        <StatCard
          icon={Dna}
          label="进化次数"
          value={evolutionStats.totalEvolutions}
          hint={`成功率 ${(evolutionStats.successRate * 100).toFixed(1)}%`}
          accent="teal"
          trend={{ value: `+${evolutionStats.last7Days}`, positive: true }}
        />
        <StatCard
          icon={Shield}
          label="校验通过率"
          value={`${passRate}%`}
          hint={`${decisionLockHistory.length} 次校验`}
          accent="blue"
        />
        <StatCard
          icon={ActivityIcon}
          label="平均进化耗时"
          value={`${evolutionStats.averageDurationMs}ms`}
          hint="P50 延迟"
          accent="amber"
          trend={{ value: '-12%', positive: true }}
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
          <div className="space-y-2">
            {evolutionStats.dailyCounts.map((day, i) => (
              <div key={day.date} className="flex items-center gap-3">
                <span className="text-xs text-zinc-500 w-12">{day.date}</span>
                <div className="flex-1 h-6 bg-bg-elevated/50 rounded overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(day.count / 2) * 100}%` }}
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
        </div>
      </motion.div>
    </div>
  )
}
