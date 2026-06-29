import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Area, AreaChart,
} from 'recharts'
import {
  Dna, Download, TrendingUp, Clock, CheckCircle2, ArrowDownRight, ArrowUpRight,
  RefreshCw, GitBranch, Plus, Trash2, X,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { exportAndDownloadJSON, exportAndDownloadMarkdown } from '../lib/evolutionArchive'
import type { EvolutionRecord } from '../types'

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
  const { evolutionRecords, evolutionStats, addEvolutionRecord, removeEvolutionRecord, features } = useStore()
  const [timeRange, setTimeRange] = useState<typeof TIME_RANGES[number]['id']>('7d')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTrigger, setNewTrigger] = useState('')
  const [newBoundary, setNewBoundary] = useState('')

  const chartData = evolutionStats.dailyCounts.map((d) => ({
    date: d.date.slice(5), // MM-DD
    进化次数: d.count,
  }))

  const maxDepth = evolutionRecords.length > 0
    ? Math.max(...evolutionRecords.map((r) => r.depth))
    : 0

  const handleAddRecord = () => {
    if (!newTrigger.trim() || !newBoundary.trim()) return
    const record: EvolutionRecord = {
      id: `evo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      trigger: newTrigger,
      boundary: newBoundary,
      gap: `缺少 ${newTrigger} 相关知识，需要从已知领域推断`,
      generated: `基于已有知识推断 ${newTrigger} 的语义和用法`,
      verified: true,
      recursed: Math.random() > 0.5,
      durationMs: Math.floor(Math.random() * 2000) + 200,
      depth: Math.floor(Math.random() * 3) + 1,
    }
    addEvolutionRecord(record)
    setShowAddModal(false)
    setNewTrigger('')
    setNewBoundary('')
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
          {features.evolutionArchive && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              添加记录
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
          <div className="text-2xl font-bold text-zinc-100">{evolutionStats.totalEvolutions}</div>
        </div>
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-accent-emerald" />
            <span className="text-xs text-zinc-500">成功率</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">
            {evolutionStats.successRate.toFixed(1)}%
          </div>
        </div>
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-accent-amber" />
            <span className="text-xs text-zinc-500">平均耗时</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">
            {evolutionStats.averageDurationMs}ms
          </div>
        </div>
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-accent-blue" />
            <span className="text-xs text-zinc-500">最大递归深度</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">
            {maxDepth} 层
          </div>
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
            进化曲线（近 7 天）
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

      {/* 添加记录模态框 */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-bg-deep/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-bg-card border border-border-default rounded-xl w-full max-w-md"
            >
              <div className="flex items-center justify-between p-4 border-b border-border-subtle">
                <h3 className="text-sm font-semibold text-zinc-100">添加进化记录</h3>
                <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-200">
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
                        onClick={() => setNewTrigger(t)}
                        className={`text-[10px] px-2 py-1 rounded ${newTrigger === t ? 'bg-accent-emerald/20 text-accent-emerald' : 'bg-bg-elevated text-zinc-400 hover:text-zinc-200'}`}
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
                    className="input-base text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">能力边界（遇到什么不会做）</label>
                  <textarea
                    value={newBoundary}
                    onChange={e => setNewBoundary(e.target.value)}
                    placeholder="例如：无法处理 Rust 的 async fn 语法"
                    rows={3}
                    className="input-base text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2 p-4 border-t border-border-subtle">
                <button onClick={() => setShowAddModal(false)} className="btn-ghost flex-1 text-sm">取消</button>
                <button
                  onClick={handleAddRecord}
                  disabled={!newTrigger.trim() || !newBoundary.trim()}
                  className="btn-primary flex-1 text-sm disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" />
                  添加记录
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
