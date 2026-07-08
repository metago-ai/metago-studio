import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw, Activity, CheckCircle2, XCircle, Clock, ChevronRight,
  Search, Scale, ShieldCheck, ClipboardCheck, Brain, AlertTriangle,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import type { SkillDimensionStats } from '../lib/cloudFunctions'

type TabId = 'traceability' | 'objectivity' | 'compliance' | 'integrity'

const TABS: Array<{
  id: TabId
  label: string
  icon: typeof Search
  description: string
  skills: Array<{ id: string; name: string; desc: string }>
}> = [
  {
    id: 'traceability',
    label: '溯源链路',
    icon: Search,
    description: '数据溯源 · 问题追踪 · 事实核查',
    skills: [
      { id: 'metago_data_provenance', name: '数据溯源', desc: '全链路存证与脉冲见证' },
      { id: 'metago_problem_trace', name: '问题追踪', desc: '无限追问直至根因' },
      { id: 'metago_fact_check', name: '事实核查', desc: '事实准确性与夸大检测' },
    ],
  },
  {
    id: 'objectivity',
    label: '批判性分析',
    icon: Scale,
    description: 'L1-L5 分级批判 · 客观中立 · 情绪检测',
    skills: [
      { id: 'metago_critique', name: '批判性分析', desc: 'L1-L5 分级批判' },
      { id: 'metago_objectivity', name: '客观中立', desc: '客观中立度量化' },
      { id: 'metago_emotion', name: '情绪检测', desc: '情绪状态识别' },
    ],
  },
  {
    id: 'compliance',
    label: '合规检查',
    icon: ShieldCheck,
    description: '法律合规 · 价值对齐 · 安全审计',
    skills: [
      { id: 'metago_compliance', name: '合规检查', desc: '法律/伦理/安全合规' },
      { id: 'metago_value_align', name: '价值对齐', desc: '29维价值对齐评估' },
      { id: 'metago_security_audit', name: '安全审计', desc: 'OWASP Top 10 审计' },
    ],
  },
  {
    id: 'integrity',
    label: '交付门控',
    icon: ClipboardCheck,
    description: '输出完整性 · 交付门控 · 自律执行 · 自我检查',
    skills: [
      { id: 'metago_output_integrity', name: '输出完整性', desc: '占位符与幻觉检测' },
      { id: 'metago_delivery_gate', name: '交付门控', desc: '交付前原子验证门控' },
      { id: 'metago_discipline', name: '自律执行', desc: 'AI 自律五问自检' },
      { id: 'metago_self_check', name: '自我检查', desc: '输出前完整性自检' },
    ],
  },
]

const SKILL_NAME_MAP: Record<string, string> = {
  metago_data_provenance: '数据溯源',
  metago_problem_trace: '问题追踪',
  metago_fact_check: '事实核查',
  metago_critique: '批判性分析',
  metago_objectivity: '客观中立',
  metago_emotion: '情绪检测',
  metago_compliance: '合规检查',
  metago_value_align: '价值对齐',
  metago_security_audit: '安全审计',
  metago_output_integrity: '输出完整性',
  metago_delivery_gate: '交付门控',
  metago_discipline: '自律执行',
  metago_self_check: '自我检查',
}

function formatTime(ts: string | null | undefined): string {
  if (!ts) return '—'
  try {
    const d = new Date(ts)
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return '—'
  }
}

function DimensionOverview({ stats }: { stats: SkillDimensionStats | undefined }) {
  const callCount = stats?.callCount ?? 0
  const successCount = stats?.successCount ?? 0
  const successRate = stats?.successRate ?? 0

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="card-base p-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-accent-emerald" />
          <span className="text-xs text-zinc-500">总调用次数</span>
        </div>
        <div className="text-2xl font-bold text-zinc-100">{callCount}</div>
      </div>
      <div className="card-base p-4">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-xs text-zinc-500">成功次数</span>
        </div>
        <div className="text-2xl font-bold text-zinc-100">{successCount}</div>
      </div>
      <div className="card-base p-4">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="w-4 h-4 text-blue-400" />
          <span className="text-xs text-zinc-500">成功率</span>
        </div>
        <div className="text-2xl font-bold text-zinc-100">
          {callCount > 0 ? `${successRate}%` : '—'}
        </div>
      </div>
    </div>
  )
}

function SkillDistribution({ stats, skills }: { stats: SkillDimensionStats | undefined; skills: Array<{ id: string; name: string; desc: string }> }) {
  const skillStats = stats?.skills || {}

  return (
    <div className="card-base p-5">
      <h3 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
        <Scale className="w-4 h-4 text-accent-emerald" />
        技能分布
      </h3>
      <div className="space-y-3">
        {skills.map(skill => {
          const s = skillStats[skill.id]
          const count = s?.count ?? 0
          const successCount = s?.successCount ?? 0
          const lastCalled = s?.lastCalled
          const isActive = count > 0

          return (
            <div
              key={skill.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                isActive
                  ? 'border-border-default bg-bg-elevated'
                  : 'border-border-subtle bg-transparent opacity-60'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-accent-emerald' : 'bg-zinc-600'}`} />
                  <span className="text-sm font-medium text-zinc-200">{skill.name}</span>
                  {isActive && (
                    <span className="text-xs text-zinc-500 font-mono">{skill.id}</span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-1 ml-4">{skill.desc}</p>
              </div>
              <div className="flex items-center gap-6 text-right">
                <div>
                  <div className="text-xs text-zinc-600">调用</div>
                  <div className={`text-sm font-semibold ${isActive ? 'text-zinc-100' : 'text-zinc-600'}`}>{count}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-600">成功</div>
                  <div className={`text-sm font-semibold ${isActive ? 'text-green-400' : 'text-zinc-600'}`}>{successCount}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-600">最后调用</div>
                  <div className="text-xs text-zinc-400">{formatTime(lastCalled)}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RecentCallsTimeline({ stats }: { stats: SkillDimensionStats | undefined }) {
  const calls = stats?.recentCalls || []

  return (
    <div className="card-base p-5">
      <h3 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
        <Clock className="w-4 h-4 text-accent-emerald" />
        最近调用记录
        <span className="text-xs text-zinc-500 font-normal">(最多 5 条)</span>
      </h3>
      {calls.length === 0 ? (
        <div className="flex items-center gap-2 py-8 text-sm text-zinc-600 justify-center">
          <AlertTriangle className="w-4 h-4" />
          暂无调用记录
        </div>
      ) : (
        <div className="space-y-2">
          {calls.map((call, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-3 rounded-lg bg-bg-elevated border border-border-subtle"
            >
              {call.success ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-200 font-medium">
                    {SKILL_NAME_MAP[call.skillId] || call.skillId}
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">{call.skillId}</span>
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {formatTime(call.timestamp)}
                  {call.duration > 0 && ` · 耗时 ${call.duration}ms`}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function DepthAnalysisPage() {
  const [activeTab, setActiveTab] = useState<TabId>('traceability')
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const { cloudMetrics, syncMetricsFromCloud, metricsLoading } = useStore()

  useEffect(() => {
    syncMetricsFromCloud().then(() => setLastSync(new Date()))
  }, [syncMetricsFromCloud])

  const handleRefresh = () => {
    syncMetricsFromCloud().then(() => setLastSync(new Date()))
  }

  const sd = cloudMetrics?.shieldDimensions

  const tabStats: Record<TabId, SkillDimensionStats | undefined> = useMemo(() => ({
    traceability: sd?.traceability,
    objectivity: sd?.objectivity,
    compliance: sd?.compliance,
    integrity: sd?.integrity,
  }), [sd])

  const activeTabConfig = TABS.find(t => t.id === activeTab)!
  const activeStats = tabStats[activeTab]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 头部 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Brain className="w-6 h-6 text-accent-emerald" />
            深度分析
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            8维护盾维度详细数据 · 技能分布 · 调用链路追溯
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastSync && (
            <span className="text-xs text-zinc-600">
              最后同步：{lastSync.toLocaleTimeString('zh-CN')}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={metricsLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-elevated border border-border-subtle text-xs text-zinc-300 hover:text-zinc-100 hover:border-border-default transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${metricsLoading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </motion.div>

      {/* Tab 导航 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex items-center gap-1 p-1 rounded-xl bg-bg-elevated border border-border-subtle overflow-x-auto"
      >
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const stats = tabStats[tab.id]
          const count = stats?.callCount ?? 0
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-bg-hover border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  isActive ? 'bg-accent-emerald/25 text-accent-emerald' : 'bg-zinc-700/50 text-zinc-400'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </motion.div>

      {/* Tab 描述 */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 text-sm text-zinc-400"
      >
        <activeTabConfig.icon className="w-4 h-4 text-accent-emerald" />
        <span>{activeTabConfig.description}</span>
      </motion.div>

      {/* 维度总览 */}
      <motion.div
        key={`${activeTab}-overview`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <DimensionOverview stats={activeStats} />
      </motion.div>

      {/* 技能分布 + 最近调用 */}
      <motion.div
        key={`${activeTab}-detail`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        <SkillDistribution stats={activeStats} skills={activeTabConfig.skills} />
        <RecentCallsTimeline stats={activeStats} />
      </motion.div>

      {/* 数据来源说明 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-xs text-zinc-600 text-center py-4"
      >
        数据来源：events 云函数 getMetrics · adminToken 模式聚合所有用户 · shieldDimensions 详细数据结构
      </motion.div>
    </div>
  )
}
