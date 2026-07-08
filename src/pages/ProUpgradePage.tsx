import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Crown, Sparkles, Zap, Building2, Users, ArrowRight, LogIn, ShieldCheck, Key, Star } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useAuth } from '../contexts/AuthContext'
import { TIER_INFO } from '../lib/proGate'
import { BYOKConfigPanel } from '../components/agent/BYOKConfigPanel'
import {
  createOrder,
  getWechatQrCode,
  getAlipayUrl,
  mockPaySuccess,
  pollOrderStatus,
  type PaymentMethod,
  type PaymentResult,
  type PlanId,
} from '../lib/paymentService'

// V3 支付计划（与云函数 PLANS 定义对齐）
const PAY_PLANS: Array<{ id: PlanId; name: string; price: string; desc: string }> = [
  { id: 'pro', name: 'Pro 月度', price: '¥39', desc: '/月' },
  { id: 'pro_year', name: 'Pro 年度', price: '¥390', desc: '/年（省 ¥78）' },
  { id: 'pro_plus', name: 'Pro+ 月度', price: '¥99', desc: '/月' },
  { id: 'pro_plus_year', name: 'Pro+ 年度', price: '¥990', desc: '/年（省 ¥198）' },
  { id: 'team', name: 'Team 月度', price: '¥199', desc: '/月（5 席 + 500h）' },
  { id: 'enterprise', name: '企业版', price: '¥30000', desc: '/年起（5 席含）' },
]

type PayStep = 'select' | 'processing' | 'waiting' | 'success'

export function ProUpgradePage() {
  const { tier, license, activateProAction, deactivate, refreshFromCloud } = useStore()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [licenseKey, setLicenseKey] = useState('')
  // V3：仅保留 pay / activate / byok 三个 Tab（移除 trial）
  const [mode, setMode] = useState<'activate' | 'pay' | 'byok'>(() => {
    const tab = searchParams.get('tab')
    if (tab === 'byok' || tab === 'activate') return tab
    return 'pay'
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 在线支付相关状态
  const [payPlan, setPayPlan] = useState<PlanId>('pro')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('wechat')
  const [payStep, setPayStep] = useState<PayStep>('select')
  const [currentOrderId, setCurrentOrderId] = useState('')
  const [payResult, setPayResult] = useState<PaymentResult | null>(null)
  const cancelPollRef = useRef<(() => void) | null>(null)

  const isLoggedIn = user && !user.isAnonymous

  // 组件卸载时停止轮询
  useEffect(() => {
    return () => {
      cancelPollRef.current?.()
      cancelPollRef.current = null
    }
  }, [])

  // 支付成功统一处理：停止轮询、刷新云端订阅状态、显示成功提示
  const handlePaidSuccess = async () => {
    cancelPollRef.current?.()
    cancelPollRef.current = null
    setPayStep('success')
    setMessage({ type: 'success', text: '支付成功！订阅已激活' })
    await refreshFromCloud()
  }

  // 创建订单并发起支付
  const handlePay = async () => {
    if (!isLoggedIn || !user) {
      navigate('/auth?redirect=/pro')
      return
    }
    setSubmitting(true)
    setMessage(null)
    setPayStep('processing')
    try {
      const order = await createOrder(payPlan, payMethod)
      const result = payMethod === 'wechat'
        ? await getWechatQrCode(order.orderId)
        : await getAlipayUrl(order.orderId)
      setCurrentOrderId(order.orderId)
      setPayResult(result)
      setPayStep('waiting')

      // 支付宝：直接新窗口打开（生产环境）
      if (payMethod === 'alipay' && result.payUrl && !result.mock) {
        window.open(result.payUrl, '_blank', 'noopener,noreferrer')
      }

      // 启动订单状态轮询（最多 5 分钟）
      cancelPollRef.current?.()
      cancelPollRef.current = pollOrderStatus(order.orderId, () => {
        void handlePaidSuccess()
      }, { timeout: 300000, interval: 3000 })
    } catch (e) {
      setPayStep('select')
      setMessage({ type: 'error', text: (e as Error)?.message || '发起支付失败，请稍后重试' })
    } finally {
      setSubmitting(false)
    }
  }

  // 模拟支付成功（仅开发测试，云函数未配置真实密钥时使用）
  const handleMockPay = async () => {
    if (!currentOrderId) return
    setSubmitting(true)
    try {
      await mockPaySuccess(currentOrderId)
      await handlePaidSuccess()
    } catch (e) {
      setMessage({ type: 'error', text: (e as Error)?.message || '模拟支付失败' })
    } finally {
      setSubmitting(false)
    }
  }

  // 重置支付流程
  const handleResetPay = () => {
    cancelPollRef.current?.()
    cancelPollRef.current = null
    setPayStep('select')
    setCurrentOrderId('')
    setPayResult(null)
    setMessage(null)
  }

  // V3 五档定价卡片（无 Trial，新增 Pro+）
  const plans = [
    {
      id: 'free' as const,
      icon: Sparkles,
      name: '社区版',
      price: '¥0',
      period: '永久免费',
      desc: '8 公理 + 39 技能 + 7 平台适配器 + MCP Server',
      features: [
        '8 公理 + 7 属性 + 43 条根本属性',
        '39 个 metago-* 技能',
        '7 平台适配器',
        'MCP Server（53 tools）',
        '决策锁软校验（提示词驱动）',
        'AI 对话 10万 tokens/天（DeepSeek V4 Flash）',
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
      desc: '500万 tokens/月 + BYOK 超额降级 + 决策锁硬校验',
      features: [
        '社区版全部功能',
        '500万 tokens/月（DeepSeek V4 Pro + GLM-5V Turbo）',
        '决策锁强制校验（硬逻辑）',
        '元进化档案（自动记录）',
        '能力度量仪表盘（10 维雷达）',
        '跨平台同步（7 平台 + MCP）',
        '私有技能库（端到端加密）',
        'BYOK 超额降级（绑自己 Key 零超额费）',
        '超额按量 ¥5/百万 tokens 或暂停',
        '优先支持（72h 响应）',
      ],
      cta: '订阅 Pro',
      featured: true,
    },
    {
      id: 'pro_plus' as const,
      icon: Star,
      name: 'Pro+ 增强版',
      price: '¥99',
      period: '/月',
      desc: '2000万 tokens/月 + 行为银行 + 决策锁可视化',
      features: [
        'Pro 个人版全部功能',
        '2000万 tokens/月（4 倍 Pro 额度）',
        '行为银行 MVP（数字+AI 行为记录）',
        '行为价值面板（信用徽章）',
        '决策锁可视化（全链路追溯）',
        '开放 API（行为数据导出）',
        'BYOK 超额降级',
        '超额按量 ¥4/百万 tokens',
        '优先支持（48h 响应）',
      ],
      cta: '订阅 Pro+',
    },
    {
      id: 'team' as const,
      icon: Users,
      name: 'Team 团队版',
      price: '¥199',
      period: '/月起（5 席）',
      desc: '订阅 + 时薪混合：500 小时/月 + 超出 ¥0.5/小时',
      features: [
        'Pro+ 增强版全部功能',
        '2000万 tokens/月（5 人共享池）',
        '500 AI 数字员工小时/月（含）',
        '超出小时按 ¥0.5/小时 计费',
        '团队仪表盘（成员对比）',
        '统一规范配置',
        '进化档案团队版',
        '5 席位',
        'BYOK 管理员配置',
        '专属客户成功经理',
      ],
      cta: '联系销售',
    },
    {
      id: 'enterprise' as const,
      icon: Building2,
      name: '企业版',
      price: '¥3万',
      period: '/年起（5 席含）',
      desc: '年费 + 席位费：加席 ¥6000/席位/年 + 强制 BYOK + SLA',
      features: [
        'Team 团队版全部功能',
        '5 席位（含），可加购席位',
        '加席 ¥6000/席位/年',
        '强制 BYOK（数据不出企业，零 Token 费用）',
        '私有化部署',
        '定制化开发',
        '99.9% SLA 保障',
        '专属架构咨询',
        'SIE 空间智能体咨询服务',
        '20+ 人企业',
      ],
      cta: '联系销售',
    },
  ]

  const handleActivate = async () => {
    if (!isLoggedIn || !user) {
      navigate('/auth?redirect=/pro')
      return
    }
    if (!licenseKey.trim()) {
      setMessage({ type: 'error', text: '请输入授权码' })
      return
    }
    // Fallback 链：邮箱 → 手机号 → 昵称 → uid
    const contact = user.email || user.phone || user.displayName || user.uid || ''
    setSubmitting(true)
    setMessage(null)
    try {
      const result = await activateProAction(licenseKey, contact)
      setMessage({ type: result.success ? 'success' : 'error', text: result.message })
    } catch {
      setMessage({ type: 'error', text: '网络异常，请稍后重试' })
    } finally {
      setSubmitting(false)
    }
  }

  const handlePlanClick = (planId: string) => {
    if (planId === 'pro') {
      if (tier === 'pro' || tier === 'pro_plus' || tier === 'team' || tier === 'enterprise') return
      setMode('pay')
      setPayPlan('pro')
      handleResetPay()
      document.getElementById('activation-section')?.scrollIntoView({ behavior: 'smooth' })
    } else if (planId === 'pro_plus') {
      if (tier === 'pro_plus' || tier === 'team' || tier === 'enterprise') return
      setMode('pay')
      setPayPlan('pro_plus')
      handleResetPay()
      document.getElementById('activation-section')?.scrollIntoView({ behavior: 'smooth' })
    } else if (planId === 'team' || planId === 'enterprise') {
      window.open('mailto:pro-support@metago.life?subject=咨询' + plans.find(p => p.id === planId)?.name)
    }
  }

  // 当前 tier 是否已激活（用于禁用按钮）
  const isPlanActive = (planId: string): boolean => {
    if (planId === 'pro' && (tier === 'pro' || tier === 'pro_plus' || tier === 'team' || tier === 'enterprise')) return true
    if (planId === 'pro_plus' && (tier === 'pro_plus' || tier === 'team' || tier === 'enterprise')) return true
    return false
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
      {tier !== 'free' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card-base p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-accent-emerald/20">
              <Crown className="w-5 h-5 text-accent-emerald" />
            </div>
            <div>
              <div className="text-sm text-zinc-400">当前档位</div>
              <div className="text-lg font-semibold text-zinc-100">{TIER_INFO[tier].name}</div>
            </div>
          </div>
          <div className="text-right">
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

      {/* 定价表（V3 五档：Free / Pro / Pro+ / Team / Enterprise） */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
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
              disabled={plan.disabled || isPlanActive(plan.id)}
              onClick={() => handlePlanClick(plan.id)}
              className={`btn-base w-full text-sm ${plan.featured ? 'btn-primary' : 'btn-secondary'} ${plan.disabled || isPlanActive(plan.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {plan.disabled
                ? plan.cta
                : isPlanActive(plan.id) ? '已激活' : plan.cta}
            </button>
          </motion.div>
        ))}
      </div>

      {/* 激活/支付区域 */}
      <motion.div
        id="activation-section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="card-base p-6"
      >
        {/* 未登录状态：引导注册/登录 */}
        {!isLoggedIn ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-2xl bg-accent-emerald/10 flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-7 h-7 text-accent-emerald" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100 mb-2">登录后订阅 Pro</h3>
            <p className="text-sm text-zinc-500 mb-6 max-w-md mx-auto">
              注册账户并登录后，即可订阅 Pro / Pro+ / Team / Enterprise。授权码将自动绑定到您的账户，可在"我的"页面查看。
            </p>
            <button
              onClick={() => navigate('/auth?redirect=/pro')}
              className="btn-primary text-sm inline-flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              注册 / 登录
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            {/* 已登录状态 */}
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-4 h-4 text-accent-emerald" />
              <span className="text-xs text-zinc-500">已登录：{user.email || user.phone}</span>
            </div>

            <div className="flex gap-2 mb-4 flex-wrap">
              <button
                onClick={() => { setMode('pay'); setMessage(null) }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${mode === 'pay' ? 'bg-accent-emerald/20 text-accent-emerald' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                在线支付
              </button>
              <button
                onClick={() => { setMode('activate'); setMessage(null) }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${mode === 'activate' ? 'bg-accent-emerald/20 text-accent-emerald' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                输入授权码
              </button>
              <button
                onClick={() => { setMode('byok'); setMessage(null) }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${mode === 'byok' ? 'bg-accent-emerald/20 text-accent-emerald' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                BYOK 绑定
              </button>
            </div>

            <div className="space-y-3 max-w-md">
              {mode === 'activate' ? (
                <>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">授权码</label>
                    <input
                      type="text"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value)}
                      placeholder="METAGO-PRO-XXXX-XXXX-XXXX"
                      className="input-base font-mono"
                    />
                    <p className="text-[11px] text-zinc-500 mt-1">
                      支持 Pro / Pro+ / Team / Enterprise 授权码（METAGO-PRO / METAGO-PROPLUS / METAGO-TEAM / METAGO-ENT）
                    </p>
                  </div>
                  <button
                    onClick={handleActivate}
                    disabled={submitting}
                    className="btn-primary w-full"
                  >
                    {submitting ? '验证中...' : '激活'}
                    {!submitting && <ArrowRight className="w-4 h-4" />}
                  </button>
                </>
              ) : mode === 'byok' ? (
                <>
                  <div className="mb-3 p-3 bg-accent-emerald/5 border border-accent-emerald/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Key className="w-4 h-4 text-accent-emerald flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-zinc-300 leading-relaxed">
                        <strong className="text-accent-emerald">BYOK = Bring Your Own Key</strong>
                        <br />
                        绑定自己的 API Key（DeepSeek/OpenAI/Claude/GLM），所有 AI 对话通过你的 Key 调用，
                        <strong>不消耗平台 Token 配额，零超额费用</strong>。
                        <br />
                        <span className="text-zinc-500">仅 Pro/Pro+/Team/Enterprise 档位可用。Enterprise 强制绑定。</span>
                      </div>
                    </div>
                  </div>
                  <BYOKConfigPanel
                    onBound={() => {
                      setMessage({ type: 'success', text: 'BYOK 绑定成功！后续 AI 对话将通过你的 Key 调用' })
                      refreshFromCloud()
                    }}
                    onUnbound={() => {
                      setMessage({ type: 'info', text: 'BYOK 已解绑，恢复使用平台 Token 配额' })
                    }}
                  />
                </>
              ) : (
                <>
                  {/* ===== 在线支付流程 ===== */}
                  {payStep === 'select' && (
                    <>
                      <div>
                        <label className="text-xs text-zinc-500 mb-2 block">选择订阅计划</label>
                        <div className="grid grid-cols-2 gap-2">
                          {PAY_PLANS.map(p => (
                            <button
                              key={p.id}
                              onClick={() => setPayPlan(p.id)}
                              className={`p-2 rounded-lg border text-left transition-colors ${payPlan === p.id ? 'border-accent-emerald/50 bg-accent-emerald/10' : 'border-border-subtle hover:border-zinc-600'}`}
                            >
                              <div className="text-sm font-medium text-zinc-100">{p.name}</div>
                              <div className="text-xs text-zinc-400">
                                <span className="text-accent-emerald">{p.price}</span> {p.desc}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-zinc-500 mb-2 block">支付方式</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setPayMethod('wechat')}
                            className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${payMethod === 'wechat' ? 'border-accent-emerald/50 bg-accent-emerald/10 text-zinc-100' : 'border-border-subtle text-zinc-400 hover:border-zinc-600'}`}
                          >
                            微信支付
                          </button>
                          <button
                            onClick={() => setPayMethod('alipay')}
                            className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${payMethod === 'alipay' ? 'border-accent-emerald/50 bg-accent-emerald/10 text-zinc-100' : 'border-border-subtle text-zinc-400 hover:border-zinc-600'}`}
                          >
                            支付宝
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={handlePay}
                        disabled={submitting}
                        className="btn-primary w-full inline-flex items-center justify-center gap-2"
                      >
                        {submitting ? '处理中...' : <>立即支付 {PAY_PLANS.find(p => p.id === payPlan)?.price}<ArrowRight className="w-4 h-4" /></>}
                      </button>
                      <p className="text-xs text-zinc-500">
                        支付完成后订阅自动激活。开发环境下支付网关未配置时，可使用模拟支付快速测试。
                      </p>
                    </>
                  )}

                  {payStep === 'processing' && (
                    <div className="text-center py-4 text-sm text-zinc-400">
                      <div className="animate-pulse">正在创建订单并请求支付链接...</div>
                    </div>
                  )}

                  {payStep === 'waiting' && payResult && (
                    <div className="space-y-3">
                      {payMethod === 'wechat' ? (
                        <div className="space-y-2">
                          <div className="text-xs text-zinc-400">请使用微信扫码完成支付：</div>
                          <div className="p-3 bg-zinc-900/50 rounded-lg border border-border-subtle break-all font-mono text-xs text-accent-emerald">
                            {payResult.codeUrl}
                          </div>
                          <p className="text-xs text-zinc-500">
                            将上方链接生成二维码后用微信扫码；或在移动端
                            <a
                              href={payResult.codeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent-emerald underline ml-1"
                            >
                              直接打开
                            </a>。
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-xs text-zinc-400">
                            已为您打开支付宝支付页面，完成支付后请返回此页面。
                          </div>
                          {payResult.payUrl && (
                            <a
                              href={payResult.payUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-secondary w-full inline-flex items-center justify-center gap-1 text-sm"
                            >
                              重新打开支付页面 <ArrowRight className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      )}

                      {payResult.mock && !import.meta.env.PROD && (
                        <div className="p-3 rounded-lg border border-accent-amber/30 bg-accent-amber/10 space-y-2">
                          <div className="text-xs text-accent-amber font-medium">开发测试模式</div>
                          <p className="text-xs text-zinc-400">{payResult.message}</p>
                          <button
                            onClick={handleMockPay}
                            disabled={submitting}
                            className="btn-secondary w-full text-sm"
                          >
                            {submitting ? '处理中...' : '模拟支付成功（仅测试）'}
                          </button>
                        </div>
                      )}

                      <div className="text-xs text-zinc-500 text-center">
                        等待支付确认...（订单号 <span className="font-mono">{currentOrderId}</span>）
                      </div>
                      <button
                        onClick={handleResetPay}
                        className="text-xs text-zinc-500 hover:text-zinc-300 w-full text-center"
                      >
                        ← 返回重新选择
                      </button>
                    </div>
                  )}

                  {payStep === 'success' && (
                    <div className="text-center py-4 space-y-3">
                      <div className="w-12 h-12 rounded-full bg-accent-emerald/20 flex items-center justify-center mx-auto">
                        <Check className="w-6 h-6 text-accent-emerald" />
                      </div>
                      <div className="text-sm text-zinc-100 font-medium">订阅激活成功！</div>
                      <button
                        onClick={handleResetPay}
                        className="text-xs text-zinc-500 hover:text-zinc-300"
                      >
                        ← 返回
                      </button>
                    </div>
                  )}
                </>
              )}
              {message && (
                <div className={`text-xs p-2 rounded ${message.type === 'success' ? 'bg-accent-emerald/10 text-accent-emerald' : message.type === 'error' ? 'bg-accent-rose/10 text-accent-rose' : 'bg-blue-500/10 text-blue-400'}`}>
                  {message.text}
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>

      {/* 竞品对比 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="card-base p-6"
      >
        <h3 className="text-lg font-semibold text-zinc-100 mb-2">竞品对比</h3>
        <p className="text-xs text-zinc-500 mb-4">
          2026 年业界已转向 Token/Credit 计量模式，MetaGO 采用混合模式（订阅含额度 + 时薪 + BYOK 降级 + 超额付费），成本封顶、ARPU 守恒
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left py-2 text-zinc-400 font-medium">产品</th>
                <th className="text-left py-2 text-zinc-400 font-medium">定位</th>
                <th className="text-left py-2 text-zinc-400 font-medium">定价</th>
                <th className="text-left py-2 text-zinc-400 font-medium">Token 模式</th>
                <th className="text-left py-2 text-zinc-400 font-medium">差异化</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border-subtle/50">
                <td className="py-2 text-accent-emerald font-medium">MetaGO Pro+</td>
                <td className="py-2 text-zinc-300">AI 生命体增强</td>
                <td className="py-2 text-zinc-300">¥99/月</td>
                <td className="py-2 text-zinc-300">2000万 tokens + 行为银行</td>
                <td className="py-2 text-zinc-300">决策锁 + 元进化 + 行为银行</td>
              </tr>
              <tr className="border-b border-border-subtle/50">
                <td className="py-2 text-zinc-300">Cursor Pro</td>
                <td className="py-2 text-zinc-400">AI 编程增强</td>
                <td className="py-2 text-zinc-400">$20/月</td>
                <td className="py-2 text-zinc-400">Credits 制（2025/06 转）</td>
                <td className="py-2 text-zinc-400">平台绑定，无进化档案</td>
              </tr>
              <tr className="border-b border-border-subtle/50">
                <td className="py-2 text-zinc-300">Copilot Pro</td>
                <td className="py-2 text-zinc-400">AI 编程助手</td>
                <td className="py-2 text-zinc-400">$10/月</td>
                <td className="py-2 text-zinc-400">AI Credits（2026/06 转）</td>
                <td className="py-2 text-zinc-400">无决策锁</td>
              </tr>
              <tr className="border-b border-border-subtle/50">
                <td className="py-2 text-zinc-300">Trae Pro</td>
                <td className="py-2 text-zinc-400">AI 编程工具</td>
                <td className="py-2 text-zinc-400">$12/月</td>
                <td className="py-2 text-zinc-400">Token 计量（2026/02 转）</td>
                <td className="py-2 text-zinc-400">无元进化档案</td>
              </tr>
              <tr className="border-b border-border-subtle/50">
                <td className="py-2 text-zinc-300">Anthropic Claude</td>
                <td className="py-2 text-zinc-400">全托管数字员工</td>
                <td className="py-2 text-zinc-400">按时薪计费</td>
                <td className="py-2 text-zinc-400">时薪制（2026/07 推出）</td>
                <td className="py-2 text-zinc-400">无行为银行</td>
              </tr>
              <tr>
                <td className="py-2 text-zinc-300">Continue.dev</td>
                <td className="py-2 text-zinc-400">开源 AI 助手</td>
                <td className="py-2 text-zinc-400">免费</td>
                <td className="py-2 text-zinc-400">自带 Key</td>
                <td className="py-2 text-zinc-400">无决策锁 + 无元进化</td>
              </tr>
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* 定价说明 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="card-base p-4"
      >
        <div className="text-xs text-zinc-500 leading-relaxed space-y-1">
          <div><strong className="text-zinc-400">V3 定价说明：</strong></div>
          <div>· Token 计费基于 DeepSeek V4 Pro 价格（缓存命中 0.025元/M，未命中 3元/M，输出 6元/M，高峰翻倍）</div>
          <div>· Pro/Pro+/Team 超额三选一：暂停对话 / 按量付费（¥4-5/百万）/ 绑定自己 API Key（推荐，零超额费）</div>
          <div>· Pro+ 含行为银行 MVP（数字+AI 行为记录 + 价值面板 + 信用徽章 + 开放 API）</div>
          <div>· Team 为订阅 + 时薪混合：¥199/月起含 5 席 + 500 AI 数字员工小时/月，超出按 ¥0.5/小时 计费</div>
          <div>· Enterprise 为年费 + 席位费：¥3万/年起含 5 席，加席 ¥6000/席位/年，强制 BYOK + 私有部署</div>
          <div>· Certify 认证独立收费：L1 ¥999 / L2 ¥2999-4999 / L3 ¥5999-7999 / L4 ¥9999</div>
          <div>· 所有档位均保留决策锁、元进化、能力仪表盘等核心功能，差异仅在 Token 额度与高级特性</div>
        </div>
      </motion.div>
    </div>
  )
}
