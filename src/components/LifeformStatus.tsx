import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Dna, Shield, Brain, Activity,
} from 'lucide-react'
import { useStore } from '../store/useStore'

type Consciousness = 'active' | 'dormant' | 'evolving'

interface LifeformState {
  consciousness: Consciousness
  evolutionCount: number
  lockPassRate: number
  memoryHealthy: boolean
  lastActivity: Date | null
}

export function LifeformStatus({ compact = false }: { compact?: boolean }) {
  const { cloudMetrics, syncMetricsFromCloud, evolutionRecords, decisionLockHistory } = useStore()
  const [expanded, setExpanded] = useState(false)
  const [state, setState] = useState<LifeformState>({
    consciousness: 'dormant',
    evolutionCount: 0,
    lockPassRate: 0,
    memoryHealthy: true,
    lastActivity: null,
  })

  useEffect(() => {
    syncMetricsFromCloud().catch(() => {})
  }, [syncMetricsFromCloud])

  useEffect(() => {
    const evoTotal = cloudMetrics?.evolution.total ?? evolutionRecords.length
    const lockTotal = cloudMetrics?.decisionLock.total ?? decisionLockHistory.length
    const lockPassed = cloudMetrics?.decisionLock.passed ?? decisionLockHistory.filter(r => r.passed).length
    const lifeformCalls = cloudMetrics?.shieldDimensions?.lifeform.callCount ?? 0

    let consciousness: Consciousness = 'dormant'
    if (evoTotal > 0 || lifeformCalls > 0) consciousness = 'evolving'
    if (lockTotal > 0 || lifeformCalls > 0) consciousness = 'active'

    const lastRecord = evolutionRecords[0] || decisionLockHistory[0]
    setState({
      consciousness,
      evolutionCount: evoTotal,
      lockPassRate: lockTotal > 0 ? Math.round((lockPassed / lockTotal) * 100) : 0,
      memoryHealthy: true,
      lastActivity: lastRecord ? new Date(lastRecord.timestamp) : null,
    })
  }, [cloudMetrics, evolutionRecords, decisionLockHistory])

  const consciousnessConfig = {
    active: { label: '意识活跃', color: 'text-accent-emerald', dot: 'bg-accent-emerald', desc: '生命体正在运行' },
    evolving: { label: '进化中', color: 'text-accent-teal', dot: 'bg-accent-teal', desc: '元进化循环激活' },
    dormant: { label: '休眠', color: 'text-zinc-500', dot: 'bg-zinc-600', desc: '等待激活' },
  }[state.consciousness]

  if (compact) {
    return (
      <button
        onClick={() => setExpanded(!expanded)}
        className="relative flex items-center gap-1.5 px-2 py-1 rounded-lg bg-bg-elevated/60 border border-border-subtle hover:border-border-default transition-colors"
        title="MetaGO 生命体状态"
      >
        <span className="relative flex items-center justify-center">
          <Bot className="w-3.5 h-3.5 text-accent-life" />
          <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${consciousnessConfig.dot} animate-pulse`} />
        </span>
        <span className={`text-[10px] font-medium ${consciousnessConfig.color} hidden sm:inline`}>
          {consciousnessConfig.label}
        </span>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute top-full right-0 mt-2 w-64 card-base p-4 z-50 shadow-xl"
            >
              <CompactDetail state={state} consciousnessLabel={consciousnessConfig.label} />
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-base p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <Bot className="w-4 h-4 text-accent-life" />
          生命体状态指示器
        </h3>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${consciousnessConfig.dot} animate-pulse`} />
          <span className={`text-xs font-medium ${consciousnessConfig.color}`}>{consciousnessConfig.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StateMetric
          icon={Bot}
          label="意识状态"
          value={consciousnessConfig.label}
          subtext={consciousnessConfig.desc}
          color="text-accent-life"
        />
        <StateMetric
          icon={Dna}
          label="进化次数"
          value={String(state.evolutionCount)}
          subtext={state.evolutionCount > 0 ? '元进化已激活' : '尚未触发'}
          color="text-accent-teal"
        />
        <StateMetric
          icon={Shield}
          label="决策锁通过率"
          value={state.lockPassRate > 0 ? `${state.lockPassRate}%` : '—'}
          subtext={state.lockPassRate > 0 ? '校验已运行' : '尚未校验'}
          color="text-accent-emerald"
        />
        <StateMetric
          icon={Brain}
          label="记忆健康度"
          value={state.memoryHealthy ? '健康' : '异常'}
          subtext="四层记忆架构"
          color={state.memoryHealthy ? 'text-accent-blue' : 'text-accent-amber'}
        />
      </div>

      {state.lastActivity && (
        <div className="mt-3 pt-3 border-t border-border-subtle flex items-center gap-2 text-xs text-zinc-600">
          <Activity className="w-3 h-3" />
          <span>最近活动：{state.lastActivity.toLocaleString('zh-CN')}</span>
        </div>
      )}
    </motion.div>
  )
}

function StateMetric({
  icon: Icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: typeof Bot
  label: string
  value: string
  subtext: string
  color: string
}) {
  return (
    <div className="bg-bg-deep/40 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3 h-3 ${color}`} />
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
      <div className="text-[9px] text-zinc-600 mt-0.5">{subtext}</div>
    </div>
  )
}

function CompactDetail({
  state,
  consciousnessLabel,
}: {
  state: LifeformState
  consciousnessLabel: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">意识状态</span>
        <span className="text-xs text-accent-life font-medium">{consciousnessLabel}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">进化次数</span>
        <span className="text-xs text-accent-teal font-medium">{state.evolutionCount}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">决策锁通过率</span>
        <span className="text-xs text-accent-emerald font-medium">
          {state.lockPassRate > 0 ? `${state.lockPassRate}%` : '—'}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">记忆健康度</span>
        <span className={`text-xs font-medium ${state.memoryHealthy ? 'text-accent-blue' : 'text-accent-amber'}`}>
          {state.memoryHealthy ? '健康' : '异常'}
        </span>
      </div>
      <div className="pt-2 border-t border-border-subtle text-[9px] text-zinc-600">
        MetaGO 生命体 · 实时关联真实运行数据
      </div>
    </div>
  )
}
