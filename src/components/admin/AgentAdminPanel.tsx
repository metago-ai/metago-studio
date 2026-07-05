/**
 * Agent 后台管理面板
 *
 * 作为 AdminPage 的新 Tab，集中管理 MetaGO Agent 相关数据：
 * - 总览：对话总量、Token 消耗、BYOK 渗透率、桌面端下载量
 * - AI 对话日志：最近对话记录，支持按用户/模型/时间筛选
 * - 配额管理：按用户查看 Token 用量，支持手动充值
 *
 * 数据来源：
 * - aiProxy 云函数的 logChat action 写入 events 集合
 * - admin 云函数的 getAgentStats / getAgentLogs / getAgentQuota 查询
 */

import { useState, useEffect } from 'react'
import {
  MessageSquare, Cpu, Download, TrendingUp, Activity, Zap,
  Search, RefreshCw, ChevronLeft, ChevronRight, AlertCircle,
} from 'lucide-react'
import { callAdminHttp } from '../../lib/adminHttp'

type AgentSubTab = 'overview' | 'logs' | 'quota'

interface AgentStats {
  totalChats: number
  todayChats: number
  weekChats: number
  monthChats: number
  totalTokens: number
  todayTokens: number
  byModel: Record<string, number>
  byokRate: number
  desktopDownloads: number
  activeUsersDAU: number
  activeUsersWAU: number
  activeUsersMAU: number
}

interface AgentLog {
  _id: string
  userId?: string
  model: string
  inputPreview: string
  tokensIn: number
  tokensOut: number
  tokensTotal: number
  hasToolCalls: boolean
  toolCallCount: number
  hasWebSearch: boolean
  durationMs: number
  createdAt: string
}

interface AgentQuotaRow {
  userId: string
  email?: string
  tier: string
  todayTokens: number
  monthTokens: number
  monthCap: number
  lastActiveAt?: string
}

export function AgentAdminPanel() {
  const [subTab, setSubTab] = useState<AgentSubTab>('overview')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [stats, setStats] = useState<AgentStats | null>(null)
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [logsPage, setLogsPage] = useState(1)
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsFilter, setLogsFilter] = useState({ userId: '', model: '' })

  const [quotas, setQuotas] = useState<AgentQuotaRow[]>([])
  const [quotasPage, setQuotasPage] = useState(1)
  const [quotasTotal, setQuotasTotal] = useState(0)
  const [quotaSearch, setQuotaSearch] = useState('')
  const [rechargeAmount, setRechargeAmount] = useState<Record<string, number>>({})

  const pageSize = 20

  const loadStats = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await callAdminHttp('getAgentStats', {})
      if (res.code === 0) {
        setStats(res.data)
      } else {
        setError(res.message || '加载失败')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const loadLogs = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await callAdminHttp('getAgentLogs', {
        page: logsPage,
        pageSize,
        ...logsFilter,
      })
      if (res.code === 0) {
        setLogs(res.data.logs)
        setLogsTotal(res.data.total)
      } else {
        setError(res.message || '加载失败')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const loadQuotas = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await callAdminHttp('getAgentQuota', {
        page: quotasPage,
        pageSize,
        search: quotaSearch,
      })
      if (res.code === 0) {
        setQuotas(res.data.quotas)
        setQuotasTotal(res.data.total)
      } else {
        setError(res.message || '加载失败')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (subTab === 'overview') loadStats()
    else if (subTab === 'logs') loadLogs()
    else if (subTab === 'quota') loadQuotas()
  }, [subTab, logsPage, quotasPage])

  const handleRecharge = async (userId: string) => {
    const amount = rechargeAmount[userId]
    if (!amount || amount <= 0) return
    try {
      const res = await callAdminHttp('rechargeTokens', { userId, amount })
      if (res.code === 0) {
        alert(`已为用户充值 ${amount} tokens`)
        setRechargeAmount({ ...rechargeAmount, [userId]: 0 })
        loadQuotas()
      } else {
        alert(res.message || '充值失败')
      }
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const subTabs: { id: AgentSubTab; label: string; icon: typeof Activity }[] = [
    { id: 'overview', label: '总览仪表盘', icon: TrendingUp },
    { id: 'logs', label: 'AI 对话日志', icon: MessageSquare },
    { id: 'quota', label: '配额与用量', icon: Cpu },
  ]

  return (
    <div className="space-y-4">
      {/* 子 Tab 切换 */}
      <div className="flex gap-1 p-1 bg-bg-elevated/50 rounded-lg w-fit">
        {subTabs.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 transition-colors ${
                subTab === t.id ? 'bg-accent-emerald/20 text-accent-emerald' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <RefreshCw className="w-4 h-4 animate-spin" /> 加载中...
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* ===== Agent 总览仪表盘 ===== */}
      {subTab === 'overview' && stats && (
        <div className="space-y-4">
          {/* 顶部 4 卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              icon={MessageSquare}
              label="AI 对话总数"
              value={stats.totalChats}
              subtext={`今日 ${stats.todayChats} · 本周 ${stats.weekChats} · 本月 ${stats.monthChats}`}
              color="emerald"
            />
            <MetricCard
              icon={Zap}
              label="Token 消耗总量"
              value={stats.totalTokens}
              subtext={`今日 ${stats.todayTokens.toLocaleString()}`}
              color="amber"
            />
            <MetricCard
              icon={Download}
              label="桌面端下载量"
              value={stats.desktopDownloads}
              subtext="累计下载次数"
              color="blue"
            />
            <MetricCard
              icon={Activity}
              label="BYOK 渗透率"
              value={`${stats.byokRate.toFixed(1)}%`}
              subtext="用户自带 Key 比例"
              color="violet"
            />
          </div>

          {/* 用户活跃度 */}
          <div className="grid grid-cols-3 gap-3">
            <MetricCard icon={TrendingUp} label="DAU" value={stats.activeUsersDAU} subtext="日活" color="emerald" />
            <MetricCard icon={TrendingUp} label="WAU" value={stats.activeUsersWAU} subtext="周活" color="blue" />
            <MetricCard icon={TrendingUp} label="MAU" value={stats.activeUsersMAU} subtext="月活" color="amber" />
          </div>

          {/* 按模型分布 */}
          <div className="p-4 rounded-lg bg-bg-elevated border border-border-subtle">
            <h3 className="text-sm font-medium text-zinc-200 mb-3 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-accent-blue" />
              模型用量分布
            </h3>
            <div className="space-y-2">
              {Object.entries(stats.byModel).length === 0 ? (
                <div className="text-xs text-zinc-500">暂无数据</div>
              ) : (
                Object.entries(stats.byModel).map(([model, count]) => {
                  const max = Math.max(...Object.values(stats.byModel))
                  const pct = max > 0 ? (count / max) * 100 : 0
                  return (
                    <div key={model} className="flex items-center gap-2">
                      <div className="text-xs text-zinc-300 w-40 font-mono">{model}</div>
                      <div className="flex-1 h-2 bg-bg-deep rounded overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-accent-blue to-accent-emerald"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-xs text-zinc-400 w-16 text-right">{count.toLocaleString()}</div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== AI 对话日志 ===== */}
      {subTab === 'logs' && (
        <div className="space-y-3">
          {/* 筛选 */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-bg-deep border border-border-subtle">
              <Search className="w-3 h-3 text-zinc-500" />
              <input
                value={logsFilter.userId}
                onChange={e => setLogsFilter({ ...logsFilter, userId: e.target.value })}
                placeholder="按用户 ID 搜索"
                className="text-xs bg-transparent text-zinc-300 focus:outline-none w-40"
              />
            </div>
            <select
              value={logsFilter.model}
              onChange={e => setLogsFilter({ ...logsFilter, model: e.target.value })}
              className="px-2 py-1 text-xs rounded bg-bg-deep border border-border-subtle text-zinc-300"
            >
              <option value="">全部模型</option>
              <option value="deepseek-v4-pro">DeepSeek V4 Pro</option>
              <option value="deepseek-v4-flash">DeepSeek V4 Flash</option>
              <option value="glm-5v-turbo">GLM-5V Turbo</option>
            </select>
            <button
              onClick={loadLogs}
              className="px-3 py-1 text-xs rounded bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/30 hover:bg-accent-emerald/20"
            >
              查询
            </button>
          </div>

          {/* 日志列表 */}
          <div className="rounded-lg border border-border-subtle overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-bg-deep border-b border-border-subtle">
                  <th className="text-left px-3 py-2 font-medium text-zinc-400">时间</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-400">用户</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-400">模型</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-400">输入摘要</th>
                  <th className="text-right px-3 py-2 font-medium text-zinc-400">Tokens</th>
                  <th className="text-center px-3 py-2 font-medium text-zinc-400">工具调用</th>
                  <th className="text-right px-3 py-2 font-medium text-zinc-400">耗时</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-zinc-500">
                      {loading ? '加载中...' : '暂无对话记录'}
                    </td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <tr key={log._id} className="border-b border-border-subtle/30 hover:bg-bg-hover">
                      <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('zh-CN', { hour12: false })}
                      </td>
                      <td className="px-3 py-2 text-zinc-400 font-mono">
                        {(log.userId || 'anon').slice(0, 12)}
                      </td>
                      <td className="px-3 py-2 text-zinc-300">{log.model}</td>
                      <td className="px-3 py-2 text-zinc-400 max-w-xs truncate">
                        {log.inputPreview}
                      </td>
                      <td className="px-3 py-2 text-right text-accent-amber font-mono">
                        {log.tokensTotal.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {log.hasToolCalls ? (
                          <span className="text-accent-emerald">{log.toolCallCount} 次</span>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-400">
                        {log.durationMs ? `${(log.durationMs / 1000).toFixed(1)}s` : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {logsTotal > pageSize && (
            <Pagination
              page={logsPage}
              total={logsTotal}
              pageSize={pageSize}
              onPageChange={setLogsPage}
            />
          )}
        </div>
      )}

      {/* ===== 配额与用量 ===== */}
      {subTab === 'quota' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-bg-deep border border-border-subtle">
              <Search className="w-3 h-3 text-zinc-500" />
              <input
                value={quotaSearch}
                onChange={e => setQuotaSearch(e.target.value)}
                placeholder="搜索用户 ID 或邮箱"
                className="text-xs bg-transparent text-zinc-300 focus:outline-none w-60"
              />
            </div>
            <button
              onClick={loadQuotas}
              className="px-3 py-1 text-xs rounded bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/30 hover:bg-accent-emerald/20"
            >
              查询
            </button>
          </div>

          <div className="rounded-lg border border-border-subtle overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-bg-deep border-b border-border-subtle">
                  <th className="text-left px-3 py-2 font-medium text-zinc-400">用户</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-400">档位</th>
                  <th className="text-right px-3 py-2 font-medium text-zinc-400">今日 Tokens</th>
                  <th className="text-right px-3 py-2 font-medium text-zinc-400">本月 Tokens</th>
                  <th className="text-right px-3 py-2 font-medium text-zinc-400">月度上限</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-400">使用率</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-400">手动充值</th>
                  <th className="text-left px-3 py-2 font-medium text-zinc-400">最后活跃</th>
                </tr>
              </thead>
              <tbody>
                {quotas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-zinc-500">
                      {loading ? '加载中...' : '暂无数据'}
                    </td>
                  </tr>
                ) : (
                  quotas.map(q => {
                    const usagePct = q.monthCap > 0 ? (q.monthTokens / q.monthCap) * 100 : 0
                    const isHigh = usagePct > 80
                    return (
                      <tr key={q.userId} className="border-b border-border-subtle/30 hover:bg-bg-hover">
                        <td className="px-3 py-2 text-zinc-300 font-mono">
                          {q.email || q.userId.slice(0, 16)}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            q.tier === 'pro' || q.tier === 'team' ? 'bg-accent-emerald/15 text-accent-emerald' :
                            q.tier === 'enterprise' ? 'bg-accent-violet/15 text-accent-violet' :
                            'bg-bg-deep text-zinc-400'
                          }`}>
                            {q.tier}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-300 font-mono">{q.todayTokens.toLocaleString()}</td>
                        <td className={`px-3 py-2 text-right font-mono ${isHigh ? 'text-accent-amber' : 'text-zinc-300'}`}>
                          {q.monthTokens.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-500 font-mono">
                          {q.monthCap > 0 ? q.monthCap.toLocaleString() : '∞'}
                        </td>
                        <td className="px-3 py-2">
                          {q.monthCap > 0 ? (
                            <div className="flex items-center gap-1">
                              <div className="w-16 h-1.5 bg-bg-deep rounded overflow-hidden">
                                <div
                                  className={`h-full ${isHigh ? 'bg-accent-amber' : 'bg-accent-emerald'}`}
                                  style={{ width: `${Math.min(100, usagePct)}%` }}
                                />
                              </div>
                              <span className={`text-[10px] ${isHigh ? 'text-accent-amber' : 'text-zinc-500'}`}>
                                {usagePct.toFixed(0)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-zinc-600">BYOK</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={rechargeAmount[q.userId] || ''}
                              onChange={e => setRechargeAmount({ ...rechargeAmount, [q.userId]: parseInt(e.target.value) || 0 })}
                              placeholder="tokens"
                              className="w-20 px-1 py-0.5 text-[10px] bg-bg-deep border border-border-subtle rounded text-zinc-300 focus:outline-none"
                            />
                            <button
                              onClick={() => handleRecharge(q.userId)}
                              className="px-1.5 py-0.5 text-[10px] rounded bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/30 hover:bg-accent-emerald/20"
                            >
                              充值
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">
                          {q.lastActiveAt ? new Date(q.lastActiveAt).toLocaleDateString('zh-CN') : '-'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {quotasTotal > pageSize && (
            <Pagination
              page={quotasPage}
              total={quotasTotal}
              pageSize={pageSize}
              onPageChange={setQuotasPage}
            />
          )}
        </div>
      )}
    </div>
  )
}

/** 指标卡片 */
function MetricCard({
  icon: Icon, label, value, subtext, color,
}: {
  icon: typeof TrendingUp
  label: string
  value: number | string
  subtext?: string
  color: 'emerald' | 'amber' | 'blue' | 'violet'
}) {
  const colorMap = {
    emerald: 'text-accent-emerald bg-accent-emerald/10 border-accent-emerald/30',
    amber: 'text-accent-amber bg-accent-amber/10 border-accent-amber/30',
    blue: 'text-accent-blue bg-accent-blue/10 border-accent-blue/30',
    violet: 'text-accent-violet bg-accent-violet/10 border-accent-violet/30',
  }[color]
  return (
    <div className="p-3 rounded-lg bg-bg-elevated border border-border-subtle">
      <div className={`inline-flex items-center justify-center w-7 h-7 rounded mb-2 ${colorMap}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="text-[10px] text-zinc-500 mb-0.5">{label}</div>
      <div className="text-lg font-display font-bold text-zinc-100">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {subtext && <div className="text-[10px] text-zinc-500 mt-0.5">{subtext}</div>}
    </div>
  )
}

/** 分页 */
function Pagination({
  page, total, pageSize, onPageChange,
}: {
  page: number
  total: number
  pageSize: number
  onPageChange: (p: number) => void
}) {
  const totalPages = Math.ceil(total / pageSize)
  return (
    <div className="flex items-center justify-between text-xs text-zinc-400">
      <span>共 {total} 条</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="p-1 rounded hover:bg-bg-hover disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span>{page} / {totalPages}</span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="p-1 rounded hover:bg-bg-hover disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
