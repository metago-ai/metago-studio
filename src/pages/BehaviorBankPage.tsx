/**
 * 行为价值面板（Behavior Bank Page）
 *
 * 元构行为银行 MVP 的前端展示模块：
 *  - 信用分总览（总分/数字行为分/AI行为分）
 *  - 5 级信用等级徽章 + 进度条
 *  - 信用分趋势图（30 天）
 *  - 行为统计（按类别）
 *  - 行为记录流水（分页+过滤）
 *  - 5 级等级体系说明
 *  - 行为价值表（每种行为的分值）
 *  - 排行榜（Top 20）
 */
import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Sparkles, TrendingUp, Award, History, Trophy, BookOpen,
  RefreshCw, ChevronLeft, ChevronRight, Code2, FileText, Users,
  Shield, Dna, GitBranch, Bug, Play, Wrench, Crown, Sprout,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { useAuth } from '../contexts/AuthContext'
import { CreditBadge } from '../components/CreditBadge'
import { CREDIT_LEVELS, getLevelByScore, getNextLevel, calcProgressPercent } from '../lib/creditLevels'
import type { BehaviorCategory, BehaviorRecord } from '../types'

// 行为类别中文名映射
const CATEGORY_LABELS: Record<BehaviorCategory, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  code_contribution:   { label: '代码贡献',   icon: Code2,    color: 'text-accent-emerald' },
  doc_contribution:    { label: '文档贡献',   icon: FileText, color: 'text-accent-teal' },
  community_help:      { label: '社区帮助',   icon: Users,    color: 'text-accent-blue' },
  skill_creation:      { label: '技能创建',   icon: Sparkles, color: 'text-accent-amber' },
  bug_report:          { label: 'Bug 上报',  icon: Bug,     color: 'text-accent-rose' },
  template_run:        { label: '模板运行',   icon: Play,    color: 'text-accent-teal' },
  decision_lock_pass:  { label: '决策锁通过', icon: Shield,  color: 'text-accent-emerald' },
  decision_lock_block: { label: '决策锁阻断', icon: Shield,  color: 'text-accent-rose' },
  evolution_iteration: { label: '元进化迭代', icon: Dna,     color: 'text-accent-amber' },
  compliance_check:    { label: '合规检查',   icon: Shield,  color: 'text-accent-emerald' },
  provenance_trace:    { label: '溯源完整',   icon: GitBranch, color: 'text-accent-teal' },
  skill_call:          { label: '技能调用',   icon: Wrench,  color: 'text-accent-blue' },
  output_integrity:    { label: '输出完整性', icon: Shield,  color: 'text-accent-emerald' },
}

// 行为价值表（与云函数 BEHAVIOR_VALUES 保持一致）
const BEHAVIOR_VALUES: Record<BehaviorCategory, number> = {
  code_contribution: 5,
  doc_contribution: 3,
  community_help: 2,
  skill_creation: 10,
  bug_report: 3,
  template_run: 1,
  decision_lock_pass: 1,
  decision_lock_block: -2,
  evolution_iteration: 2,
  compliance_check: 2,
  provenance_trace: 1,
  skill_call: 1,
  output_integrity: 1,
}

const PAGE_SIZE = 20

export function BehaviorBankPage() {
  const { user } = useAuth()
  const {
    creditScore,
    behaviorRecords,
    creditHistory,
    leaderboard,
    behaviorBankLoading,
    loadCreditScore,
    loadBehaviorRecords,
    loadCreditHistory,
    loadLeaderboard,
    recordBehavior,
  } = useStore()

  const [filter, setFilter] = useState<'all' | 'digital' | 'ai'>('all')
  const [page, setPage] = useState(0)
  const [activeTab, setActiveTab] = useState<'overview' | 'records' | 'levels' | 'leaderboard'>('overview')
  // 手动记录行为的弹窗状态
  const [manualOpen, setManualOpen] = useState(false)

  // 首次加载
  useEffect(() => {
    loadCreditScore()
    loadBehaviorRecords({ limit: PAGE_SIZE, offset: 0 })
    loadCreditHistory(30)
    loadLeaderboard(20)
  }, [loadCreditScore, loadBehaviorRecords, loadCreditHistory, loadLeaderboard])

  // 过滤变化时重新加载
  useEffect(() => {
    loadBehaviorRecords({
      type: filter === 'all' ? undefined : filter,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
  }, [filter, page, loadBehaviorRecords])

  const handleRefresh = useCallback(() => {
    loadCreditScore()
    loadBehaviorRecords({
      type: filter === 'all' ? undefined : filter,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
    loadCreditHistory(30)
    loadLeaderboard(20)
  }, [filter, page, loadCreditScore, loadBehaviorRecords, loadCreditHistory, loadLeaderboard])

  const handleManualRecord = useCallback(async (category: BehaviorCategory) => {
    const res = await recordBehavior(category, category, { manual: true })
    if (res.success) {
      handleRefresh()
    }
    setManualOpen(false)
  }, [recordBehavior, handleRefresh])

  const score = creditScore?.totalScore ?? 0
  const level = getLevelByScore(score)
  const nextLevel = getNextLevel(level.id)
  const progress = calcProgressPercent(score, level)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 头部 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-accent-amber" />
            行为价值面板
            {creditScore && (
              <CreditBadge score={score} size="md" className="ml-2" />
            )}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            元构行为银行 · 数字行为 + AI行为 → 信用分 → 5 级等级
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={behaviorBankLoading}
          className="btn-secondary text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${behaviorBankLoading ? 'animate-spin' : ''}`} />
          刷新数据
        </button>
      </motion.div>

      {/* 未登录提示 */}
      {!user && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card-base p-4 border border-accent-amber/30 bg-accent-amber/5"
        >
          <p className="text-sm text-accent-amber">
            未登录状态下行为仅本地可见。登录后行为将持久化到云端，累积信用分解锁等级特权。
          </p>
        </motion.div>
      )}

      {/* Tab 切换 */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-elevated/50 w-fit overflow-x-auto">
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
          <TrendingUp className="w-3.5 h-3.5" /> 总览
        </TabButton>
        <TabButton active={activeTab === 'records'} onClick={() => setActiveTab('records')}>
          <History className="w-3.5 h-3.5" /> 行为记录
        </TabButton>
        <TabButton active={activeTab === 'levels'} onClick={() => setActiveTab('levels')}>
          <Award className="w-3.5 h-3.5" /> 等级体系
        </TabButton>
        <TabButton active={activeTab === 'leaderboard'} onClick={() => setActiveTab('leaderboard')}>
          <Trophy className="w-3.5 h-3.5" /> 排行榜
        </TabButton>
      </div>

      {/* === Tab: 总览 === */}
      {activeTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* 信用分卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ScoreCard
              title="总信用分"
              value={score}
              icon={Crown}
              color="text-accent-amber"
              subtitle={level.name}
            />
            <ScoreCard
              title="数字行为分"
              value={creditScore?.digitalScore ?? 0}
              icon={Code2}
              color="text-accent-emerald"
              subtitle={`共 ${creditScore?.stats.digitalRecords ?? 0} 条记录`}
            />
            <ScoreCard
              title="AI 行为分"
              value={creditScore?.aiScore ?? 0}
              icon={Dna}
              color="text-accent-teal"
              subtitle={`共 ${creditScore?.stats.aiRecords ?? 0} 条记录`}
            />
          </div>

          {/* 等级进度条 */}
          <div className="card-base p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                <Award className="w-4 h-4 text-accent-amber" />
                等级进度
              </h2>
              <span className="text-xs text-zinc-500">
                {nextLevel ? `距离 ${nextLevel.name} 还差 ${creditScore?.scoreToNextLevel ?? 0} 分` : '已达最高等级'}
              </span>
            </div>
            <div className="w-full h-3 bg-bg-elevated rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-accent-emerald to-accent-amber rounded-full"
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-[10px] text-zinc-500">
              <span>{level.name}（{level.minScore} 分）</span>
              {nextLevel ? (
                <span>{nextLevel.name}（{nextLevel.minScore} 分）</span>
              ) : (
                <span className="text-accent-amber">∞ 最高等级</span>
              )}
            </div>
          </div>

          {/* 信用分趋势图 */}
          {creditHistory.length > 0 && (
            <div className="card-base p-5">
              <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-accent-emerald" />
                信用分趋势（30 天）
              </h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={creditHistory}>
                    <defs>
                      <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis
                      dataKey="date"
                      stroke="#52525b"
                      fontSize={10}
                      tickFormatter={(v: string) => v.slice(5)}
                    />
                    <YAxis stroke="#52525b" fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        border: '1px solid #3f3f46',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      labelStyle={{ color: '#e4e4e7' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="totalScore"
                      name="信用分"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#scoreGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 行为统计（按类别） */}
          {creditScore && (
            <div className="card-base p-5">
              <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2 mb-4">
                <BookOpen className="w-4 h-4 text-accent-teal" />
                行为统计
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <StatCell label="决策锁通过" value={creditScore.stats.decisionLockPasses} icon={Shield} color="text-accent-emerald" />
                <StatCell label="决策锁阻断" value={creditScore.stats.decisionLockBlocks} icon={Shield} color="text-accent-rose" />
                <StatCell label="元进化迭代" value={creditScore.stats.evolutionIterations} icon={Dna} color="text-accent-amber" />
                <StatCell label="合规检查" value={creditScore.stats.complianceChecks} icon={Shield} color="text-accent-emerald" />
                <StatCell label="溯源完整" value={creditScore.stats.provenanceTraces} icon={GitBranch} color="text-accent-teal" />
                <StatCell label="技能调用" value={creditScore.stats.skillCalls} icon={Wrench} color="text-accent-blue" />
                <StatCell label="代码贡献" value={creditScore.stats.codeContributions} icon={Code2} color="text-accent-emerald" />
                <StatCell label="文档贡献" value={creditScore.stats.docContributions} icon={FileText} color="text-accent-teal" />
                <StatCell label="社区帮助" value={creditScore.stats.communityHelps} icon={Users} color="text-accent-blue" />
                <StatCell label="技能创建" value={creditScore.stats.skillCreations} icon={Sparkles} color="text-accent-amber" />
                <StatCell label="Bug 上报" value={creditScore.stats.bugReports} icon={Bug} color="text-accent-rose" />
                <StatCell label="模板运行" value={creditScore.stats.templateRuns} icon={Play} color="text-accent-teal" />
              </div>
            </div>
          )}

          {/* 手动记录行为 */}
          <div className="card-base p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-accent-emerald" />
                手动记录行为（测试用）
              </h2>
              <button
                onClick={() => setManualOpen(!manualOpen)}
                className="btn-ghost text-xs"
              >
                {manualOpen ? '收起' : '展开'}
              </button>
            </div>
            {manualOpen && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {(Object.keys(BEHAVIOR_VALUES) as BehaviorCategory[]).map((cat) => {
                  const meta = CATEGORY_LABELS[cat]
                  const Icon = meta.icon
                  const value = BEHAVIOR_VALUES[cat]
                  return (
                    <button
                      key={cat}
                      onClick={() => handleManualRecord(cat)}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg bg-bg-elevated border border-border-subtle hover:border-accent-emerald/30 hover:bg-bg-hover transition-colors text-center"
                    >
                      <Icon className={`w-4 h-4 ${meta.color}`} />
                      <span className="text-[10px] text-zinc-300">{meta.label}</span>
                      <span className={`text-[10px] font-bold ${value >= 0 ? 'text-accent-emerald' : 'text-accent-rose'}`}>
                        {value >= 0 ? `+${value}` : value}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            <p className="text-[10px] text-zinc-600 mt-2">
              生产环境中行为由系统自动记录（决策锁通过/元进化迭代等）。此处仅供测试和演示。
            </p>
          </div>
        </motion.div>
      )}

      {/* === Tab: 行为记录 === */}
      {activeTab === 'records' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-base p-5"
        >
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
              <History className="w-4 h-4 text-accent-teal" />
              行为记录流水
            </h2>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-elevated/50">
              <FilterButton active={filter === 'all'} onClick={() => { setFilter('all'); setPage(0) }}>
                全部
              </FilterButton>
              <FilterButton active={filter === 'digital'} onClick={() => { setFilter('digital'); setPage(0) }}>
                数字行为
              </FilterButton>
              <FilterButton active={filter === 'ai'} onClick={() => { setFilter('ai'); setPage(0) }}>
                AI 行为
              </FilterButton>
            </div>
          </div>

          {behaviorRecords.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="space-y-2">
                {behaviorRecords.map((r, idx) => (
                  <RecordRow key={r.id ?? idx} record={r} />
                ))}
              </div>
              {/* 分页 */}
              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="btn-ghost text-xs disabled:opacity-40"
                >
                  <ChevronLeft className="w-3 h-3" /> 上一页
                </button>
                <span className="text-xs text-zinc-500">第 {page + 1} 页</span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={behaviorRecords.length < PAGE_SIZE}
                  className="btn-ghost text-xs disabled:opacity-40"
                >
                  下一页 <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* === Tab: 等级体系 === */}
      {activeTab === 'levels' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="card-base p-5">
            <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2 mb-4">
              <Award className="w-4 h-4 text-accent-amber" />
              元构 5 级信用等级体系
            </h2>
            <div className="space-y-3">
              {CREDIT_LEVELS.map((lv, idx) => {
                const isCurrent = lv.id === level.id
                return (
                  <motion.div
                    key={lv.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`p-4 rounded-lg border ${
                      isCurrent
                        ? 'bg-accent-amber/5 border-accent-amber/40'
                        : 'bg-bg-elevated border-border-subtle'
                    }`}
                  >
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <CreditBadge levelId={lv.id} size="lg" showName={false} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${lv.color}`}>{lv.name}</span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded bg-accent-amber/20 text-accent-amber text-[10px] font-bold">
                                当前
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5">{lv.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-zinc-400">
                          {lv.minScore} - {lv.maxScore === Number.MAX_SAFE_INTEGER ? '∞' : lv.maxScore} 分
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="text-[10px] text-zinc-600 mb-1">等级特权：</p>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-1">
                        {lv.privileges.map((p, i) => (
                          <li key={i} className="text-xs text-zinc-400 flex items-start gap-1">
                            <span className="text-accent-emerald mt-0.5">✓</span>
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* 行为价值表 */}
          <div className="card-base p-5">
            <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2 mb-4">
              <BookOpen className="w-4 h-4 text-accent-teal" />
              行为价值表
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-xs font-medium text-accent-emerald mb-2">数字行为（用户贡献）</h3>
                <div className="space-y-1">
                  {(['code_contribution', 'doc_contribution', 'community_help', 'skill_creation', 'bug_report', 'template_run'] as BehaviorCategory[]).map(cat => (
                    <ValueRow key={cat} cat={cat} />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-medium text-accent-teal mb-2">AI 行为（AI 自主行为）</h3>
                <div className="space-y-1">
                  {(['decision_lock_pass', 'decision_lock_block', 'evolution_iteration', 'compliance_check', 'provenance_trace', 'skill_call', 'output_integrity'] as BehaviorCategory[]).map(cat => (
                    <ValueRow key={cat} cat={cat} />
                  ))}
                </div>
              </div>
            </div>
            <p className="text-[10px] text-zinc-600 mt-3">
              决策锁阻断为负值（-2 分），表示对 AI 错误输出的负向反馈。其他行为均为正值。
            </p>
          </div>
        </motion.div>
      )}

      {/* === Tab: 排行榜 === */}
      {activeTab === 'leaderboard' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-base p-5"
        >
          <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-accent-amber" />
            信用分排行榜（Top 20）
          </h2>
          {leaderboard.length === 0 ? (
            <EmptyState text="还没有用户上榜。成为第一个上榜的人吧！" />
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, idx) => (
                <motion.div
                  key={entry.uid ?? idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    idx < 3
                      ? 'bg-gradient-to-r from-accent-amber/10 to-transparent border border-accent-amber/20'
                      : 'bg-bg-elevated border border-border-subtle'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-lg font-bold w-8 text-center ${
                      idx === 0 ? 'text-accent-amber' :
                      idx === 1 ? 'text-zinc-300' :
                      idx === 2 ? 'text-accent-rose' :
                      'text-zinc-600'
                    }`}>
                      {idx + 1}
                    </span>
                    <CreditBadge levelId={entry.level} size="sm" showName={false} />
                    <div className="min-w-0">
                      <div className="text-sm text-zinc-200 truncate">{entry.displayName}</div>
                      <div className="text-[10px] text-zinc-500">
                        {entry.levelName} · {entry.recordsCount} 条行为
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold text-accent-emerald">{entry.totalScore}</div>
                    <div className="text-[10px] text-zinc-500">分</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

// ============ 子组件 ============

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
        active ? 'bg-accent-emerald/20 text-accent-emerald' : 'text-zinc-500 hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  )
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded text-[10px] transition-colors ${
        active ? 'bg-accent-emerald/20 text-accent-emerald' : 'text-zinc-500 hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  )
}

function ScoreCard({
  title, value, icon: Icon, color, subtitle,
}: {
  title: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  color: string
  subtitle?: string
}) {
  return (
    <div className="card-base p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-500">{title}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {subtitle && <div className="text-[10px] text-zinc-600 mt-1">{subtitle}</div>}
    </div>
  )
}

function StatCell({
  label, value, icon: Icon, color,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-bg-elevated/50">
      <Icon className={`w-3.5 h-3.5 ${color} flex-shrink-0`} />
      <div className="min-w-0">
        <div className="text-sm font-bold text-zinc-200">{value}</div>
        <div className="text-[9px] text-zinc-500 truncate">{label}</div>
      </div>
    </div>
  )
}

function RecordRow({ record }: { record: BehaviorRecord }) {
  const meta = CATEGORY_LABELS[record.category] ?? { label: record.category, icon: Code2, color: 'text-zinc-400' }
  const Icon = meta.icon
  const value = record.value
  const date = new Date(record.timestamp)
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-bg-elevated/30 hover:bg-bg-elevated/60 transition-colors">
      <Icon className={`w-4 h-4 ${meta.color} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-200">{meta.label}</span>
          <span className="text-[9px] text-zinc-600 px-1 py-0.5 rounded bg-bg-deep">
            {record.type === 'digital' ? '数字' : 'AI'}
          </span>
        </div>
        <div className="text-[10px] text-zinc-500 mt-0.5">
          {date.toLocaleString('zh-CN')} · {record.source}
        </div>
      </div>
      <span className={`text-sm font-bold flex-shrink-0 ${value >= 0 ? 'text-accent-emerald' : 'text-accent-rose'}`}>
        {value >= 0 ? `+${value}` : value}
      </span>
    </div>
  )
}

function ValueRow({ cat }: { cat: BehaviorCategory }) {
  const meta = CATEGORY_LABELS[cat]
  const Icon = meta.icon
  const value = BEHAVIOR_VALUES[cat]
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-bg-elevated/30">
      <div className="flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
        <span className="text-xs text-zinc-300">{meta.label}</span>
      </div>
      <span className={`text-xs font-bold ${value >= 0 ? 'text-accent-emerald' : 'text-accent-rose'}`}>
        {value >= 0 ? `+${value}` : value} 分
      </span>
    </div>
  )
}

function EmptyState({ text = '暂无行为记录。开始使用元构产品即可自动累积信用分。' }: { text?: string }) {
  return (
    <div className="text-center py-12">
      <Sprout className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
      <p className="text-sm text-zinc-500">{text}</p>
      <p className="text-[10px] text-zinc-600 mt-2">
        触发决策锁校验、运行元进化循环、调用技能均可获得信用分
      </p>
    </div>
  )
}
