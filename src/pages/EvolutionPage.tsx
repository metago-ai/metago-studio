import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Area, AreaChart,
} from 'recharts'
import {
  Dna, Download, TrendingUp, Clock, CheckCircle2, ArrowDownRight, ArrowUpRight,
  RefreshCw, GitBranch, Trash2, X,
  Compass, Search, Sparkle, ShieldCheck, Repeat, ArrowRight,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { exportAndDownloadJSON, exportAndDownloadMarkdown } from '../lib/evolutionArchive'
import { ShareButton } from '../components/ShareButton'

const TIME_RANGES = [
  { id: '7d', label: '7 天' },
  { id: '30d', label: '30 天' },
  { id: '90d', label: '90 天' },
  { id: '365d', label: '365 天' },
] as const

const QUICK_TRIGGERS = [
  'TypeScript 5.0 satisfies 操作符',
  'Rust async/await 模式',
  'GDPR 数据保护合规',
  'WASM 性能优化',
  'K8s 部署配置',
  'GraphQL Schema 设计',
  'PostgreSQL 索引优化',
  'OAuth 2.0 流程',
]

export function EvolutionPage() {
  const { evolutionRecords, evolutionStats, removeEvolutionRecord, features, cloudMetrics, syncMetricsFromCloud, triggerRealEvolution } = useStore()

  // 拉取真实云端进化数据
  useEffect(() => {
    syncMetricsFromCloud()
  }, [syncMetricsFromCloud])

  // 真实数据优先：cloudMetrics 有进化数据时使用
  const cm = cloudMetrics?.evolution
  const realTotal = cm && cm.total > 0 ? cm.total : evolutionStats.totalEvolutions
  const realSuccessRate = cm && cm.total > 0 ? cm.successRate : evolutionStats.successRate
  const realAvgDuration = cm && cm.total > 0 ? cm.avgDuration : evolutionStats.averageDurationMs
  const realMaxDepth = cm && cm.total > 0 ? cm.maxDepth : (evolutionRecords.length > 0 ? Math.max(...evolutionRecords.map(r => r.depth)) : 0)

  // 五阶段循环统计：从真实进化记录中计算各阶段数据
  const stageStats = {
    boundary: evolutionRecords.filter(r => r.boundary).length,
    gap: evolutionRecords.filter(r => r.gap).length,
    generate: evolutionRecords.filter(r => r.generated).length,
    verify: evolutionRecords.filter(r => r.verified).length,
    recurse: evolutionRecords.filter(r => r.recursed).length,
  }
  const [timeRange, setTimeRange] = useState<typeof TIME_RANGES[number]['id']>('7d')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTrigger, setNewTrigger] = useState('')
  const [newBoundary, setNewBoundary] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [addSuccess, setAddSuccess] = useState(false)
  const [isEvolving, setIsEvolving] = useState(false)

  const chartData = evolutionStats.dailyCounts.map((d) => ({
    date: d.date.slice(5), // MM-DD
    进化次数: d.count,
  }))

  const handleAddRecord = async () => {
    if (!newTrigger.trim() || !newBoundary.trim()) return
    setAddError(null)
    setAddSuccess(false)
    setIsEvolving(true)
    try {
      const result = await triggerRealEvolution(newTrigger.trim(), newBoundary.trim())
      if (result.success) {
        setAddSuccess(true)
        setNewTrigger('')
        setNewBoundary('')
        setTimeout(() => {
          setShowAddModal(false)
          setAddSuccess(false)
        }, 1200)
      } else {
        setAddError(result.message)
      }
    } catch (e) {
      console.error('[EvolutionPage] 元进化触发失败', e)
      setAddError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsEvolving(false)
    }
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
            <Dna className="w-6 h-6 text-accent-teal" />
            进化档案
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            五阶段循环：边界感知 → 差距分析 → 自生成 → 验证 → 递归
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportAndDownloadJSON(evolutionRecords)}
            disabled={evolutionRecords.length === 0}
            className="btn-secondary text-xs disabled:opacity-40"
          >
            <Download className="w-3 h-3" />
            导出 JSON
          </button>
          <button
            onClick={() => exportAndDownloadMarkdown(evolutionRecords)}
            disabled={evolutionRecords.length === 0}
            className="btn-secondary text-xs disabled:opacity-40"
          >
            <Download className="w-3 h-3" />
            导出 Markdown
          </button>
          {evolutionRecords.length > 0 && (
            <ShareButton
              data={{
                title: `MetaGO 进化档案 · 共 ${evolutionStats.totalEvolutions} 次进化 · 成功率 ${evolutionStats.successRate.toFixed(1)}%`,
                content: evolutionRecords.slice(0, 5).map(r =>
                  `【${r.trigger}】边界：${r.boundary}；差距：${r.gap}；自生成：${r.generated}；${r.verified ? '✅验证通过' : '❌验证失败'}；耗时${r.durationMs}ms${r.recursed ? `；递归${r.depth}层` : ''}`
                ).join('\n\n'),
                type: 'evolution',
              }}
            />
          )}
          {features.evolutionArchive && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary text-xs"
            >
              <Dna className="w-3.5 h-3.5" />
              触发元进化
            </button>
          )}
        </div>
      </motion.div>

      {/* 统计卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-2">
            <Dna className="w-4 h-4 text-accent-teal" />
            <span className="text-xs text-zinc-500">总进化次数</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">{realTotal}</div>
        </div>
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-accent-emerald" />
            <span className="text-xs text-zinc-500">成功率</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">
            {realSuccessRate.toFixed(1)}%
          </div>
        </div>
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-accent-amber" />
            <span className="text-xs text-zinc-500">平均耗时</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">
            {realAvgDuration}ms
          </div>
        </div>
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-accent-blue" />
            <span className="text-xs text-zinc-500">最大递归深度</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">
            {realMaxDepth} 层
          </div>
        </div>
      </motion.div>

      {/* 五阶段循环流程图 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="card-base p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-accent-teal" />
            五阶段循环（元进化核心机制）
          </h3>
          <span className="text-xs text-zinc-500">
            边界感知 → 差距分析 → 自生成 → 验证 → 递归
          </span>
        </div>
        {/* 横向流程图（md+） */}
        <div className="hidden md:flex items-start justify-between gap-1 overflow-x-auto pb-2">
          {[
            { id: 'boundary', name: '边界感知', fullName: 'Boundary Sensing', icon: Compass, color: 'text-accent-blue', bg: 'bg-accent-blue/10', border: 'border-accent-blue/30', count: stageStats.boundary, desc: '识别能力边界' },
            { id: 'gap', name: '差距分析', fullName: 'Gap Analysis', icon: Search, color: 'text-accent-amber', bg: 'bg-accent-amber/10', border: 'border-accent-amber/30', count: stageStats.gap, desc: '量化差距' },
            { id: 'generate', name: '自生成', fullName: 'Self-Generation', icon: Sparkle, color: 'text-accent-teal', bg: 'bg-accent-teal/10', border: 'border-accent-teal/30', count: stageStats.generate, desc: '生成新能力' },
            { id: 'verify', name: '验证', fullName: 'Verification', icon: ShieldCheck, color: 'text-accent-emerald', bg: 'bg-accent-emerald/10', border: 'border-accent-emerald/30', count: stageStats.verify, desc: '验证新能力' },
            { id: 'recurse', name: '递归', fullName: 'Recursion', icon: Repeat, color: 'text-accent-rose', bg: 'bg-accent-rose/10', border: 'border-accent-rose/30', count: stageStats.recurse, desc: '进入下一轮进化' },
          ].map((stage, idx, arr) => {
            const Icon = stage.icon
            return (
              <div key={stage.id} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center gap-2 min-w-[120px] flex-shrink-0">
                  <div className={`relative w-14 h-14 rounded-full flex items-center justify-center border-2 ${stage.border} ${stage.bg}`}>
                    <Icon className={`w-7 h-7 ${stage.color}`} />
                    {stage.id === 'recurse' && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent-rose/20 flex items-center justify-center">
                        <ArrowRight className="w-3 h-3 text-accent-rose rotate-[-45deg]" />
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold text-zinc-200">{stage.name}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{stage.fullName}</div>
                    <div className="text-[10px] text-zinc-500 mt-1">{stage.desc}</div>
                    <div className="text-xs font-bold text-zinc-300 mt-1">
                      {stage.count} 次
                    </div>
                  </div>
                </div>
                {idx < arr.length - 1 && (
                  <div className="flex-1 flex items-center justify-center pt-7">
                    <div className="h-0.5 w-full bg-gradient-to-r from-accent-teal/30 to-accent-teal/30" />
                    <ArrowRight className="w-4 h-4 -ml-1 text-accent-teal/50" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {/* 循环回环提示 */}
        <div className="hidden md:flex items-center justify-center mt-3 pt-3 border-t border-border-subtle">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Repeat className="w-3 h-3 text-accent-rose/60" />
            <span>递归阶段会触发新一轮边界感知，形成持续进化的闭环</span>
          </div>
        </div>
        {/* 纵向流程图（移动端） */}
        <div className="md:hidden space-y-3">
          {[
            { id: 'boundary', name: '边界感知', icon: Compass, color: 'text-accent-blue', bg: 'bg-accent-blue/10', border: 'border-accent-blue/30', count: stageStats.boundary, desc: '识别能力边界' },
            { id: 'gap', name: '差距分析', icon: Search, color: 'text-accent-amber', bg: 'bg-accent-amber/10', border: 'border-accent-amber/30', count: stageStats.gap, desc: '量化差距' },
            { id: 'generate', name: '自生成', icon: Sparkle, color: 'text-accent-teal', bg: 'bg-accent-teal/10', border: 'border-accent-teal/30', count: stageStats.generate, desc: '生成新能力' },
            { id: 'verify', name: '验证', icon: ShieldCheck, color: 'text-accent-emerald', bg: 'bg-accent-emerald/10', border: 'border-accent-emerald/30', count: stageStats.verify, desc: '验证新能力' },
            { id: 'recurse', name: '递归', icon: Repeat, color: 'text-accent-rose', bg: 'bg-accent-rose/10', border: 'border-accent-rose/30', count: stageStats.recurse, desc: '进入下一轮进化' },
          ].map((stage, idx, arr) => {
            const Icon = stage.icon
            return (
              <div key={stage.id}>
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${stage.border} ${stage.bg}`}>
                      <Icon className={`w-5 h-5 ${stage.color}`} />
                    </div>
                    {idx < arr.length - 1 && <div className="w-0.5 h-6 bg-accent-teal/30" />}
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-zinc-200">{stage.name}</span>
                      <span className="text-xs text-zinc-500">{stage.count} 次</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">{stage.desc}</p>
                  </div>
                </div>
                {idx === arr.length - 1 && (
                  <div className="flex items-center gap-2 text-xs text-zinc-500 mt-2 pl-13">
                    <Repeat className="w-3 h-3 text-accent-rose/60" />
                    <span>递归触发新一轮循环</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* 进化曲线 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-base p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent-teal" />
            进化曲线（近 {TIME_RANGES.find(r => r.id === timeRange)?.label}）
          </h3>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-elevated/50">
            {TIME_RANGES.map((range) => (
              <button
                key={range.id}
                onClick={() => setTimeRange(range.id)}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  timeRange === range.id
                    ? 'bg-accent-emerald/20 text-accent-emerald'
                    : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorEvo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272f" vertical={false} />
            <XAxis dataKey="date" stroke="#52525b" fontSize={12} tickLine={false} />
            <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: '#1a1a24',
                border: '1px solid #3a3a45',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#e4e4e7' }}
            />
            <Area
              type="monotone"
              dataKey="进化次数"
              stroke="#14b8a6"
              strokeWidth={2}
              fill="url(#colorEvo)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* 能力雷达图 + 维度详情 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        <div className="card-base p-5">
          <h3 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-accent-emerald" />
            能力雷达图（10 维）
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={evolutionStats.dimensions}>
              <PolarGrid stroke="#27272f" />
              <PolarAngleAxis dataKey="dimension" stroke="#71717a" fontSize={11} />
              <PolarRadiusAxis stroke="#3a3a45" fontSize={10} angle={90} domain={[0, 100]} />
              <Radar
                name="能力"
                dataKey="score"
                stroke="#10d985"
                fill="#10d985"
                fillOpacity={0.3}
                strokeWidth={2}
              />
              <Tooltip
                contentStyle={{
                  background: '#1a1a24',
                  border: '1px solid #3a3a45',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="card-base p-5">
          <h3 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-accent-blue" />
            能力维度详情
          </h3>
          <div className="space-y-2">
            {evolutionStats.dimensions.map((dim, i) => (
              <motion.div
                key={dim.dimension}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.03 }}
                className="flex items-center gap-3"
              >
                <span className="text-xs text-zinc-400 w-12">{dim.dimension}</span>
                <div className="flex-1 h-2 bg-bg-elevated rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${dim.score}%` }}
                    transition={{ duration: 0.5, delay: 0.3 + i * 0.03 }}
                    className={`h-full rounded-full ${
                      dim.score >= 90
                        ? 'bg-gradient-to-r from-accent-emerald to-accent-teal'
                        : dim.score >= 80
                          ? 'bg-gradient-to-r from-accent-teal to-accent-blue'
                          : 'bg-gradient-to-r from-accent-amber to-accent-rose'
                    }`}
                  />
                </div>
                <span className="text-xs text-zinc-300 w-10 text-right font-mono">{dim.score}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* 进化记录列表 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card-base p-5"
      >
        <h3 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-accent-amber" />
          最近进化记录
        </h3>
        {evolutionRecords.length === 0 ? (
          <div className="text-center py-8">
            <Dna className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-400">暂无进化记录</p>
            <p className="text-xs text-zinc-500 mt-1">添加第一条记录开始构建你的进化档案</p>
          </div>
        ) : (
          <div className="space-y-3">
            {evolutionRecords.slice(0, 10).map((record, idx) => (
              <motion.div
                key={record.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + idx * 0.03 }}
                className="p-4 rounded-lg bg-bg-elevated/50 hover:bg-bg-hover transition-colors group"
              >
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-accent-teal">#{record.id.slice(-6)}</span>
                    <span className="text-sm font-medium text-zinc-100">{record.trigger}</span>
                    {record.recursed && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent-teal/10 text-accent-teal flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" />
                        递归 {record.depth} 层
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span>{new Date(record.timestamp).toLocaleString('zh-CN')}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {record.durationMs}ms
                    </span>
                    {features.evolutionArchive && (
                      <button
                        onClick={() => removeEvolutionRecord(record.id)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-accent-rose transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                  <div className="text-xs">
                    <span className="text-zinc-600">边界：</span>
                    <span className="text-zinc-300">{record.boundary}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-zinc-600">差距：</span>
                    <span className="text-zinc-300">{record.gap}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-zinc-600">自生成：</span>
                    <span className="text-accent-emerald">{record.generated}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border-subtle">
                  {record.verified ? (
                    <span className="text-xs text-accent-emerald flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      验证通过
                    </span>
                  ) : (
                    <span className="text-xs text-accent-rose flex items-center gap-1">
                      <ArrowDownRight className="w-3 h-3" />
                      验证失败
                    </span>
                  )}
                  {record.recursed && (
                    <span className="text-xs text-accent-teal flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3" />
                      触发递归
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* 触发真实元进化模态框 */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-bg-deep/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !isEvolving && setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-bg-card border border-border-default rounded-xl w-full max-w-md"
            >
              <div className="flex items-center justify-between p-4 border-b border-border-subtle">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <Dna className="w-4 h-4 text-accent-teal" />
                  触发真实元进化
                </h3>
                <button
                  onClick={() => !isEvolving && setShowAddModal(false)}
                  disabled={isEvolving}
                  className="text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">触发器（能力领域）</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {QUICK_TRIGGERS.map(t => (
                      <button
                        key={t}
                        onClick={() => !isEvolving && setNewTrigger(t)}
                        disabled={isEvolving}
                        className={`text-[10px] px-2 py-1 rounded disabled:opacity-40 ${newTrigger === t ? 'bg-accent-emerald/20 text-accent-emerald' : 'bg-bg-elevated text-zinc-400 hover:text-zinc-200'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={newTrigger}
                    onChange={e => setNewTrigger(e.target.value)}
                    placeholder="例如：Rust async/await"
                    disabled={isEvolving}
                    className="input-base text-sm disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">能力边界（遇到什么不会做）</label>
                  <textarea
                    value={newBoundary}
                    onChange={e => setNewBoundary(e.target.value)}
                    placeholder="例如：无法处理 Rust 的 async fn 语法"
                    rows={3}
                    disabled={isEvolving}
                    className="input-base text-sm disabled:opacity-40"
                  />
                </div>
                {isEvolving && (
                  <div className="text-xs p-3 rounded bg-accent-teal/10 text-accent-teal border border-accent-teal/30 flex items-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                      className="w-3.5 h-3.5 border-2 border-accent-teal/30 border-t-accent-teal rounded-full"
                    />
                    AI 正在执行五阶段循环：边界感知 → 差距分析 → 自生成 → 验证 → 递归...
                  </div>
                )}
                {addError && (
                  <div className="text-xs p-2 rounded bg-accent-rose/10 text-accent-rose border border-accent-rose/30">
                    进化失败：{addError}
                  </div>
                )}
                {addSuccess && (
                  <div className="text-xs p-2 rounded bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/30 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    元进化完成，新能力已生成并归档...
                  </div>
                )}
              </div>
              <div className="flex gap-2 p-4 border-t border-border-subtle">
                <button
                  onClick={() => { setShowAddModal(false); setAddError(null); setAddSuccess(false) }}
                  disabled={isEvolving}
                  className="btn-ghost flex-1 text-sm disabled:opacity-40"
                >
                  取消
                </button>
                <button
                  onClick={handleAddRecord}
                  disabled={!newTrigger.trim() || !newBoundary.trim() || addSuccess || isEvolving}
                  className="btn-primary flex-1 text-sm disabled:opacity-40"
                >
                  {isEvolving ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-4 h-4 border-2 border-bg-deep border-t-transparent rounded-full"
                      />
                      进化中...
                    </>
                  ) : (
                    <>
                      <Dna className="w-4 h-4" />
                      {addSuccess ? '已完成' : '触发真实元进化'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
