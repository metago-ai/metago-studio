import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Crown, Sparkles, Zap, Building2, Users, ArrowRight } from 'lucide-react'
import { useStore } from '../store/useStore'
import { TIER_INFO } from '../lib/proGate'

export function ProUpgradePage() {
  const { tier, trialDaysRemaining, license, startTrialAction, activateProAction, deactivate } = useStore()
  const [email, setEmail] = useState('')
  const [licenseKey, setLicenseKey] = useState('')
  const [mode, setMode] = useState<'trial' | 'activate'>('trial')
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  const plans = [
    {
      id: 'free' as const,
      icon: Sparkles,
      name: '社区版',
      price: '¥0',
      period: '永久免费',
      desc: '8 公理 + 37 技能 + 7 平台适配器 + MCP Server',
      features: [
        '8 公理 + 7 属性 + 36 根本属性',
        '37 个 metago-* 技能',
        '7 平台适配器',
        'MCP Server（35 tools）',
        '决策锁软校验（提示词驱动）',
      ],
      cta: '当前使用',
      disabled: true,
    },
    {
      id: 'pro' as const,
      icon: Zap,
      name: 'Pro 个人版',
      price: '¥39',
      period: '/月',
      desc: '决策锁强制校验 + 元进化档案 + 能力仪表盘',
      features: [
        '社区版全部功能',
        '决策锁强制校验（硬逻辑）',
        '元进化档案（自动记录）',
        '能力度量仪表盘（10 维雷达）',
        '跨平台同步（7 平台 + MCP）',
        '私有技能库（端到端加密）',
        '优先支持（72h 响应）',
        '14 天免费试用',
      ],
      cta: '开始试用',
      featured: true,
    },
    {
      id: 'team' as const,
      icon: Users,
      name: 'Pro 团队版',
      price: '¥199',
      period: '/月（5 席）',
      desc: '团队仪表盘 + 统一规范 + 进化档案团队版',
      features: [
        'Pro 个人版全部功能',
        '团队仪表盘（成员对比）',
        '统一规范配置',
        '进化档案团队版',
        '5 席位',
        '专属客户成功经理',
      ],
      cta: '联系销售',
    },
    {
      id: 'enterprise' as const,
      icon: Building2,
      name: '企业版',
      price: '¥30000',
      period: '/年起',
      desc: '私有部署 + 定制化 + SLA 保障',
      features: [
        '团队版全部功能',
        '私有化部署',
        '定制化开发',
        '99.9% SLA 保障',
        '专属架构咨询',
        '20+ 人企业',
      ],
      cta: '联系销售',
    },
  ]

  const handleStartTrial = () => {
    if (!email || !email.includes('@')) {
      setMessage({ type: 'error', text: '请输入有效的邮箱地址' })
      return
    }
    startTrialAction(email)
    setMessage({ type: 'success', text: `14 天试用已启动！授权码：${useStore.getState().license?.licenseKey}` })
  }

  const handleActivate = () => {
    if (!email || !email.includes('@')) {
      setMessage({ type: 'error', text: '请输入有效的邮箱地址' })
      return
    }
    if (!licenseKey.trim()) {
      setMessage({ type: 'error', text: '请输入授权码' })
      return
    }
    const result = activateProAction(licenseKey, email)
    setMessage({ type: result.success ? 'success' : 'error', text: result.message })
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* 头部 */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-3"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-emerald/10 border border-accent-emerald/30 text-accent-emerald text-xs font-medium">
          <Crown className="w-3.5 h-3.5" />
          MetaGO Pro
        </div>
        <h1 className="text-3xl lg:text-4xl font-bold text-zinc-100">
          让 Agent 从"可用"进化为
          <span className="bg-gradient-to-r from-accent-emerald to-accent-teal bg-clip-text text-transparent"> 可信 + 可追溯 + 可进化</span>
        </h1>
        <p className="text-zinc-400 text-sm lg:text-base max-w-2xl mx-auto">
          决策锁强制校验，杜绝幻觉 · 全链路进化档案，能力增长可视化 · 元进化记录，每次边界突破都是成长
        </p>
      </motion.div>

      {/* 当前档位状态 */}
      {(tier !== 'free' || trialDaysRemaining > 0) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card-base p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tier === 'trial' ? 'bg-accent-amber/20' : 'bg-accent-emerald/20'}`}>
              <Crown className={`w-5 h-5 ${tier === 'trial' ? 'text-accent-amber' : 'text-accent-emerald'}`} />
            </div>
            <div>
              <div className="text-sm text-zinc-400">当前档位</div>
              <div className="text-lg font-semibold text-zinc-100">{TIER_INFO[tier].name}</div>
            </div>
          </div>
          <div className="text-right">
            {tier === 'trial' && trialDaysRemaining > 0 && (
              <div className="text-sm text-accent-amber">试用剩余 {trialDaysRemaining} 天</div>
            )}
            {license?.licenseKey && (
              <div className="text-xs text-zinc-500 font-mono mt-1">{license.licenseKey}</div>
            )}
            <button
              onClick={deactivate}
              className="text-xs text-zinc-500 hover:text-accent-rose mt-1"
            >
              取消授权
            </button>
          </div>
        </motion.div>
      )}

      {/* 定价表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan, idx) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
            className={`card-base p-6 flex flex-col relative ${plan.featured ? 'border-accent-emerald/50 shadow-glow' : ''}`}
          >
            {plan.featured && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-accent-emerald text-bg-deep text-[10px] font-bold rounded-full uppercase tracking-wide">
                推荐
              </div>
            )}
            <div className="flex items-center gap-2 mb-3">
              <plan.icon className={`w-5 h-5 ${plan.featured ? 'text-accent-emerald' : 'text-zinc-400'}`} />
              <h3 className="text-lg font-semibold text-zinc-100">{plan.name}</h3>
            </div>
            <div className="mb-1">
              <span className="text-2xl font-bold text-zinc-100">{plan.price}</span>
              <span className="text-sm text-zinc-500 ml-1">{plan.period}</span>
            </div>
            <p className="text-xs text-zinc-500 mb-4">{plan.desc}</p>
            <ul className="space-y-2 mb-6 flex-1">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                  <Check className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${plan.featured ? 'text-accent-emerald' : 'text-zinc-500'}`} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              disabled={plan.disabled || (plan.id === 'pro' && tier === 'pro') || (plan.id === 'team' && tier === 'team')}
              onClick={() => {
                if (plan.id === 'pro') {
                  setMode('trial')
                  document.getElementById('activation-section')?.scrollIntoView({ behavior: 'smooth' })
                } else if (plan.id === 'team' || plan.id === 'enterprise') {
                  window.open('mailto:pro-support@metago.life?subject=咨询' + plan.name)
                }
              }}
              className={`btn-base w-full text-sm ${plan.featured ? 'btn-primary' : 'btn-secondary'} ${plan.disabled || (plan.id === 'pro' && tier === 'pro') ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {plan.disabled ? plan.cta : (plan.id === 'pro' && tier === 'pro') ? '已激活' : plan.cta}
            </button>
          </motion.div>
        ))}
      </div>

      {/* 激活/试用区域 */}
      <motion.div
        id="activation-section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="card-base p-6"
      >
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('trial')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${mode === 'trial' ? 'bg-accent-emerald/20 text-accent-emerald' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            14 天免费试用
          </button>
          <button
            onClick={() => setMode('activate')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${mode === 'activate' ? 'bg-accent-emerald/20 text-accent-emerald' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            输入授权码
          </button>
        </div>

        <div className="space-y-3 max-w-md">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">邮箱地址</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="input-base"
            />
          </div>
          {mode === 'activate' && (
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">授权码</label>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="METAGO-PRO-XXXX-XXXX-XXXX"
                className="input-base font-mono"
              />
            </div>
          )}
          <button
            onClick={mode === 'trial' ? handleStartTrial : handleActivate}
            className="btn-primary w-full"
          >
            {mode === 'trial' ? '启动 14 天试用' : '激活 Pro'}
            <ArrowRight className="w-4 h-4" />
          </button>
          {message && (
            <div className={`text-xs p-2 rounded ${message.type === 'success' ? 'bg-accent-emerald/10 text-accent-emerald' : message.type === 'error' ? 'bg-accent-rose/10 text-accent-rose' : 'bg-blue-500/10 text-blue-400'}`}>
              {message.text}
            </div>
          )}
          {mode === 'trial' && (
            <p className="text-xs text-zinc-500">
              试用版解锁全部 Pro 功能（除优先支持外）。试用结束后自动降级到社区版，数据保留。
            </p>
          )}
        </div>
      </motion.div>

      {/* 竞品对比 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="card-base p-6"
      >
        <h3 className="text-lg font-semibold text-zinc-100 mb-4">竞品对比</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left py-2 text-zinc-400 font-medium">产品</th>
                <th className="text-left py-2 text-zinc-400 font-medium">定位</th>
                <th className="text-left py-2 text-zinc-400 font-medium">定价</th>
                <th className="text-left py-2 text-zinc-400 font-medium">差异化</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border-subtle/50">
                <td className="py-2 text-accent-emerald font-medium">MetaGO Pro</td>
                <td className="py-2 text-zinc-300">AI 生命体增强</td>
                <td className="py-2 text-zinc-300">¥39/月</td>
                <td className="py-2 text-zinc-300">决策锁 + 元进化（核心差异）</td>
              </tr>
              <tr className="border-b border-border-subtle/50">
                <td className="py-2 text-zinc-300">LangSmith</td>
                <td className="py-2 text-zinc-400">LLM 可观测性</td>
                <td className="py-2 text-zinc-400">$39/月</td>
                <td className="py-2 text-zinc-400">仅观测，非强制校验</td>
              </tr>
              <tr className="border-b border-border-subtle/50">
                <td className="py-2 text-zinc-300">Cursor Pro</td>
                <td className="py-2 text-zinc-400">AI 编程增强</td>
                <td className="py-2 text-zinc-400">$20/月</td>
                <td className="py-2 text-zinc-400">平台绑定，无进化档案</td>
              </tr>
              <tr>
                <td className="py-2 text-zinc-300">Continue.dev</td>
                <td className="py-2 text-zinc-400">开源 AI 助手</td>
                <td className="py-2 text-zinc-400">免费</td>
                <td className="py-2 text-zinc-400">无决策锁 + 无元进化</td>
              </tr>
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}
