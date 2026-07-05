/**
 * QuotaExhaustedDialog - 配额耗尽弹窗（三选一）
 *
 * 当 Pro/Team 用户月配额耗尽时弹出，提供三个选择：
 *   A. 暂停 AI 对话（保留 Pro 工具功能，明日/下月重置）
 *   B. 按量付费 ¥5/百万 tokens（自动续费）
 *   C. 绑定自己的 API Key 继续（零超额费用）
 *
 * Free 用户配额耗尽：仅提示升级 Pro（不显示三选一）
 */

import { useState } from 'react'
import { X, Pause, CreditCard, Key, AlertTriangle, Loader2, Zap } from 'lucide-react'
import { getCurrentTier } from '../../lib/proGate'
import { TIER_INFO } from '../../lib/proGate'
import { PRICING_PLANS } from '../../lib/pricing'

interface QuotaExhaustedDialogProps {
  open: boolean
  onClose: () => void
  onUpgradePro?: () => void
  onBindByok?: () => void
  onAcceptOverage?: () => void
  /** 已用 / 总配额 */
  used?: number
  total?: number
  /** 配额周期 */
  period?: 'day' | 'month'
}

export function QuotaExhaustedDialog({
  open,
  onClose,
  onUpgradePro,
  onBindByok,
  onAcceptOverage,
  used = 0,
  total = 0,
  period = 'month',
}: QuotaExhaustedDialogProps) {
  const [loading, setLoading] = useState<'pause' | 'overage' | null>(null)

  if (!open) return null

  const tier = getCurrentTier()
  const isFree = tier === 'free'
  const tierName = TIER_INFO[tier]?.name || tier
  const plan = PRICING_PLANS[tier]
  const overagePrice = plan?.overagePricePerMillion || 5
  const periodLabel = period === 'day' ? '今日' : '本月'

  const formatNum = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
    return String(n)
  }

  const handlePause = () => {
    setLoading('pause')
    setTimeout(() => {
      setLoading(null)
      onClose()
    }, 500)
  }

  const handleOverage = () => {
    setLoading('overage')
    onAcceptOverage?.()
    setLoading(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-bg-card border border-border-default rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="px-6 py-5 border-b border-border-subtle flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Token 配额已用完</h2>
              <p className="text-xs text-zinc-500 mt-1">
                {tierName} · {periodLabel}已用 {formatNum(used)} / {formatNum(total)} tokens
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6">
          {/* Free 用户：仅升级提示 */}
          {isFree ? (
            <div className="space-y-4">
              <p className="text-sm text-zinc-300 leading-relaxed">
                {periodLabel}免费 Token 配额（{formatNum(total)} tokens）已用完。
                升级 <strong className="text-accent-emerald">Pro 个人版</strong> 即可解锁
                <strong className="text-accent-emerald"> 500万 tokens/月</strong>，
                并享受决策锁强制校验、元进化档案、跨平台同步等全部 Pro 功能。
              </p>

              <div className="p-4 bg-accent-emerald/5 border border-accent-emerald/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-accent-emerald">Pro 个人版</span>
                  <span className="text-lg font-bold text-accent-emerald">¥39<span className="text-xs font-normal text-zinc-500">/月</span></span>
                </div>
                <ul className="text-xs text-zinc-400 space-y-1">
                  <li>✓ 500万 tokens/月（DeepSeek V4 Pro）</li>
                  <li>✓ 决策锁强制校验（硬逻辑）</li>
                  <li>✓ 元进化档案 + 能力仪表盘</li>
                  <li>✓ BYOK 超额降级（绑自己 Key 零超额费）</li>
                  <li>✓ 优先支持（72h 响应）</li>
                </ul>
              </div>

              <button
                onClick={onUpgradePro}
                className="w-full py-3 bg-accent-emerald text-white rounded-lg font-medium hover:bg-accent-emerald/90 transition-colors flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                立即升级 Pro
              </button>
            </div>
          ) : (
            /* Pro/Team 用户：三选一 */
            <div className="space-y-3">
              <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                {periodLabel} Token 配额已用完。请选择以下方式继续：
              </p>

              {/* 选项 A：暂停 */}
              <button
                onClick={handlePause}
                disabled={loading !== null}
                className="w-full p-4 text-left rounded-lg border border-border-subtle hover:border-border-default hover:bg-bg-hover transition-all disabled:opacity-50"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-zinc-700/30 flex items-center justify-center flex-shrink-0">
                    <Pause className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-zinc-200">暂停 AI 对话</div>
                    <div className="text-xs text-zinc-500 mt-1">
                      保留 Pro 全部工具功能，AI 对话将在 {period === 'day' ? '明日 0:00' : '下月 1 日'} 自动恢复
                    </div>
                    {loading === 'pause' && (
                      <Loader2 className="w-3 h-3 animate-spin text-zinc-400 mt-1" />
                    )}
                  </div>
                  <span className="text-xs text-zinc-500">¥0</span>
                </div>
              </button>

              {/* 选项 B：按量付费 */}
              {plan?.overagePricePerMillion > 0 && (
                <button
                  onClick={handleOverage}
                  disabled={loading !== null}
                  className="w-full p-4 text-left rounded-lg border border-accent-amber/30 hover:border-accent-amber/50 hover:bg-accent-amber/5 transition-all disabled:opacity-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded bg-accent-amber/10 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-4 h-4 text-accent-amber" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-accent-amber">按量付费继续</div>
                      <div className="text-xs text-zinc-500 mt-1">
                        超出部分按 <strong className="text-accent-amber">¥{overagePrice}/百万 tokens</strong> 计费，自动从余额扣除
                      </div>
                      {loading === 'overage' && (
                        <Loader2 className="w-3 h-3 animate-spin text-accent-amber mt-1" />
                      )}
                    </div>
                    <span className="text-xs text-accent-amber">¥{overagePrice}/M</span>
                  </div>
                </button>
              )}

              {/* 选项 C：BYOK */}
              <button
                onClick={onBindByok}
                disabled={loading !== null}
                className="w-full p-4 text-left rounded-lg border border-accent-emerald/30 hover:border-accent-emerald/50 hover:bg-accent-emerald/5 transition-all disabled:opacity-50"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-accent-emerald/10 flex items-center justify-center flex-shrink-0">
                    <Key className="w-4 h-4 text-accent-emerald" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-accent-emerald">绑定自己的 API Key</div>
                    <div className="text-xs text-zinc-500 mt-1">
                      使用自己的 DeepSeek/OpenAI/Claude Key 继续，<strong className="text-accent-emerald">零超额费用</strong>
                    </div>
                  </div>
                  <span className="text-xs text-accent-emerald">¥0</span>
                </div>
              </button>

              {/* 推荐 */}
              <div className="mt-4 p-3 bg-bg-deep rounded-lg">
                <div className="text-[11px] text-zinc-500 leading-relaxed">
                  <strong className="text-zinc-400">推荐：</strong>
                  如果你经常超额，建议绑定自己的 API Key（DeepSeek 注册即送 500万 tokens 免费额度）。
                  绑定后所有 AI 对话通过你的 Key 调用，平台不收任何费用。
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="px-6 py-4 border-t border-border-subtle flex justify-between items-center">
          <span className="text-[11px] text-zinc-600">
            当前档位：{tierName}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            稍后再说
          </button>
        </div>
      </div>
    </div>
  )
}
