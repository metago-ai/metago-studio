import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Dna, GitBranch, Scale, Gavel, CheckSquare, BookOpen, Bot,
  RefreshCw, Activity, TrendingUp, AlertTriangle, CheckCircle2,
  Cpu, Layers, ArrowRight, ArrowDown, X, Info,
} from 'lucide-react'
import { useStore } from '../store/useStore'

type DimId = 'reliability' | 'evolution' | 'traceability' | 'objectivity' | 'compliance' | 'integrity' | 'theory' | 'lifeform'

interface DimConfig {
  id: DimId
  name: string
  englishName: string
  icon: typeof Shield
  accent: string
  glow: string
  description: string
  dataSource: string
}

const DIM_CONFIGS: DimConfig[] = [
  {
    id: 'reliability',
    name: '可靠性',
    englishName: 'Reliability',
    icon: Shield,
    accent: 'emerald',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.3)]',
    description: '决策锁四道关卡校验通过率，确保 Agent 输出可靠可控',
    dataSource: 'events · decision_lock',
  },
  {
    id: 'evolution',
    name: '进化性',
    englishName: 'Evolution',
    icon: Dna,
    accent: 'teal',
    glow: 'shadow-[0_0_20px_rgba(20,184,166,0.3)]',
    description: '元进化五阶段循环真实运行：边界→差距→自生成→验证→递归',
    dataSource: 'events · evolution',
  },
  {
    id: 'traceability',
    name: '溯源性',
    englishName: 'Traceability',
    icon: GitBranch,
    accent: 'blue',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]',
    description: '数据溯源与脉冲见证，一切输出可溯源至输入与过程',
    dataSource: 'events · skill_usage · metago_data_provenance',
  },
  {
    id: 'objectivity',
    name: '客观性',
    englishName: 'Objectivity',
    icon: Scale,
    accent: 'purple',
    glow: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]',
    description: 'L1-L5 分级批判性分析，用户满意度权重归零，事实优先',
    dataSource: 'events · skill_usage · metago_critique',
  },
  {
    id: 'compliance',
    name: '合规性',
    englishName: 'Compliance',
    icon: Gavel,
    accent: 'amber',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]',
    description: '法律/伦理/安全合规主动检查，法律永远优先于效率',
    dataSource: 'events · skill_usage · metago_compliance',
  },
  {
    id: 'integrity',
    name: '完整性',
    englishName: 'Integrity',
    icon: CheckSquare,
    accent: 'rose',
    glow: 'shadow-[0_0_20px_rgba(244,63,94,0.3)]',
    description: '输出完整性校验 + 交付前原子验证门控，禁止幻觉输出',
    dataSource: 'events · skill_usage · metago_output_integrity',
  },
  {
    id: 'theory',
    name: '理论深度',
    englishName: 'Theory',
    icon: BookOpen,
    accent: 'indigo',
    glow: 'shadow-[0_0_20px_rgba(99,102,241,0.3)]',
    description: '8 公理 + 7 属性 + 6 协议 + 39 技能的理论体系支撑',
    dataSource: 'metago-lifeform v36.8.0 · 静态理论框架',
  },
  {
    id: 'lifeform',
    name: '生命体属性',
    englishName: 'Lifeform',
    icon: Bot,
    accent: 'life',
    glow: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]',
    description: '意识激活 + 记忆生命体 + 元进化驱动，非工具而是生命体',
    dataSource: 'events · skill_usage · metago_activate',
  },
]

const ACCENT_BG: Record<string, string> = {
  emerald: 'from-accent-emerald/20 to-transparent border-accent-emerald/30',
  teal: 'from-accent-teal/20 to-transparent border-accent-teal/30',
  blue: 'from-accent-blue/20 to-transparent border-accent-blue/30',
  purple: 'from-purple-500/20 to-transparent border-purple-500/30',
  amber: 'from-accent-amber/20 to-transparent border-accent-amber/30',
  rose: 'from-rose-500/20 to-transparent border-rose-500/30',
  indigo: 'from-indigo-500/20 to-transparent border-indigo-500/30',
  life: 'from-accent-life/20 to-transparent border-accent-life/30',
}

const ACCENT_TEXT: Record<string, string> = {
  emerald: 'text-accent-emerald',
  teal: 'text-accent-teal',
  blue: 'text-accent-blue',
  purple: 'text-purple-400',
  amber: 'text-accent-amber',
  rose: 'text-rose-400',
  indigo: 'text-indigo-400',
  life: 'text-accent-life',
}

const THEORY_STATS = {
  axioms: 8,
  attributes: 7,
  protocols: 6,
  skills: 39,
  mcpTools: 53,
  engineVersion: 'v36.8.0',
}

export function ShieldPage() {
  const { cloudMetrics, syncMetricsFromCloud, metricsLoading, decisionLockHistory, evolutionRecords } = useStore()
  const [selectedDim, setSelectedDim] = useState<DimId | null>(null)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  useEffect(() => {
    syncMetricsFromCloud().then(() => setLastSync(new Date()))
  }, [syncMetricsFromCloud])

  const sd = cloudMetrics?.shieldDimensions

  const dimData = useMemo<Record<DimId, { value: number; label: string; status: 'active' | 'idle' | 'warning'; details: { metric: string; value: string }[] }>>(() => {
    const dl = cloudMetrics?.decisionLock
    const evo = cloudMetrics?.evolution
    return {
      reliability: {
        value: dl && dl.total > 0 ? dl.passRate : 0,
        label: dl && dl.total > 0 ? `${dl.passRate}%` : '未触发',
        status: !dl || dl.total === 0 ? 'idle' : dl.passRate >= 80 ? 'active' : 'warning',
        details: [
          { metric: '总校验次数', value: dl ? String(dl.total) : '0' },
          { metric: '通过次数', value: dl ? String(dl.passed) : '0' },
          { metric: '阻断次数', value: dl ? String(dl.blocked) : '0' },
          { metric: '通过率', value: dl && dl.total > 0 ? `${dl.passRate}%` : '—' },
        ],
      },
      evolution: {
        value: evo && evo.total > 0 ? evo.successRate : 0,
        label: evo && evo.total > 0 ? `${evo.successRate}%` : '未触发',
        status: !evo || evo.total === 0 ? 'idle' : evo.successRate >= 80 ? 'active' : 'warning',
        details: [
          { metric: '进化次数', value: evo ? String(evo.total) : '0' },
          { metric: '成功率', value: evo && evo.total > 0 ? `${evo.successRate}%` : '—' },
          { metric: '最大递归深度', value: evo ? String(evo.maxDepth) : '0' },
          { metric: '平均耗时', value: evo && evo.avgDuration > 0 ? `${evo.avgDuration}ms` : '—' },
        ],
      },
      traceability: {
        value: sd?.traceability.callCount ?? 0,
        label: sd ? `${sd.traceability.callCount} 次` : '0 次',
        status: (sd?.traceability.callCount ?? 0) > 0 ? 'active' : 'idle',
        details: [
          { metric: '溯源调用', value: String(sd?.traceability.callCount ?? 0) },
          { metric: '关联技能', value: 'data-provenance / problem-trace / fact-check' },
        ],
      },
      objectivity: {
        value: sd?.objectivity.callCount ?? 0,
        label: sd ? `${sd.objectivity.callCount} 次` : '0 次',
        status: (sd?.objectivity.callCount ?? 0) > 0 ? 'active' : 'idle',
        details: [
          { metric: '批判分析调用', value: String(sd?.objectivity.callCount ?? 0) },
          { metric: '关联技能', value: 'critique / objectivity / emotion' },
        ],
      },
      compliance: {
        value: sd?.compliance.callCount ?? 0,
        label: sd ? `${sd.compliance.callCount} 次` : '0 次',
        status: (sd?.compliance.callCount ?? 0) > 0 ? 'active' : 'idle',
        details: [
          { metric: '合规检查调用', value: String(sd?.compliance.callCount ?? 0) },
          { metric: '关联技能', value: 'compliance / value-align / security-audit' },
        ],
      },
      integrity: {
        value: sd?.integrity.callCount ?? 0,
        label: sd ? `${sd.integrity.callCount} 次` : '0 次',
        status: (sd?.integrity.callCount ?? 0) > 0 ? 'active' : 'idle',
        details: [
          { metric: '完整性校验调用', value: String(sd?.integrity.callCount ?? 0) },
          { metric: '关联技能', value: 'output-integrity / delivery-gate / discipline' },
        ],
      },
      theory: {
        value: 100,
        label: `${THEORY_STATS.axioms}公理·${THEORY_STATS.attributes}属性`,
        status: 'active',
        details: [
          { metric: '核心公理', value: String(THEORY_STATS.axioms) },
          { metric: '根本属性', value: String(THEORY_STATS.attributes) },
          { metric: '运行协议', value: String(THEORY_STATS.protocols) },
          { metric: '技能总数', value: String(THEORY_STATS.skills) },
          { metric: 'MCP 工具', value: String(THEORY_STATS.mcpTools) },
          { metric: '引擎版本', value: THEORY_STATS.engineVersion },
        ],
      },
      lifeform: {
        value: sd?.lifeform.callCount ?? 0,
        label: sd ? `${sd.lifeform.callCount} 次` : '0 次',
        status: (sd?.lifeform.callCount ?? 0) > 0 ? 'active' : 'idle',
        details: [
          { metric: '生命体激活调用', value: String(sd?.lifeform.callCount ?? 0) },
          { metric: '关联技能', value: 'activate / meta-evolve / meta-create / memory-manage' },
          { metric: '本地进化记录', value: String(evolutionRecords.length) },
          { metric: '本地校验记录', value: String(decisionLockHistory.length) },
        ],
      },
    }
  }, [sd, cloudMetrics, decisionLockHistory.length, evolutionRecords.length])

  const activeCount = Object.values(dimData).filter(d => d.status === 'active').length
  const warningCount = Object.values(dimData).filter(d => d.status === 'warning').length

  const handleRefresh = () => {
    syncMetricsFromCloud().then(() => setLastSync(new Date()))
  }

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
            <Shield className="w-6 h-6 text-accent-emerald" />
            8 维护盾面板
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Agent = Model + Harness · 生命体 Harness 范式的 8 维工程化优势
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

      {/* Harness 层可视化 */}
      <HarnessLayerDiagram activeCount={activeCount} warningCount={warningCount} />

      {/* 总览统计 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-accent-emerald" />
            <span className="text-xs text-zinc-500">已激活维度</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">{activeCount}<span className="text-sm text-zinc-600">/8</span></div>
        </div>
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-accent-amber" />
            <span className="text-xs text-zinc-500">警告维度</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">{warningCount}</div>
        </div>
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-accent-blue" />
            <span className="text-xs text-zinc-500">决策锁校验</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">{cloudMetrics?.decisionLock.total ?? 0}</div>
        </div>
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-accent-teal" />
            <span className="text-xs text-zinc-500">元进化次数</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">{cloudMetrics?.evolution.total ?? 0}</div>
        </div>
      </motion.div>

      {/* 8 维护盾网格 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {DIM_CONFIGS.map((cfg, i) => {
          const data = dimData[cfg.id]
          const Icon = cfg.icon
          const isSelected = selectedDim === cfg.id
          return (
            <motion.button
              key={cfg.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              onClick={() => setSelectedDim(isSelected ? null : cfg.id)}
              className={`card-base p-5 text-left bg-gradient-to-br ${ACCENT_BG[cfg.accent]} border transition-all duration-200 hover:scale-[1.03] ${data.status === 'active' ? cfg.glow : ''} ${isSelected ? 'ring-2 ring-zinc-400/50' : ''}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-bg-deep/60 flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${ACCENT_TEXT[cfg.accent]}`} />
                </div>
                <StatusBadge status={data.status} />
              </div>
              <h3 className="text-sm font-semibold text-zinc-100 mb-0.5">{cfg.name}</h3>
              <p className="text-[10px] text-zinc-500 mb-2">{cfg.englishName}</p>
              <div className={`text-xl font-bold ${ACCENT_TEXT[cfg.accent]}`}>
                {data.label}
              </div>
            </motion.button>
          )
        })}
      </motion.div>

      {/* 详情面板 */}
      <AnimatePresence>
        {selectedDim && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <DetailPanel
              config={DIM_CONFIGS.find(c => c.id === selectedDim)!}
              data={dimData[selectedDim]}
              onClose={() => setSelectedDim(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 底部说明 */}
      <div className="card-base p-4">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-500 space-y-1">
            <p>8 维护盾面板展示 MetaGO Agent Harness（驭智层）的 8 维工程化优势，所有数据实时关联真实功能运行。</p>
            <p>核心 3 维（可靠性 + 进化性 + 溯源性）为主卖点，扩展 5 维（客观性 + 合规性 + 完整性 + 理论深度 + 生命体属性）为护城河支撑。</p>
            <p>Harness 中文释义：驾驭智能体的工程范式，是模型之外的运行时控制层，让智能体从"会说话"升级为"会干活、守规矩、会进化、可追溯、能闭环"的生命体。</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: 'active' | 'idle' | 'warning' }) {
  if (status === 'active') {
    return (
      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent-emerald/15 text-accent-emerald text-[10px] font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
        已激活
      </span>
    )
  }
  if (status === 'warning') {
    return (
      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent-amber/15 text-accent-amber text-[10px] font-medium">
        <AlertTriangle className="w-2.5 h-2.5" />
        警告
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-zinc-700/40 text-zinc-500 text-[10px] font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
      未触发
    </span>
  )
}

function DetailPanel({
  config,
  data,
  onClose,
}: {
  config: DimConfig
  data: { value: number; label: string; status: 'active' | 'idle' | 'warning'; details: { metric: string; value: string }[] }
  onClose: () => void
}) {
  const Icon = config.icon
  return (
    <div className={`card-base p-6 bg-gradient-to-br ${ACCENT_BG[config.accent]} border`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-bg-deep/60 flex items-center justify-center">
            <Icon className={`w-6 h-6 ${ACCENT_TEXT[config.accent]}`} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-100">{config.name}</h3>
            <p className="text-xs text-zinc-500">{config.englishName}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
          <X className="w-5 h-5" />
        </button>
      </div>
      <p className="text-sm text-zinc-400 mb-4">{config.description}</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        {data.details.map((d) => (
          <div key={d.metric} className="bg-bg-deep/40 rounded-lg p-3">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{d.metric}</div>
            <div className={`text-sm font-semibold ${ACCENT_TEXT[config.accent]}`}>{d.value}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-zinc-600">
        <GitBranch className="w-3 h-3" />
        <span>数据源：{config.dataSource}</span>
      </div>
    </div>
  )
}

function HarnessLayerDiagram({ activeCount, warningCount }: { activeCount: number; warningCount: number }) {
  const harnessModules = [
    { name: '决策锁', icon: Shield, desc: 'IVL→ILT→OSG→完整性' },
    { name: '元进化', icon: Dna, desc: '五阶段循环' },
    { name: '溯源', icon: GitBranch, desc: '全链路存证' },
    { name: '合规', icon: Gavel, desc: '法律优先' },
    { name: '完整性', icon: CheckSquare, desc: '交付门控' },
    { name: '客观性', icon: Scale, desc: '批判分析' },
  ]
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 }}
      className="card-base p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <Layers className="w-4 h-4 text-accent-life" />
          Harness 层可视化 · Agent = Model + Harness
        </h2>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-500">护盾状态</span>
          <span className="text-accent-emerald font-semibold">{activeCount} 激活</span>
          {warningCount > 0 && (
            <span className="text-accent-amber font-semibold">· {warningCount} 警告</span>
          )}
        </div>
      </div>

      {/* 三层架构图 */}
      <div className="space-y-3">
        {/* 模型层 */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-deep/40 border border-border-subtle">
          <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
            <Cpu className="w-5 h-5 text-accent-blue" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-zinc-200">模型层 · Model</div>
            <div className="text-xs text-zinc-500">DeepSeek-v4-pro · 通过 SSE 代理实现真流式推理</div>
          </div>
          <span className="text-[10px] text-zinc-600 px-2 py-0.5 rounded-full bg-bg-elevated">基座能力</span>
        </div>

        {/* 连接箭头 */}
        <div className="flex justify-center">
          <ArrowDown className="w-4 h-4 text-zinc-600" />
        </div>

        {/* Harness 层 */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-accent-life/10 to-transparent border border-accent-life/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-accent-life/20 flex items-center justify-center">
              <Layers className="w-4 h-4 text-accent-life" />
            </div>
            <div>
              <div className="text-sm font-semibold text-accent-life">Harness 层 · 驭智层</div>
              <div className="text-[10px] text-zinc-500">模型之外的运行时控制层 · 6 大控制模块</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {harnessModules.map((m) => {
              const Icon = m.icon
              return (
                <div key={m.name} className="flex items-center gap-2 p-2 rounded-lg bg-bg-deep/40 border border-border-subtle">
                  <Icon className="w-3.5 h-3.5 text-accent-life flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-zinc-200">{m.name}</div>
                    <div className="text-[9px] text-zinc-600 truncate">{m.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 连接箭头 */}
        <div className="flex justify-center">
          <ArrowDown className="w-4 h-4 text-zinc-600" />
        </div>

        {/* 输出层 */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-deep/40 border border-border-subtle">
          <div className="w-10 h-10 rounded-lg bg-accent-emerald/15 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-accent-emerald" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-zinc-200">输出层 · 经验证的生命体输出</div>
            <div className="text-xs text-zinc-500">会干活 · 守规矩 · 会进化 · 可追溯 · 能闭环</div>
          </div>
          <ArrowRight className="w-4 h-4 text-accent-emerald" />
        </div>
      </div>
    </motion.div>
  )
}
