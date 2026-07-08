import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Users, Crown, Receipt, Ticket, BarChart3, Search, RefreshCw,
  Ban, CheckCircle2, XCircle, Clock, TrendingUp, DollarSign, Plus, Copy,
  MessageSquare, Send, Shield, AlertTriangle, LogIn, LogOut, Lock, User,
  Cpu, Database, Activity, Zap, Key, FileText, Settings, AlertCircle, GitBranch, Cog,
} from 'lucide-react'
import { callAdminHttp } from '../lib/adminHttp'
import { AgentAdminPanel } from '../components/admin/AgentAdminPanel'
import { DataExplorerPanel } from '../components/admin/DataExplorerPanel'
import { TabErrorBoundary } from '../components/admin/ErrorBoundary'
import {
  PrivateSkillReviewPanel,
  BehaviorBankPanel,
  PlatformConfigPanel,
  ErrorMonitorPanel,
} from '../components/admin/SpecialPanels'

type TabType =
  | 'overview' | 'users' | 'orders' | 'licenses' | 'subscriptions' | 'certify_orders' | 'feedback'
  | 'agent' | 'token_logs' | 'agent_config'
  | 'decision_locks' | 'evolution' | 'behavior_bank' | 'private_skills' | 'byok'
  | 'platform_config' | 'error_monitor' | 'sync_logs'

interface Stats {
  users: { total: number; todayNew: number; todayActive: number; weekActive: number; monthActive: number }
  subscriptions: { pro: number; free: number; conversionRate: string }
  orders: { total: number; paid: number; proPlus: number }
  revenue: { total: number; inYuan: string }
  licenses: { total: number; used: number; available: number }
}

interface UserRow {
  _id: string
  openid: string
  email?: string
  phone?: string
  displayName?: string
  tier: string
  licenseKey?: string
  expiresAt?: string
  createdAt: string
  lastActiveAt?: string
  banned?: boolean
}

interface Order {
  _id: string
  orderId: string
  openid: string
  plan: string
  planName?: string
  amount: number
  status: string
  licenseKey?: string
  createdAt: string
  paidAt?: string
  orderType?: 'subscription' | 'certify' | 'seats'
}

interface License {
  _id: string
  licenseKey: string
  plan: string
  status: string
  expiresAt: string
  note?: string
  createdAt: string
}

interface Feedback {
  _id: string
  openid: string
  type: string
  content: string
  contact?: string
  status: string
  createdAt: string
  reply?: string
}

const ADMIN_TOKEN_KEY = 'metago_admin_token'
const ADMIN_USER_KEY = 'metago_admin_user'

export function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [adminUser, setAdminUser] = useState('')
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [tab, setTab] = useState<TabType>('overview')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(1)
  const [search, setSearch] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [licenses, setLicenses] = useState<License[]>([])
  const [genPlan, setGenPlan] = useState<'pro' | 'team'>('pro')
  const [genCount, setGenCount] = useState(1)
  const [genDays, setGenDays] = useState(30)
  const [genNote, setGenNote] = useState('')
  const [genResult, setGenResult] = useState<{ licenseKey: string; expiresAt: string; plan?: string }[]>([])
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [replyText, setReplyText] = useState<Record<string, string>>({})

  // 检查本地登录状态
  useEffect(() => {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY)
    const user = localStorage.getItem(ADMIN_USER_KEY)
    if (token && user) {
      setLoggedIn(true)
      setAdminUser(user)
    }
  }, [])

  const handleLogin = async () => {
    if (!loginForm.username || !loginForm.password) {
      setLoginError('请输入账号和密码')
      return
    }
    setLoginLoading(true)
    setLoginError('')
    try {
      // 通过 HTTP 直连调用 admin 云函数（绕过 CloudBase SDK 认证）
      const res = await callAdminHttp('login', {
        username: loginForm.username,
        password: loginForm.password,
      })
      if (res.code === 0 && res.data) {
        localStorage.setItem(ADMIN_TOKEN_KEY, res.data.token)
        localStorage.setItem(ADMIN_USER_KEY, res.data.username)
        setLoggedIn(true)
        setAdminUser(res.data.username)
        setLoginForm({ username: '', password: '' })
      } else {
        setLoginError(res.message || '登录失败')
      }
    } catch (e: any) {
      setLoginError(e?.message || '网络错误，请重试')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY)
    localStorage.removeItem(ADMIN_USER_KEY)
    setLoggedIn(false)
    setAdminUser('')
    setStats(null)
  }

  const adminCall = useCallback(async (action: string, params: Record<string, unknown> = {}) => {
    return callAdminHttp(action, params)
  }, [])

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminCall('getStats')
      if (res.code === 0) {
        setStats(res.data)
      } else if (res.code === 401) {
        handleLogout()
      } else {
        setError(res.message || '加载失败')
      }
    } catch (e: any) {
      setError(e?.message || '网络错误')
    } finally {
      setLoading(false)
    }
  }, [adminCall])

  useEffect(() => {
    if (loggedIn) loadStats()
  }, [loggedIn, loadStats])

  const loadUsers = async (page = 1) => {
    setLoading(true)
    try {
      const res = await adminCall('listUsers', { page, pageSize: 20, search })
      if (res.code === 0) {
        setUsers(res.data.users)
        setUsersTotal(res.data.total)
        setUsersPage(page)
      } else if (res.code === 401) {
        handleLogout()
      }
    } finally {
      setLoading(false)
    }
  }

  const loadOrders = async () => {
    setLoading(true)
    try {
      const res = await adminCall('listOrders', { page: 1, pageSize: 50 })
      if (res.code === 0) {
        setOrders(res.data.orders)
        setOrdersTotal(res.data.total)
      } else if (res.code === 401) {
        handleLogout()
      }
    } finally {
      setLoading(false)
    }
  }

  const loadLicenses = async () => {
    setLoading(true)
    try {
      const res = await adminCall('listLicenses', { page: 1, pageSize: 50 })
      if (res.code === 0) {
        setLicenses(res.data.licenses)
      } else if (res.code === 401) {
        handleLogout()
      }
    } finally {
      setLoading(false)
    }
  }

  const loadFeedback = async () => {
    setLoading(true)
    try {
      const res = await adminCall('listFeedback', { page: 1, pageSize: 50 })
      if (res.code === 0) {
        setFeedback(res.data.feedback)
      } else if (res.code === 401) {
        handleLogout()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (newTab: TabType) => {
    setTab(newTab)
    setError('')
    if (newTab === 'overview') loadStats()
    else if (newTab === 'users') loadUsers(1)
    else if (newTab === 'orders') loadOrders()
    else if (newTab === 'licenses') loadLicenses()
    else if (newTab === 'feedback') loadFeedback()
  }

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleBanUser = async (targetId: string, banned: boolean) => {
    if (!confirm(banned ? '确认封禁该用户？封禁后该用户将无法登录和使用。' : '确认解封该用户？')) return
    setLoading(true)
    try {
      const res = await adminCall('banUser', { targetId, banned })
      if (res.code !== 0) {
        showToast(res.message || '操作失败', 'error')
      } else {
        showToast(banned ? '已封禁用户' : '已解封用户')
        await loadUsers(usersPage)
      }
    } catch (e: any) {
      showToast(e?.message || '网络错误', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleResetQuota = async (targetId: string) => {
    if (!confirm('确认重置该用户的 Token 配额？这将把已用配额清零。')) return
    setLoading(true)
    try {
      const res = await adminCall('resetUserQuota', { targetId })
      if (res.code !== 0) {
        showToast(res.message || '操作失败', 'error')
      } else {
        showToast('配额已重置')
      }
    } catch (e: any) {
      showToast(e?.message || '网络错误', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateTier = async (targetId: string, tier: string) => {
    if (!confirm(`确认将该用户套餐修改为 ${tier}？`)) return
    setLoading(true)
    try {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const res = await adminCall('updateUserTier', { targetId, tier, expiresAt })
      if (res.code !== 0) {
        showToast(res.message || '操作失败', 'error')
      } else {
        showToast(`已修改为 ${tier} 套餐`)
        await loadUsers(usersPage)
      }
    } catch (e: any) {
      showToast(e?.message || '网络错误', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm(`确认取消订单 ${orderId}？`)) return
    setLoading(true)
    try {
      const res = await adminCall('cancelOrder', { orderId })
      if (res.code !== 0) {
        showToast(res.message || '操作失败', 'error')
      } else {
        showToast('订单已取消')
        await loadOrders()
      }
    } catch (e: any) {
      showToast(e?.message || '网络错误', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkOrderPaid = async (orderId: string) => {
    if (!confirm(`确认将订单 ${orderId} 标记为已付款？这将立即激活对应套餐。`)) return
    setLoading(true)
    try {
      const res = await adminCall('markOrderPaid', { orderId })
      if (res.code !== 0) {
        showToast(res.message || '操作失败', 'error')
      } else {
        showToast('订单已标记为已付')
        await loadOrders()
      }
    } catch (e: any) {
      showToast(e?.message || '网络错误', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeLicense = async (key: string) => {
    if (!confirm('确认作废此授权码？已绑定的用户将被降级为免费版。')) return
    setLoading(true)
    try {
      await adminCall('revokeLicense', { licenseKey: key })
      await loadLicenses()
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateLicense = async () => {
    setLoading(true)
    setGenResult([])
    try {
      const res = await adminCall('generateLicense', {
        plan: genPlan,
        count: genCount,
        durationDays: genDays,
        note: genNote,
      })
      if (res.code === 0 && res.data?.licenses) {
        setGenResult(res.data.licenses)
        await loadLicenses()
      } else {
        setError(res.message || '生成失败')
      }
    } catch (e: any) {
      setError(e?.message || '网络错误')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
  }

  const handleReplyFeedback = async (id: string) => {
    const reply = replyText[id]
    if (!reply?.trim()) return
    setLoading(true)
    try {
      await adminCall('replyFeedback', { feedbackId: id, reply })
      setReplyText({ ...replyText, [id]: '' })
      await loadFeedback()
    } finally {
      setLoading(false)
    }
  }

  // ========== 登录界面 ==========
  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-atmosphere flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-accent-emerald/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-accent-emerald" />
            </div>
            <h1 className="text-xl font-bold text-zinc-100">运营管理后台</h1>
            <p className="text-sm text-zinc-500 mt-1">MetaGO Studio Admin Console</p>
          </div>

          <div className="card-base p-6 space-y-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 flex items-center gap-1">
                <User className="w-3 h-3" />
                管理员账号
              </label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="请输入账号"
                className="input-base w-full"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1.5 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                密码
              </label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="请输入密码"
                className="input-base w-full"
                autoComplete="current-password"
              />
            </div>

            {loginError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {loginError}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loginLoading}
              className="btn-primary w-full text-sm disabled:opacity-50"
            >
              {loginLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  登录中...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  登录管理后台
                </>
              )}
            </button>
          </div>

          <p className="text-center text-xs text-zinc-600 mt-6">
            仅限MetaGO运营团队使用 · 登录后本次会话有效，请妥善保管
          </p>
        </div>
      </div>
    )
  }

  // ========== 加载中 ==========
  if (loading && !stats && tab === 'overview') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-6 h-6 text-accent-emerald animate-spin mx-auto mb-3" />
          <p className="text-sm text-zinc-500">正在加载数据...</p>
        </div>
      </div>
    )
  }

  const tabGroups: { group: string; items: { id: TabType; label: string; icon: typeof BarChart3 }[] }[] = [
    {
      group: '商业运营',
      items: [
        { id: 'overview', label: '总览', icon: BarChart3 },
        { id: 'users', label: '用户管理', icon: Users },
        { id: 'orders', label: '订单管理', icon: Receipt },
        { id: 'licenses', label: '授权码', icon: Ticket },
        { id: 'subscriptions', label: '订阅记录', icon: Crown },
        { id: 'certify_orders', label: '认证订单', icon: CheckCircle2 },
        { id: 'feedback', label: '用户反馈', icon: MessageSquare },
      ],
    },
    {
      group: 'Agent 业务',
      items: [
        { id: 'agent', label: 'Agent 管理', icon: Cpu },
        { id: 'token_logs', label: 'Token 日志', icon: Activity },
        { id: 'agent_config', label: '智能体配置', icon: Cog },
      ],
    },
    {
      group: '元构特色',
      items: [
        { id: 'decision_locks', label: '决策锁审计', icon: Lock },
        { id: 'evolution', label: '进化记录', icon: GitBranch },
        { id: 'behavior_bank', label: '行为银行', icon: Zap },
        { id: 'private_skills', label: '私有技能审核', icon: FileText },
        { id: 'byok', label: 'BYOK 绑定', icon: Key },
      ],
    },
    {
      group: '平台治理',
      items: [
        { id: 'platform_config', label: '平台配置', icon: Settings },
        { id: 'error_monitor', label: '错误监控', icon: AlertCircle },
        { id: 'sync_logs', label: '同步日志', icon: Database },
      ],
    },
  ]

  const currentTabLabel = tabGroups.flatMap(g => g.items).find(i => i.id === tab)?.label || tab

  // ========== 管理后台主界面 ==========
  return (
    <div className="min-h-screen bg-atmosphere p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-accent-emerald" />
            运营管理后台
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            MetaGO Studio Admin Console · 当前账号: <span className="text-accent-emerald">{adminUser}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleTabChange(tab)} className="btn-secondary text-sm">
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
          <button onClick={handleLogout} className="btn-secondary text-sm text-red-400">
            <LogOut className="w-4 h-4" />
            退出
          </button>
        </div>
      </div>

      {/* 主内容：侧边栏 + 右侧 */}
      <div className="flex gap-4">
        {/* 侧边栏 */}
        <aside className="w-56 flex-shrink-0 space-y-4">
          {tabGroups.map(group => (
            <div key={group.group}>
              <div className="text-xs text-zinc-500 mb-1 px-2 uppercase tracking-wider">{group.group}</div>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTabChange(item.id)}
                      className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors ${
                        tab === item.id ? 'bg-accent-emerald/20 text-accent-emerald' : 'text-zinc-400 hover:text-zinc-200 hover:bg-bg-hover/30'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </aside>

        {/* 右侧主内容 */}
        <div className="flex-1 min-w-0 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-sm text-red-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

      <TabErrorBoundary tabLabel={currentTabLabel}>
      {/* Overview */}
      {tab === 'overview' && stats && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBox icon={Users} label="总用户数" value={stats.users.total} sub={`今日新增 ${stats.users.todayNew}`} accent="emerald" />
            <StatBox icon={Crown} label="Pro订阅" value={stats.subscriptions.pro} sub={`转化率 ${stats.subscriptions.conversionRate}%`} accent="amber" />
            <StatBox icon={DollarSign} label="总收入" value={`¥${stats.revenue.inYuan}`} sub={`${stats.orders.paid} 笔付费`} accent="teal" />
            <StatBox icon={TrendingUp} label="DAU" value={stats.users.todayActive} sub={`MAU ${stats.users.monthActive}`} accent="blue" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="card-base p-5">
              <h3 className="text-sm font-semibold text-zinc-200 mb-4">订阅分布</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Pro付费用户</span>
                  <span className="text-sm font-bold text-accent-amber">{stats.subscriptions.pro}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">免费用户</span>
                  <span className="text-sm font-bold text-zinc-300">{stats.subscriptions.free}</span>
                </div>
              </div>
            </div>

            <div className="card-base p-5">
              <h3 className="text-sm font-semibold text-zinc-200 mb-4">订单统计</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">总订单</span>
                  <span className="text-sm font-bold text-zinc-300">{stats.orders.total}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">付费订单</span>
                  <span className="text-sm font-bold text-accent-emerald">{stats.orders.paid}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Pro+ 订单</span>
                  <span className="text-sm font-bold text-accent-violet">{stats.orders.proPlus}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card-base p-5">
            <h3 className="text-sm font-semibold text-zinc-200 mb-4">授权码</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-zinc-100">{stats.licenses.total}</div>
                <div className="text-xs text-zinc-500">总授权码</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent-emerald">{stats.licenses.used}</div>
                <div className="text-xs text-zinc-500">已使用</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent-amber">{stats.licenses.available}</div>
                <div className="text-xs text-zinc-500">可用</div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadUsers(1)}
              placeholder="搜索 openid / 邮箱 / 手机号 / 昵称"
              className="input-base flex-1"
            />
            <button onClick={() => loadUsers(1)} className="btn-primary text-sm">
              <Search className="w-4 h-4" />
              搜索
            </button>
          </div>

          <div className="card-base overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-elevated/50">
                <tr className="text-left text-xs text-zinc-500">
                  <th className="px-4 py-3">用户</th>
                  <th className="px-4 py-3">订阅</th>
                  <th className="px-4 py-3">到期时间</th>
                  <th className="px-4 py-3">注册时间</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <p className="text-zinc-500 text-sm mb-2">暂无用户数据</p>
                      <p className="text-zinc-600 text-xs">
                        用户数据在用户登录 Studio 时自动同步。已注册用户需重新登录一次即可在此显示。
                      </p>
                    </td>
                  </tr>
                ) : users.map(u => (
                  <tr key={u._id} className="border-t border-border-subtle hover:bg-bg-hover/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-200">{u.displayName || '未设置'}</div>
                      <div className="text-xs text-zinc-500">{u.email || u.phone || (u.openid ? u.openid.slice(0, 16) + '...' : '未知用户')}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        u.tier === 'pro' ? 'bg-accent-emerald/20 text-accent-emerald'
                        : u.tier === 'pro_plus' ? 'bg-accent-violet/20 text-accent-violet'
                        : u.tier === 'team' ? 'bg-accent-teal/20 text-accent-teal'
                        : u.tier === 'enterprise' ? 'bg-accent-amber/20 text-accent-amber'
                        : 'bg-zinc-700 text-zinc-400'
                      }`}>
                        {u.tier === 'pro' ? 'Pro' : u.tier === 'pro_plus' ? 'Pro+' : u.tier === 'team' ? 'Team' : u.tier === 'enterprise' ? 'Enterprise' : 'Free'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {u.expiresAt ? new Date(u.expiresAt).toLocaleDateString('zh-CN') : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('zh-CN') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {u.banned ? (
                        <span className="text-xs text-red-400">已封禁</span>
                      ) : (
                        <span className="text-xs text-accent-emerald">正常</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleBanUser(u._id, !u.banned)}
                          className={`text-xs px-2 py-1 rounded ${
                            u.banned ? 'text-accent-emerald hover:bg-accent-emerald/10' : 'text-red-400 hover:bg-red-500/10'
                          }`}
                        >
                          {u.banned ? '解封' : '封禁'}
                        </button>
                        <button
                          onClick={() => handleResetQuota(u._id)}
                          className="text-xs px-2 py-1 rounded text-accent-blue hover:bg-accent-blue/10"
                          title="重置 Token 配额"
                        >
                          重置配额
                        </button>
                        <button
                          onClick={() => {
                            const tier = prompt('输入新套餐（free / pro / pro_plus / team / enterprise）：', u.tier || 'free')
                            if (tier && ['free', 'pro', 'pro_plus', 'team', 'enterprise'].includes(tier)) {
                              handleUpdateTier(u._id, tier)
                            } else if (tier) {
                              alert('无效套餐，请输入：free / pro / pro_plus / team / enterprise')
                            }
                          }}
                          className="text-xs px-2 py-1 rounded text-accent-amber hover:bg-accent-amber/10"
                          title="修改用户套餐"
                        >
                          改套餐
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {usersTotal > 20 && (
            <div className="flex items-center justify-between text-sm text-zinc-500">
              <span>共 {usersTotal} 条，第 {usersPage} 页</span>
              <div className="flex gap-2">
                <button
                  disabled={usersPage <= 1}
                  onClick={() => loadUsers(usersPage - 1)}
                  className="btn-secondary text-xs disabled:opacity-30"
                >上一页</button>
                <button
                  disabled={usersPage * 20 >= usersTotal}
                  onClick={() => loadUsers(usersPage + 1)}
                  className="btn-secondary text-xs disabled:opacity-30"
                >下一页</button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Orders */}
      {tab === 'orders' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="card-base overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-elevated/50">
                <tr className="text-left text-xs text-zinc-500">
                  <th className="px-4 py-3">订单号</th>
                  <th className="px-4 py-3">用户</th>
                  <th className="px-4 py-3">套餐</th>
                  <th className="px-4 py-3">金额</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">时间</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-zinc-600">暂无订单</td></tr>
                ) : orders.map(o => (
                  <tr key={o._id} className="border-t border-border-subtle">
                    <td className="px-4 py-3 text-xs text-zinc-400 font-mono">{o.orderId}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{o.openid ? o.openid.slice(0, 12) + '...' : '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs">
                        {o.planName || (o.plan === 'monthly' ? '月度' : o.plan === 'yearly' ? '年度' : o.plan === 'pro_plus' ? 'Pro+ 月度' : o.plan === 'pro_plus_year' ? 'Pro+ 年度' : o.plan === 'team' ? 'Team 月度' : o.plan === 'team_year' ? 'Team 年度' : o.plan === 'enterprise' ? 'Enterprise 年度' : o.orderType === 'certify' ? 'Certify 认证' : o.orderType === 'seats' ? 'Enterprise 加席' : o.plan)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {o.amount > 0 ? `¥${(o.amount / 100).toFixed(2)}` : '免费'}
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {o.createdAt ? new Date(o.createdAt).toLocaleString('zh-CN') : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {o.status === 'pending' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleMarkOrderPaid(o.orderId)}
                            className="text-xs px-2 py-1 rounded text-accent-emerald hover:bg-accent-emerald/10"
                          >
                            标记已付
                          </button>
                          <button
                            onClick={() => handleCancelOrder(o.orderId)}
                            className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-500/10"
                          >
                            取消
                          </button>
                        </div>
                      )}
                      {o.status !== 'pending' && (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-600">共 {ordersTotal} 条订单 · 仅 pending 状态订单可操作</p>
        </motion.div>
      )}

      {/* Licenses */}
      {tab === 'licenses' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* 生成授权码 */}
          <div className="card-base p-5 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <Plus className="w-4 h-4 text-accent-emerald" />
              生成授权码
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">套餐</label>
                <select
                  value={genPlan}
                  onChange={(e) => setGenPlan(e.target.value as 'pro' | 'team')}
                  className="input-base text-sm"
                >
                  <option value="pro">Pro 个人版</option>
                  <option value="team">Team 团队版</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">数量</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={genCount}
                  onChange={(e) => setGenCount(Math.max(1, Math.min(50, Number(e.target.value))))}
                  className="input-base text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">有效期（天）</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={genDays}
                  onChange={(e) => setGenDays(Math.max(1, Math.min(365, Number(e.target.value))))}
                  className="input-base text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">备注</label>
                <input
                  type="text"
                  value={genNote}
                  onChange={(e) => setGenNote(e.target.value)}
                  placeholder="选填，如：合作伙伴"
                  className="input-base text-sm"
                />
              </div>
            </div>
            <button
              onClick={handleGenerateLicense}
              disabled={loading}
              className="btn-primary text-sm"
            >
              <Plus className="w-4 h-4" />
              生成 {genCount} 个{genPlan === 'team' ? 'Team' : 'Pro'}授权码
            </button>
            {genResult.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-accent-emerald">生成成功！点击右侧复制按钮可复制授权码：</p>
                {genResult.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 bg-bg-elevated/50 rounded px-3 py-2">
                    <code className="text-xs font-mono text-accent-emerald flex-1">{l.licenseKey}</code>
                    <span className="text-xs text-zinc-500">有效期至 {new Date(l.expiresAt).toLocaleDateString('zh-CN')}</span>
                    <button
                      onClick={() => copyToClipboard(l.licenseKey)}
                      className="text-zinc-400 hover:text-accent-emerald p-1 rounded hover:bg-bg-hover"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card-base overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-elevated/50">
                <tr className="text-left text-xs text-zinc-500">
                  <th className="px-4 py-3">授权码</th>
                  <th className="px-4 py-3">套餐</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">到期时间</th>
                  <th className="px-4 py-3">备注</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {licenses.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-zinc-600">暂无授权码</td></tr>
                ) : licenses.map(l => (
                  <tr key={l._id} className="border-t border-border-subtle">
                    <td className="px-4 py-3 text-xs font-mono text-accent-emerald">{l.licenseKey}</td>
                    <td className="px-4 py-3 text-xs">
                      {l.plan === 'pro' ? 'Pro' : l.plan === 'team' ? 'Team' : l.plan === 'monthly' ? '月度' : l.plan === 'yearly' ? '年度' : l.plan || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <LicenseStatusBadge status={l.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {new Date(l.expiresAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{l.note || '—'}</td>
                    <td className="px-4 py-3">
                      {l.status === 'unused' && (
                        <button
                          onClick={() => handleRevokeLicense(l.licenseKey)}
                          className="text-xs text-red-400 hover:bg-red-500/10 px-2 py-1 rounded"
                        >作废</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Feedback */}
      {tab === 'feedback' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {feedback.length === 0 ? (
            <div className="card-base p-12 text-center">
              <MessageSquare className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">暂无用户反馈</p>
            </div>
          ) : feedback.map(f => (
            <div key={f._id} className="card-base p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs text-zinc-500">{f.type}</span>
                  <p className="text-sm text-zinc-200 mt-1">{f.content}</p>
                  {f.contact && <p className="text-xs text-zinc-600 mt-1">联系方式: {f.contact}</p>}
                </div>
                <span className="text-xs text-zinc-600 flex-shrink-0">
                  {new Date(f.createdAt).toLocaleString('zh-CN')}
                </span>
              </div>
              {f.reply && (
                <div className="pl-4 border-l-2 border-accent-emerald/30">
                  <p className="text-xs text-zinc-500 mb-1">管理员回复:</p>
                  <p className="text-sm text-zinc-300">{f.reply}</p>
                </div>
              )}
              {f.status !== 'replied' && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyText[f._id] || ''}
                    onChange={(e) => setReplyText({ ...replyText, [f._id]: e.target.value })}
                    placeholder="输入回复..."
                    className="input-base flex-1 text-sm"
                  />
                  <button
                    onClick={() => handleReplyFeedback(f._id)}
                    className="btn-primary text-sm"
                  >
                    <Send className="w-4 h-4" />
                    回复
                  </button>
                </div>
              )}
            </div>
          ))}
        </motion.div>
      )}

      {/* Agent 管理 */}
      {tab === 'agent' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg bg-bg-elevated border border-border-subtle"
        >
          <AgentAdminPanel />
        </motion.div>
      )}

      {/* 订阅记录 */}
      {tab === 'subscriptions' && (
        <DataExplorerPanel config={{
          title: '订阅记录',
          collection: 'subscriptions',
          columns: [
            { field: 'openid', label: '用户', type: 'code', width: '140px' },
            { field: 'plan', label: '套餐', type: 'badge', width: '100px', badgeMap: {
              pro: { label: 'Pro', className: 'bg-accent-emerald/20 text-accent-emerald' },
              pro_plus: { label: 'Pro+', className: 'bg-accent-violet/20 text-accent-violet' },
              team: { label: 'Team', className: 'bg-accent-teal/20 text-accent-teal' },
              enterprise: { label: 'Enterprise', className: 'bg-accent-amber/20 text-accent-amber' },
            } },
            { field: 'status', label: '状态', type: 'badge', width: '100px', badgeMap: {
              active: { label: '生效中', className: 'bg-accent-emerald/20 text-accent-emerald' },
              expired: { label: '已过期', className: 'bg-zinc-500/20 text-zinc-400' },
              cancelled: { label: '已取消', className: 'bg-red-500/20 text-red-400' },
            } },
            { field: 'startedAt', label: '开始时间', type: 'date', width: '160px' },
            { field: 'expiresAt', label: '到期时间', type: 'date', width: '160px' },
            { field: 'amount', label: '金额(分)', type: 'number', width: '90px' },
          ],
          searchFields: ['openid', 'plan'],
          searchPlaceholder: '搜索 openid / 套餐',
        }} />
      )}

      {/* 认证订单 */}
      {tab === 'certify_orders' && (
        <DataExplorerPanel config={{
          title: '认证订单',
          collection: 'certify_orders',
          columns: [
            { field: 'orderId', label: '订单号', type: 'code', width: '160px' },
            { field: 'openid', label: '用户', type: 'code', width: '140px' },
            { field: 'certifyType', label: '认证类型', type: 'text', width: '120px' },
            { field: 'amount', label: '金额(分)', type: 'number', width: '90px' },
            { field: 'status', label: '状态', type: 'badge', width: '100px', badgeMap: {
              paid: { label: '已支付', className: 'bg-accent-emerald/20 text-accent-emerald' },
              pending: { label: '待支付', className: 'bg-amber-500/20 text-amber-400' },
              failed: { label: '失败', className: 'bg-red-500/20 text-red-400' },
              refunded: { label: '已退款', className: 'bg-zinc-500/20 text-zinc-400' },
            } },
            { field: 'createdAt', label: '创建时间', type: 'date', width: '160px' },
            { field: 'paidAt', label: '支付时间', type: 'date', width: '160px' },
          ],
          searchFields: ['orderId', 'openid', 'certifyType'],
          searchPlaceholder: '搜索订单号 / openid / 认证类型',
        }} />
      )}

      {/* Token 用量日志 */}
      {tab === 'token_logs' && (
        <DataExplorerPanel config={{
          title: 'Token 用量日志',
          collection: 'token_usage_logs',
          columns: [
            { field: 'openid', label: '用户', type: 'code', width: '140px' },
            { field: 'model', label: '模型', type: 'text', width: '140px' },
            { field: 'tokensIn', label: '输入 Tokens', type: 'number', width: '110px' },
            { field: 'tokensOut', label: '输出 Tokens', type: 'number', width: '110px' },
            { field: 'tokensTotal', label: '总计', type: 'number', width: '90px' },
            { field: 'createdAt', label: '时间', type: 'date', width: '160px' },
          ],
          searchFields: ['openid', 'model'],
          searchPlaceholder: '搜索 openid / 模型',
        }} />
      )}

      {/* 智能体配置 */}
      {tab === 'agent_config' && (
        <div className="space-y-4">
          <div className="card-base p-6">
            <h3 className="text-sm font-semibold text-zinc-200 mb-2 flex items-center gap-2">
              <Cog className="w-4 h-4 text-accent-emerald" />
              智能体配置说明
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              智能体配置是用户在 Studio 工作台中个性化设置的 Agent 参数。大部分配置存储在用户浏览器本地（localStorage），
              仅 BYOK 绑定已实现云端同步。以下为各配置项的管理方式说明。
            </p>

            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-bg-deep border border-border-subtle">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-bold text-zinc-200">系统提示词（System Prompt）</div>
                    <div className="text-xs text-zinc-500 mt-1">用户自定义的 Agent 系统提示词，决定 AI 的角色和行为</div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-zinc-700 text-zinc-400">用户本地管理</span>
                </div>
                <div className="text-xs text-zinc-600">存储位置：浏览器 localStorage · 用户可在 Studio 设置页修改</div>
              </div>

              <div className="p-4 rounded-lg bg-bg-deep border border-border-subtle">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-bold text-zinc-200">模型参数</div>
                    <div className="text-xs text-zinc-500 mt-1">温度（Temperature）、Top P、Max Tokens 等生成参数</div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-zinc-700 text-zinc-400">用户本地管理</span>
                </div>
                <div className="text-xs text-zinc-600">存储位置：浏览器 localStorage · 用户可在 Studio 设置页修改</div>
              </div>

              <div className="p-4 rounded-lg bg-bg-deep border border-border-subtle">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-bold text-zinc-200">MCP Server 配置</div>
                    <div className="text-xs text-zinc-500 mt-1">stdio / sse 端点配置，连接外部 MCP 工具服务器</div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-zinc-700 text-zinc-400">用户本地管理</span>
                </div>
                <div className="text-xs text-zinc-600">存储位置：浏览器 localStorage · 用户可在 Studio 设置页修改</div>
              </div>

              <div className="p-4 rounded-lg bg-bg-deep border border-border-subtle">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-bold text-zinc-200">工具启用开关</div>
                    <div className="text-xs text-zinc-500 mt-1">42 个内置工具的启用/禁用开关</div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-zinc-700 text-zinc-400">用户本地管理</span>
                </div>
                <div className="text-xs text-zinc-600">存储位置：浏览器 localStorage · 用户可在 Studio 设置页修改</div>
              </div>

              <div className="p-4 rounded-lg bg-accent-emerald/5 border border-accent-emerald/30">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-bold text-zinc-200">BYOK 绑定（自带 API Key）</div>
                    <div className="text-xs text-zinc-500 mt-1">用户绑定的自有 AI 供应商 API Key（OpenAI / DeepSeek / 通义等）</div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-accent-emerald/20 text-accent-emerald">云端同步</span>
                </div>
                <div className="text-xs text-zinc-600 mb-2">存储位置：byok_bindings 集合 · 管理员可在 BYOK 绑定 Tab 强制解绑</div>
                <button
                  onClick={() => handleTabChange('byok')}
                  className="text-xs px-3 py-1 rounded bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/30 hover:bg-accent-emerald/20"
                >
                  前往 BYOK 绑定管理 →
                </button>
              </div>

              <div className="p-4 rounded-lg bg-bg-deep border border-border-subtle">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-bold text-zinc-200">Hooks 配置</div>
                    <div className="text-xs text-zinc-500 mt-1">工具执行前后的钩子脚本配置</div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-zinc-700 text-zinc-400">用户本地管理</span>
                </div>
                <div className="text-xs text-zinc-600">存储位置：浏览器 localStorage · 用户可在 Studio 设置页修改</div>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-accent-amber/10 border border-accent-amber/30 text-xs text-accent-amber">
              <strong>说明：</strong>标记为"用户本地管理"的配置项存储在用户浏览器中，管理员无法集中查看或修改。
              如需实现多端同步和集中管理，需将配置迁移到 <code className="text-accent-amber">agent_configs</code> 集合（已列入产品路线图）。
            </div>
          </div>
        </div>
      )}

      {/* 决策锁审计 */}
      {tab === 'decision_locks' && (
        <DataExplorerPanel config={{
          title: '决策锁审计',
          collection: 'decision_locks',
          columns: [
            { field: 'timestamp', label: '时间', type: 'date', width: '160px' },
            { field: 'input', label: '输入摘要', type: 'truncate', truncateLength: 60 },
            { field: 'passed', label: '通过', type: 'boolean', width: '60px' },
            { field: 'hardMode', label: '模式', type: 'badge', width: '80px', badgeMap: {
              true: { label: '硬校验', className: 'bg-red-500/20 text-red-400' },
              false: { label: '软校验', className: 'bg-zinc-500/20 text-zinc-400' },
            } },
            { field: 'blockedReason', label: '阻断原因', type: 'truncate', truncateLength: 50 },
            { field: 'totalDurationMs', label: '耗时(ms)', type: 'number', width: '90px' },
          ],
          searchFields: ['input', 'blockedReason'],
          searchPlaceholder: '搜索输入 / 阻断原因',
        }} />
      )}

      {/* 进化记录 */}
      {tab === 'evolution' && (
        <DataExplorerPanel config={{
          title: '进化记录',
          collection: 'evolution_records',
          columns: [
            { field: 'timestamp', label: '时间', type: 'date', width: '160px' },
            { field: 'trigger', label: '触发', type: 'truncate', truncateLength: 40 },
            { field: 'boundary', label: '边界感知', type: 'truncate', truncateLength: 40 },
            { field: 'gap', label: '差距分析', type: 'truncate', truncateLength: 40 },
            { field: 'verified', label: '已验证', type: 'boolean', width: '70px' },
            { field: 'recursed', label: '已递归', type: 'boolean', width: '70px' },
            { field: 'depth', label: '深度', type: 'number', width: '60px' },
            { field: 'durationMs', label: '耗时(ms)', type: 'number', width: '90px' },
          ],
          searchFields: ['trigger', 'boundary', 'gap'],
          searchPlaceholder: '搜索触发 / 边界 / 差距',
        }} />
      )}

      {/* 行为银行 */}
      {tab === 'behavior_bank' && <BehaviorBankPanel />}

      {/* 私有技能审核 */}
      {tab === 'private_skills' && <PrivateSkillReviewPanel />}

      {/* BYOK 绑定 */}
      {tab === 'byok' && (
        <DataExplorerPanel config={{
          title: 'BYOK 绑定',
          collection: 'byok_bindings',
          columns: [
            { field: 'openid', label: '用户', type: 'code', width: '140px' },
            { field: 'provider', label: '供应商', type: 'text', width: '100px' },
            { field: 'baseUrl', label: 'Base URL', type: 'truncate', truncateLength: 40 },
            { field: 'model', label: '模型', type: 'text', width: '140px' },
            { field: 'active', label: '生效中', type: 'boolean', width: '70px' },
            { field: 'boundAt', label: '绑定时间', type: 'date', width: '160px' },
          ],
          searchFields: ['openid', 'provider', 'model'],
          searchPlaceholder: '搜索 openid / 供应商 / 模型',
          rowActions: [{
            label: '强制解绑',
            onClick: async (row) => {
              const res = await callAdminHttp('unbindByok', { openid: row.openid })
              if (res.code !== 0) alert(res.message || '解绑失败')
            },
            className: 'text-red-400 hover:bg-red-500/10',
            confirm: '确认强制解绑该用户的 BYOK？',
            show: (row) => row.active !== false,
          }],
        }} />
      )}

      {/* 平台配置 */}
      {tab === 'platform_config' && <PlatformConfigPanel />}

      {/* 错误监控 */}
      {tab === 'error_monitor' && <ErrorMonitorPanel />}

      {/* 同步日志 */}
      {tab === 'sync_logs' && (
        <DataExplorerPanel config={{
          title: '同步日志',
          collection: 'sync_logs',
          columns: [
            { field: 'createdAt', label: '时间', type: 'date', width: '160px' },
            { field: 'openid', label: '用户', type: 'code', width: '140px' },
            { field: 'action', label: '操作', type: 'text', width: '140px' },
            { field: 'collection', label: '集合', type: 'text', width: '140px' },
            { field: 'status', label: '状态', type: 'badge', width: '100px', badgeMap: {
              success: { label: '成功', className: 'bg-accent-emerald/20 text-accent-emerald' },
              failed: { label: '失败', className: 'bg-red-500/20 text-red-400' },
              pending: { label: '进行中', className: 'bg-amber-500/20 text-amber-400' },
            } },
            { field: 'durationMs', label: '耗时(ms)', type: 'number', width: '90px' },
          ],
          searchFields: ['openid', 'action', 'collection'],
          searchPlaceholder: '搜索 openid / 操作 / 集合',
        }} />
      )}

      </TabErrorBoundary>

        </div>{/* 关闭右侧主内容 */}
      </div>{/* 关闭 flex 容器 */}

      {/* Toast 操作反馈 */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg border ${
          toast.type === 'success'
            ? 'bg-accent-emerald/10 border-accent-emerald/30 text-accent-emerald'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          <span className="text-sm font-medium">{toast.msg}</span>
        </div>
      )}

      {/* ICP 备案 */}
      <footer className="text-center py-4 border-t border-border-subtle">
        <a
          href="https://beian.miit.gov.cn"
          target="_blank"
          rel="noreferrer"
          className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          蜀ICP备2026035958号
        </a>
      </footer>
    </div>
  )
}

function StatBox({ icon: Icon, label, value, sub, accent }: {
  icon: typeof Users; label: string; value: string | number; sub: string; accent: string
}) {
  const colors: Record<string, string> = {
    emerald: 'text-accent-emerald bg-accent-emerald/10',
    amber: 'text-accent-amber bg-accent-amber/10',
    teal: 'text-accent-teal bg-accent-teal/10',
    blue: 'text-accent-blue bg-accent-blue/10',
  }
  return (
    <div className="card-base p-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colors[accent]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-2xl font-bold text-zinc-100">{value}</div>
      <div className="text-sm text-zinc-400 mt-1">{label}</div>
      <div className="text-xs text-zinc-600 mt-1">{sub}</div>
    </div>
  )
}

function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
    completed: { icon: CheckCircle2, color: 'text-accent-emerald', label: '已完成' },
    pending: { icon: Clock, color: 'text-accent-amber', label: '待支付' },
    failed: { icon: XCircle, color: 'text-red-400', label: '失败' },
    refunded: { icon: Ban, color: 'text-zinc-400', label: '已退款' },
  }
  const s = map[status] || { icon: Clock, color: 'text-zinc-400', label: status }
  const Icon = s.icon
  return (
    <span className={`text-xs flex items-center gap-1 ${s.color}`}>
      <Icon className="w-3 h-3" />
      {s.label}
    </span>
  )
}

function LicenseStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    unused: 'text-accent-emerald',
    used: 'text-accent-amber',
    revoked: 'text-red-400',
    expired: 'text-zinc-500',
  }
  const labels: Record<string, string> = {
    unused: '未使用',
    used: '已使用',
    revoked: '已作废',
    expired: '已过期',
  }
  return <span className={`text-xs ${map[status] || 'text-zinc-400'}`}>{labels[status] || status}</span>
}
