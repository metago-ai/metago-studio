import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Area,
  AreaChart,
} from 'recharts'
import {
  Dna,
  Download,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  GitBranch,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { EVOLUTION_STATS } from '../data/evolution'

const TIME_RANGES = [
  { id: '7d', label: '7 天', count: EVOLUTION_STATS.last7Days },
  { id: '30d', label: '30 天', count: EVOLUTION_STATS.last30Days },
  { id: '90d', label: '90 天', count: EVOLUTION_STATS.last90Days },
  { id: '365d', label: '365 天', count: EVOLUTION_STATS.last365Days },
]

export function EvolutionPage() {
  const { evolutionRecords } = useStore()
  const [timeRange, setTimeRange] = useState('7d')

  const chartData = EVOLUTION_STATS.dailyCounts.map((d) => ({
    date: d.date,
    进化次数: d.count,
  }))

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
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
          <button className="btn-secondary text-xs">
            <Download className="w-3 h-3" />
            导出 JSON
          </button>
          <button className="btn-secondary text-xs">
            <Download className="w-3 h-3" />
            导出 Markdown
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-2">
            <Dna className="w-4 h-4 text-accent-teal" />
            <span className="text-xs text-zinc-500">总进化次数</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">{EVOLUTION_STATS.totalEvolutions}</div>
        </div>
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-accent-emerald" />
            <span className="text-xs text-zinc-500">成功率</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">
            {(EVOLUTION_STATS.successRate * 100).toFixed(1)}%
          </div>
        </div>
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-accent-amber" />
            <span className="text-xs text-zinc-500">平均耗时</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">
            {EVOLUTION_STATS.averageDurationMs}ms
          </div>
        </div>
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-accent-blue" />
            <span className="text-xs text-zinc-500">最大递归深度</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">
            {Math.max(...evolutionRecords.map((r) => r.depth))} 层
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="card-base p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent-teal" />
            进化曲线
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

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        <div className="card-base p-5">
          <h3 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-accent-emerald" />
            能力雷达图（10 维）
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={EVOLUTION_STATS.dimensions}>
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
            {EVOLUTION_STATS.dimensions.map((dim, i) => (
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

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="card-base p-5"
      >
        <h3 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-accent-amber" />
          最近进化记录
        </h3>
        <div className="space-y-3">
          {evolutionRecords.slice(0, 5).map((record, idx) => (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + idx * 0.05 }}
              className="p-4 rounded-lg bg-bg-elevated/50 hover:bg-bg-hover transition-colors"
            >
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-accent-teal">#{record.id}</span>
                  <span className="text-sm font-medium text-zinc-100">{record.trigger}</span>
                  {record.recursed && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent-teal/10 text-accent-teal flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" />
                      递归 {record.depth} 层
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span>{record.timestamp}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {record.durationMs}ms
                  </span>
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
      </motion.div>
    </div>
  )
}
