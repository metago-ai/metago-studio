import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  User as UserIcon, Mail, Phone, Crown, LogOut,
  Shield, Dna, Activity, Key, Settings, Download, ChevronRight,
  RefreshCw, AlertCircle, Lock, Sparkles, HelpCircle,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useStore } from '../store/useStore'
import { TIER_INFO } from '../lib/proGate'

export function ProfilePage() {
  const { user, signOut, loading } = useAuth()
  const navigate = useNavigate()
  const {
    tier, license, trialDaysRemaining,
    evolutionRecords, decisionLockHistory, privateSkills,
  } = useStore()

  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    if (!confirm('确定退出登录？退出后您的云端数据将不再同步，本地数据保留。')) return
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
    navigate('/')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-accent-emerald animate-spin" />
      </div>
    )
  }

  // 未登录
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-accent-emerald/10 flex items-center justify-center mx-auto mb-4">
            <UserIcon className="w-8 h-8 text-accent-emerald" />
          </div>
          <h2 className="text-lg font-bold text-zinc-100 mb-2">尚未登录</h2>
          <p className="text-sm text-zinc-500 mb-6">登录后可查看您的账户信息、订阅状态和使用记录</p>
          <button onClick={() => navigate('/auth')} className="btn-primary text-sm">
            前往登录
          </button>
        </div>
      </div>
    )
  }

  const displayName = user.displayName || user.email?.split('@')[0] || user.phone || '用户'
  const initial = displayName.charAt(0).toUpperCase()
  const isAnonymous = user.isAnonymous
  const loginTypeLabel = user.loginType === 'EMAIL' ? '邮箱' :
    user.loginType === 'PHONE' ? '手机' :
    user.loginType === 'GITHUB' ? 'GitHub' :
    user.loginType === 'ANONYMOUS' ? '游客' : '未知'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 用户卡片 */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-base p-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-emerald to-accent-teal flex items-center justify-center text-bg-deep font-bold text-2xl flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-zinc-100">{displayName}</h1>
              {isAnonymous ? (
                <span className="px-2 py-0.5 rounded text-xs bg-zinc-700 text-zinc-400">游客</span>
              ) : (
                <span className="px-2 py-0.5 rounded text-xs bg-accent-emerald/20 text-accent-emerald">已认证</span>
              )}
              <span className="px-2 py-0.5 rounded text-xs bg-zinc-700/50 text-zinc-400">{loginTypeLabel}</span>
            </div>
            <div className="mt-2 space-y-1">
              {user.email && (
                <p className="text-sm text-zinc-400 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> {user.email}
                </p>
              )}
              {user.phone && (
                <p className="text-sm text-zinc-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> {user.phone}
                </p>
              )}
              {!user.email && !user.phone && (
                <p className="text-sm text-zinc-500 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  游客模式 · 登录后可同步数据到云端
                </p>
              )}
            </div>
            <p className="text-xs text-zinc-600 mt-2 font-mono">UID: {user.uid.slice(0, 24)}...</p>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="btn-secondary text-sm text-accent-rose hover:bg-accent-rose/10"
          >
            {signingOut ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            退出登录
          </button>
        </div>

        {/* 游客升级提示 */}
        {isAnonymous && (
          <div className="mt-4 p-3 rounded-lg bg-accent-amber/10 border border-accent-amber/30 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-accent-amber flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-zinc-300">您正在以游客身份浏览</p>
              <p className="text-xs text-zinc-500 mt-0.5">登录后可同步数据到云端，在多设备间共享</p>
            </div>
            <button onClick={() => navigate('/auth')} className="btn-primary text-xs">
              去登录
            </button>
          </div>
        )}
      </motion.div>

      {/* 订阅状态 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="card-base p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-accent-amber" />
            <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">订阅状态</h2>
          </div>
          <button
            onClick={() => navigate('/pro')}
            className="text-xs text-accent-emerald hover:underline flex items-center gap-1"
          >
            {tier === 'free' ? '升级 Pro' : '管理订阅'} <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-zinc-500 mb-1">当前档位</div>
            <div className={`font-medium ${tier === 'free' ? 'text-zinc-400' : 'text-accent-emerald'}`}>
              {TIER_INFO[tier].name}
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 mb-1">授权邮箱</div>
            <div className="font-mono text-xs text-zinc-300 truncate">
              {license?.email || user.email || '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 mb-1">授权码</div>
            <div className="font-mono text-xs text-zinc-300 truncate">
              {license?.licenseKey ? `${license.licenseKey.slice(0, 8)}...` : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 mb-1">试用剩余</div>
            <div className={`font-medium ${trialDaysRemaining > 0 ? 'text-accent-amber' : 'text-zinc-400'}`}>
              {trialDaysRemaining > 0 ? `${trialDaysRemaining} 天` : '—'}
            </div>
          </div>
        </div>
      </motion.div>

      {/* 使用统计 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-base p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-accent-emerald" />
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">使用统计</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/evolution')}
            className="bg-bg-elevated/50 rounded-lg p-4 border border-border-subtle hover:border-accent-emerald/30 transition-colors text-left"
          >
            <Dna className="w-5 h-5 text-accent-emerald mb-2" />
            <div className="text-2xl font-bold text-zinc-100">{evolutionRecords.length}</div>
            <div className="text-xs text-zinc-500">进化记录</div>
          </button>
          <button
            onClick={() => navigate('/decision-lock')}
            className="bg-bg-elevated/50 rounded-lg p-4 border border-border-subtle hover:border-accent-emerald/30 transition-colors text-left"
          >
            <Shield className="w-5 h-5 text-accent-teal mb-2" />
            <div className="text-2xl font-bold text-zinc-100">{decisionLockHistory.length}</div>
            <div className="text-xs text-zinc-500">决策锁校验</div>
          </button>
          <button
            onClick={() => navigate('/private-skills')}
            className="bg-bg-elevated/50 rounded-lg p-4 border border-border-subtle hover:border-accent-emerald/30 transition-colors text-left"
          >
            <Lock className="w-5 h-5 text-accent-amber mb-2" />
            <div className="text-2xl font-bold text-zinc-100">{privateSkills.length}</div>
            <div className="text-xs text-zinc-500">私有技能</div>
          </button>
        </div>
      </motion.div>

      {/* 快捷入口 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="card-base p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-accent-emerald" />
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">账号管理</h2>
        </div>
        <div className="space-y-1">
          <QuickLink
            icon={Sparkles}
            label="技能库"
            desc="浏览 MetaGO 全部 26 个技能"
            onClick={() => navigate('/skills')}
          />
          <QuickLink
            icon={Download}
            label="数据导出"
            desc="导出进化档案、决策锁日志等数据"
            onClick={() => navigate('/settings')}
          />
          <QuickLink
            icon={Key}
            label="授权码激活"
            desc="输入授权码激活 Pro 订阅"
            onClick={() => navigate('/pro')}
          />
          <QuickLink
            icon={Shield}
            label="隐私与协议"
            desc="查看用户协议、隐私政策、退款政策"
            onClick={() => navigate('/terms')}
          />
          <QuickLink
            icon={HelpCircle}
            label="帮助中心"
            desc="使用指南、常见问题、联系方式"
            onClick={() => navigate('/help')}
          />
        </div>
      </motion.div>

      {/* 底部信息 */}
      <div className="text-center text-xs text-zinc-600 py-4">
        MetaGO Studio Pro v1.0 · 基于《元构全息智能引擎》V36.5
        <br />
        元构光年（成都）人工智能科技有限公司 © 2026 · 浙ICP备2026062766号
      </div>
    </div>
  )
}

function QuickLink({ icon: Icon, label, desc, onClick }: {
  icon: typeof UserIcon; label: string; desc: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-bg-hover/50 transition-colors text-left"
    >
      <Icon className="w-4 h-4 text-zinc-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-zinc-200">{label}</div>
        <div className="text-xs text-zinc-500">{desc}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
    </button>
  )
}
