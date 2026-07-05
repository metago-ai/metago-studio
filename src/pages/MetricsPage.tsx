/**
 * 能力度量仪表盘（Pro 版 FR-2.3 / PRD 4.2.3）
 *
 * 6 维度度量：
 *   1. 决策锁通过率   - lockStats.passRate
 *   2. 元进化频率     - evolutionStats.last7Days / last30Days
 *   3. 能力覆盖率     - skills.length / 39（39 技能基因）
 *   4. 平台活跃度     - platforms 同步状态
 *   5. 幻觉拦截率     - lockStats.blocked / total
 *   6. 进化深度       - evolutionRecords max depth
 *
 * 4 种可视化：
 *   - 折线图（进化曲线时间序列）
 *   - 雷达图（10 维能力覆盖度）
 *   - 柱状图（平台活跃度分布）
 *   - 数字卡片（核心指标）
 *
 * Pro 门控：tier === 'pro' | 'pro_plus' | 'team' | 'enterprise'，否则渲染升级引导。
 */

import { useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, Cell,
} from 'recharts'
import {
  Activity, Shield, Dna, Layers, Zap, GitBranch,
  Crown, TrendingUp, TrendingDown, Minus,
  Target, Clock, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { useAuth } from '../contexts/AuthContext'
import type { Activity as ActivityType } from '../types'

// ============ 常量 ============

/** 元构 39 技能基因总数（能力覆盖率分母） */
const TOTAL_SKILL_GENE = 39

/** 度量维度 ID */
type MetricId =
  | 'lockPassRate'
  | 'evolutionFrequency'
  | 'skillCoverage'
  | 'platformActivity'
  | 'hallucinationBlockRate'
  | 'evolutionDepth'

interface MetricCard {
  id: MetricId
  label: string
  value: number
  display: string
  unit?: string
  icon: typeof Shield
  accent: 'emerald' | 'teal' | 'amber' | 'blue' | 'rose' | 'green'
  trend?: 'up' | 'down' | 'flat'
  trendValue?: string
  hint: string
}

// ============ 空状态 ============

function EmptyState() {
  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-card/60 p-12 text-center">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-bg-hover flex items-center justify-center mb-4">
        <Activity className="w-7 h-7 text-zinc-500" />
      </div>
      <h3 className="text-base font-semibold text-zinc-200 mb-2">暂无度量数据</h3>
      <p className="text-sm text-zinc-500 max-w-md mx-auto">
        开始使用决策锁校验和元进化功能后，能力度量数据将自动汇聚到这里。
      </p>
      <div className="flex items-center justify-center gap-3 mt-6">
        <Link
          to="/decision-lock"
          className="px-4 py-2 rounded-lg bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30 text-xs font-medium hover:bg-accent-emerald/25 transition-colors"
        >
          前往决策锁
        </Link>
        <Link
          to="/evolution"
          className="px-4 py-2 rounded-lg bg-accent-teal/15 text-accent-teal border border-accent-teal/30 text-xs font-medium hover:bg-accent-teal/25 transition-colors"
        >
          前往进化档案
        </Link>
      </div>
    </div>
  )
}

// ============ 主组件 ============

export function MetricsPage() {
  const {
    tier, decisionLockHistory, lockStats,
    evolutionRecords, evolutionStats, skills, platforms, activities,
    cloudMetrics, metricsLoading, syncMetricsFromCloud,
  } = useStore()
  const { user } = useAuth()

  const isPro = tier === 'pro' || tier === 'pro_plus' || tier === 'team' || tier === 'enterprise'

  // 拉取真实云端度量数据（来自 events 集合 — 本地 AI 工具自动上报 + 模板运行上报）
  useEffect(() => {
    syncMetricsFromCloud()
  }, [syncMetricsFromCloud])

  // 真实数据优先：cloudMetrics 存在且有数据时，优先使用云端聚合
  const hasCloudData = cloudMetrics && (cloudMetrics.decisionLock.total > 0 || cloudMetrics.evolution.total > 0)

  // 计算度量数据（cloudMetrics 优先，fallback 到本地统计）
  const metrics = useMemo<MetricCard[]>(() => {
    const cm = hasCloudData ? cloudMetrics! : null
    const totalValidations = cm ? cm.decisionLock.total : lockStats.total
    const passed = cm ? cm.decisionLock.passed : lockStats.passed
    const blocked = cm ? cm.decisionLock.blocked : lockStats.blocked
    const passRate = cm ? cm.decisionLock.passRate : (totalValidations > 0 ? lockStats.passRate : 0)
    const blockRate = totalValidations > 0 ? (blocked / totalValidations) * 100 : 0

    const evo7d = cm ? Math.round(cm.evolution.total / 4.3) : evolutionStats.last7Days
    const evo30d = cm ? cm.evolution.total : evolutionStats.last30Days
    const evoFrequency = evo30d > 0 ? evo7d / (evo30d / 4.3) : 0

    const skillCoverage = cm ? cm.skills.coverage : Math.min(100, (skills.length / TOTAL_SKILL_GENE) * 100)

    const activePlatforms = cm
      ? Object.entries(cm.platforms).filter(([, v]) => (v as number) > 0).length
      : platforms.filter(p => p.status === 'connected').length
    const platformActivity = platforms.length > 0 ? (activePlatforms / platforms.length) * 100 : 0

    const maxDepth = cm
      ? cm.evolution.maxDepth
      : (evolutionRecords.length > 0 ? Math.max(...evolutionRecords.map(r => r.depth)) : 0)
    const depthScore = maxDepth === 0 ? 0 : Math.min(100, 20 + maxDepth * 20)

    return [
      {
        id: 'lockPassRate',
        label: '决策锁通过率',
        value: passRate,
        display: passRate.toFixed(1),
        unit: '%',
        icon: Shield,
        accent: 'emerald',
        trend: passRate >= 80 ? 'up' : passRate >= 50 ? 'flat' : 'down',
        trendValue: `${passed}/${totalValidations}`,
        hint: '通过 / 总校验',
      },
      {
        id: 'evolutionFrequency',
        label: '元进化频率',
        value: evoFrequency,
        display: evoFrequency.toFixed(1),
        unit: '次/周',
        icon: Dna,
        accent: 'teal',
        trend: evoFrequency >= 2 ? 'up' : evoFrequency >= 1 ? 'flat' : 'down',
        trendValue: `7d ${evo7d} · 30d ${evo30d}`,
        hint: '近 7 / 30 天进化次数',
      },
      {
        id: 'skillCoverage',
        label: '能力覆盖率',
        value: skillCoverage,
        display: skillCoverage.toFixed(1),
        unit: '%',
        icon: Layers,
        accent: 'blue',
        trend: skillCoverage >= 80 ? 'up' : skillCoverage >= 50 ? 'flat' : 'down',
        trendValue: `${skills.length}/${TOTAL_SKILL_GENE}`,
        hint: '已加载技能 / 37 基因',
      },
      {
        id: 'platformActivity',
        label: '平台活跃度',
        value: platformActivity,
        display: platformActivity.toFixed(0),
        unit: '%',
        icon: Zap,
        accent: 'amber',
        trend: platformActivity >= 80 ? 'up' : platformActivity >= 50 ? 'flat' : 'down',
        trendValue: `${activePlatforms}/${platforms.length}`,
        hint: '已同步平台 / 总平台',
      },
      {
        id: 'hallucinationBlockRate',
        label: '幻觉拦截率',
        value: blockRate,
        display: blockRate.toFixed(1),
        unit: '%',
        icon: AlertTriangle,
        accent: 'rose',
        trend: blockRate === 0 ? 'flat' : 'up',
        trendValue: `${blocked} 次拦截`,
        hint: '阻断 / 总校验',
      },
      {
        id: 'evolutionDepth',
        label: '进化深度',
        value: depthScore,
        display: maxDepth === 0 ? '0' : `L${maxDepth}`,
        unit: maxDepth === 0 ? '' : '',
        icon: GitBranch,
        accent: 'green',
        trend: maxDepth >= 3 ? 'up' : maxDepth >= 1 ? 'flat' : 'down',
        trendValue: `最深 ${maxDepth} 层`,
        hint: '元进化递归深度',
      },
    ]
  }, [lockStats, evolutionStats, evolutionRecords, skills, platforms])

  // 进化曲线数据（折线图）
  const evolutionCurveData = useMemo(() => {
    return evolutionStats.dailyCounts.map(d => ({
      date: d.date.slice(5), // MM-DD
      进化次数: d.count,
      累计: evolutionRecords
        .filter(r => r.timestamp.slice(0, 10) <= d.date)
        .length,
    }))
  }, [evolutionStats.dailyCounts, evolutionRecords])

  // 能力雷达图数据
  const radarData = useMemo(() => {
    return evolutionStats.dimensions.map(d => ({
      dimension: d.dimension,
      评分: d.score,
      满分: d.fullMark,
    }))
  }, [evolutionStats.dimensions])

  // 平台活跃度柱状图数据
  const platformBarData = useMemo(() => {
    return platforms.map(p => ({
      name: p.name,
      记录数: p.recordCount,
      状态: p.status === 'connected' ? '已连接' : p.status === 'error' ? '失败' : p.status === 'syncing' ? '同步中' : '未连接',
      lastSync: p.lastSyncAt,
    }))
  }, [platforms])

  // 决策锁关卡分布
  const stageBreakdown = useMemo(() => {
    const stages = [
      { name: 'IVL 意图验证', blocked: lockStats.stageBlocks.ivl, color: '#10d985' },
      { name: 'ILT 谱系追踪', blocked: lockStats.stageBlocks.ilt, color: '#14b8a6' },
      { name: 'OSG 语义门', blocked: lockStats.stageBlocks.osg, color: '#f59e0b' },
      { name: '完整性校验', blocked: lockStats.stageBlocks.integrity, color: '#f43f5e' },
    ]
    return stages
  }, [lockStats.stageBlocks])

  // 健康度综合评分（0-100）
  const healthScore = useMemo(() => {
    const passRate = metrics[0].value
    const evoFreq = Math.min(100, metrics[1].value * 25) // 4次/周=100
    const coverage = metrics[2].value
    const platform = metrics[3].value
    const depth = metrics[5].value
    // 加权平均：通过率30% + 进化频率20% + 能力覆盖20% + 平台10% + 深度20%
    return Math.round(passRate * 0.3 + evoFreq * 0.2 + coverage * 0.2 + platform * 0.1 + depth * 0.2)
  }, [metrics])

  // 是否为空数据
  const isEmpty = decisionLockHistory.length === 0 && evolutionRecords.length === 0

  // ============ 渲染 ============

  // Free 用户可见基础指标（6 维度卡片 + 活动时间线），
  // 高级可视化（图表）以模糊预览呈现，建立"先试后买"转化路径。
  if (isEmpty) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <Header healthScore={0} />
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Header healthScore={healthScore} />

      {/* 6 维度数字卡片 - 所有用户可见 */}
      <section>
        <SectionTitle icon={Target} title="核心指标" subtitle={metricsLoading ? '正在同步真实数据…' : (hasCloudData ? '6 维度能力度量 · 真实云端数据' : '6 维度能力度量')} />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {metrics.map((m, idx) => (
            <MetricCardItem key={m.id} metric={m} index={idx} />
          ))}
        </div>
      </section>

      {/* 高级可视化分析 - Pro 专属，Free 模糊预览 */}
      <div className="relative">
        {!isPro && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none p-4">
            <ProPreviewOverlay />
          </div>
        )}
        <div className={isPro ? '' : 'filter blur-[6px] opacity-50 pointer-events-none select-none'}>

      {/* 进化曲线 + 雷达图 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border-subtle bg-bg-card/60 p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent-teal" />
                进化曲线（近 7 天）
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">每日进化次数与累计趋势</p>
            </div>
          </div>
          {evolutionCurveData.length === 0 ? (
            <ChartEmpty />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={evolutionCurveData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="evoGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272f" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#3a3a45' }} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#3a3a45' }} />
                <Tooltip
                  contentStyle={{
                    background: '#12121a',
                    border: '1px solid #3a3a45',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: '#a1a1aa' }}
                />
                <Area
                  type="monotone"
                  dataKey="进化次数"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  fill="url(#evoGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-border-subtle bg-bg-card/60 p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-accent-blue" />
                能力覆盖度（10 维雷达）
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">代码/架构/审查/设计/文档/测试/合规/安全/创意/沟通</p>
            </div>
          </div>
          {radarData.length === 0 ? (
            <ChartEmpty />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData} margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
                <PolarGrid stroke="#27272f" />
                <PolarAngleAxis dataKey="dimension" tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#52525b', fontSize: 9 }} />
                <Radar
                  name="评分"
                  dataKey="评分"
                  stroke="#00d4ff"
                  fill="#00d4ff"
                  fillOpacity={0.35}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={{
                    background: '#12121a',
                    border: '1px solid #3a3a45',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </section>

      {/* 平台活跃度 + 决策锁关卡分布 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-border-subtle bg-bg-card/60 p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-accent-amber" />
                平台活跃度
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">各平台同步次数统计</p>
            </div>
          </div>
          {platformBarData.length === 0 ? (
            <ChartEmpty />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={platformBarData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272f" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#3a3a45' }} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#3a3a45' }} />
                <Tooltip
                  contentStyle={{
                    background: '#12121a',
                    border: '1px solid #3a3a45',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                <Bar dataKey="记录数" radius={[4, 4, 0, 0]}>
                  {platformBarData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry.状态 === '已连接' ? '#10d985' : entry.状态 === '失败' ? '#f43f5e' : entry.状态 === '同步中' ? '#f59e0b' : '#52525b'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl border border-border-subtle bg-bg-card/60 p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Shield className="w-4 h-4 text-accent-emerald" />
                决策锁关卡阻断分布
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">四道关卡阻断次数对比</p>
            </div>
          </div>
          {stageBreakdown.every(s => s.blocked === 0) ? (
            <div className="h-[240px] flex items-center justify-center">
              <div className="text-center">
                <CheckCircle2 className="w-10 h-10 text-accent-emerald mx-auto mb-2" />
                <p className="text-sm text-zinc-400">决策锁从未被阻断</p>
                <p className="text-xs text-zinc-500 mt-1">所有校验均四关通过</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={stageBreakdown}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 32, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272f" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#3a3a45' }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#a1a1aa', fontSize: 11 }}
                  axisLine={{ stroke: '#3a3a45' }}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    background: '#12121a',
                    border: '1px solid #3a3a45',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                <Bar dataKey="blocked" radius={[0, 4, 4, 0]}>
                  {stageBreakdown.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </section>

        </div>
      </div>

      {/* 最近活动时间线 */}
      <section>
        <SectionTitle icon={Activity} title="最近活动" subtitle="能力使用时间线" />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-border-subtle bg-bg-card/60 p-5"
        >
          {activities.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-500">
              暂无活动记录。使用决策锁或触发元进化后，活动将自动记录。
            </div>
          ) : (
            <div className="space-y-2">
              {activities.slice(0, 10).map((act: ActivityType) => (
                <ActivityRow key={act.id} activity={act} />
              ))}
            </div>
          )}
        </motion.div>
      </section>

      {/* 用户信息脚注 */}
      {user && (
        <div className="text-xs text-zinc-600 text-center pb-4">
          度量数据归属：{user.email || user.phone || user.uid} · 数据本地存储 + 云端同步
        </div>
      )}
    </div>
  )
}

// ============ 子组件 ============

function Header({ healthScore }: { healthScore: number }) {
  const scoreColor =
    healthScore >= 80 ? 'text-accent-emerald' :
    healthScore >= 60 ? 'text-accent-amber' :
    'text-accent-rose'
  const scoreBg =
    healthScore >= 80 ? 'from-accent-emerald/20 to-accent-teal/10' :
    healthScore >= 60 ? 'from-accent-amber/20 to-accent-rose/10' :
    'from-accent-rose/20 to-accent-rose/5'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between flex-wrap gap-4"
    >
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Activity className="w-6 h-6 text-accent-emerald" />
          能力度量
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          6 维度可视化追踪元构生命体能力演化
        </p>
      </div>
      <div className={`flex items-center gap-3 px-4 py-2 rounded-xl bg-gradient-to-br ${scoreBg} border border-border-subtle`}>
        <div className="text-right">
          <div className="text-xs text-zinc-400">健康度评分</div>
          <div className={`text-2xl font-bold ${scoreColor}`}>{healthScore}</div>
        </div>
        <div className="w-px h-10 bg-border-subtle" />
        <div className="text-xs text-zinc-500">
          {healthScore >= 80 ? '优秀' : healthScore >= 60 ? '良好' : '待提升'}
        </div>
      </div>
    </motion.div>
  )
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: typeof Shield; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-zinc-400" />
      <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
      <span className="text-xs text-zinc-500">· {subtitle}</span>
    </div>
  )
}

function MetricCardItem({ metric, index }: { metric: MetricCard; index: number }) {
  const Icon = metric.icon
  const accentMap: Record<string, { text: string; bg: string; border: string }> = {
    emerald: { text: 'text-accent-emerald', bg: 'bg-accent-emerald/10', border: 'border-accent-emerald/20' },
    teal: { text: 'text-accent-teal', bg: 'bg-accent-teal/10', border: 'border-accent-teal/20' },
    amber: { text: 'text-accent-amber', bg: 'bg-accent-amber/10', border: 'border-accent-amber/20' },
    blue: { text: 'text-accent-blue', bg: 'bg-accent-blue/10', border: 'border-accent-blue/20' },
    rose: { text: 'text-accent-rose', bg: 'bg-accent-rose/10', border: 'border-accent-rose/20' },
    green: { text: 'text-accent-green', bg: 'bg-accent-green/10', border: 'border-accent-green/20' },
  }
  const accent = accentMap[metric.accent]
  const TrendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Minus
  const trendColor = metric.trend === 'up' ? 'text-accent-emerald' : metric.trend === 'down' ? 'text-accent-rose' : 'text-zinc-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`rounded-xl border ${accent.border} bg-bg-card/60 p-4 hover:bg-bg-card/80 transition-colors`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`w-7 h-7 rounded-lg ${accent.bg} flex items-center justify-center`}>
          <Icon className={`w-3.5 h-3.5 ${accent.text}`} />
        </div>
        <TrendIcon className={`w-3 h-3 ${trendColor}`} />
      </div>
      <div className={`text-2xl font-bold ${accent.text} leading-tight`}>
        {metric.display}
        {metric.unit && <span className="text-xs font-normal text-zinc-500 ml-1">{metric.unit}</span>}
      </div>
      <div className="text-xs text-zinc-400 mt-1">{metric.label}</div>
      <div className="text-[10px] text-zinc-600 mt-1 truncate" title={metric.hint}>
        {metric.trendValue}
      </div>
    </motion.div>
  )
}

function ActivityRow({ activity }: { activity: ActivityType }) {
  const statusConfig = {
    success: { icon: CheckCircle2, color: 'text-accent-emerald', bg: 'bg-accent-emerald/10' },
    blocked: { icon: XCircle, color: 'text-accent-rose', bg: 'bg-accent-rose/10' },
    pending: { icon: Clock, color: 'text-accent-amber', bg: 'bg-accent-amber/10' },
  }
  const config = statusConfig[activity.status]
  const StatusIcon = config.icon

  const typeLabel = {
    decision_lock: '决策锁',
    evolution: '元进化',
    template_run: '模板',
    skill_call: '技能',
  }[activity.type] || activity.type

  return (
    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-bg-hover/40 transition-colors">
      <div className={`w-6 h-6 rounded-md ${config.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
        <StatusIcon className={`w-3.5 h-3.5 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600">{typeLabel}</span>
          <span className="text-xs text-zinc-400 truncate">{activity.title}</span>
        </div>
        <div className="text-xs text-zinc-500 truncate mt-0.5">{activity.description}</div>
      </div>
      <div className="text-[10px] text-zinc-600 flex-shrink-0 mt-1">{activity.timestamp}</div>
    </div>
  )
}

function ChartEmpty() {
  return (
    <div className="h-[240px] flex items-center justify-center">
      <div className="text-center">
        <Activity className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
        <p className="text-xs text-zinc-500">暂无数据</p>
      </div>
    </div>
  )
}

/**
 * Pro 高级图表模糊预览的解锁提示层
 * Free 用户在高级可视化区域看到此卡片，建立升级转化路径。
 */
function ProPreviewOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-sm w-full rounded-2xl border border-accent-amber/30 bg-bg-card/95 backdrop-blur-md p-6 text-center shadow-card"
    >
      <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-accent-amber/20 to-accent-rose/20 flex items-center justify-center mb-3">
        <Crown className="w-6 h-6 text-accent-amber" />
      </div>
      <h3 className="text-sm font-semibold text-zinc-100 mb-1">升级 Pro 解锁深度分析</h3>
      <p className="text-xs text-zinc-500 mb-4">
        趋势曲线 · 雷达图 · 平台分布 · 关卡阻断分析
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link
          to="/pro"
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-accent-emerald to-accent-teal text-bg-deep text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          订阅 Pro
        </Link>
        <Link
          to="/pro"
          className="px-4 py-2 rounded-lg border border-border-subtle text-zinc-400 text-xs hover:text-zinc-200 transition-colors"
        >
          了解详情
        </Link>
      </div>
    </motion.div>
  )
}
