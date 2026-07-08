/**
 * TokenUsageWidget - 顶栏 Token 用量小部件
 *
 * 显示当前 Token 配额使用情况：
 *   - Free 用户：10万 tokens/天（日剩余）
 *   - Pro/Team/Trial：500万/2000万/500万 tokens/月（月剩余）
 *   - Enterprise：BYOK 已激活（不计量）
 *
 * 交互：
 *   - 鼠标悬停展示详情（已用/总配/重置时间）
 *   - 配额 < 20% 时变橙色警告
 *   - 配额耗尽时变红色，点击跳转升级
 */

import { useState, useEffect } from 'react'
import { Zap, AlertTriangle, Key, Infinity as InfinityIcon } from 'lucide-react'
import { checkQuota, type QuotaInfo } from '../../lib/userService'
import { isByokActive, isByokRequired } from '../../lib/byokService'
import { TIER_INFO } from '../../lib/proGate'
import { useStore } from '../../store/useStore'

interface TokenUsageWidgetProps {
  onUpgradeClick?: () => void
  onByokClick?: () => void
}

export function TokenUsageWidget({ onUpgradeClick, onByokClick }: TokenUsageWidgetProps) {
  const [quota, setQuota] = useState<QuotaInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const license = useStore(s => s.license)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const q = await checkQuota()
        if (mounted) {
          setQuota(q)
          setLoading(false)
        }
      } catch (e) {
        console.warn('[TokenUsageWidget] 加载配额失败', e)
        if (mounted) setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 60_000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [license])

  // Enterprise 强制 BYOK
  if (isByokRequired()) {
    return (
      <button
        onClick={onByokClick}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-bg-deep border border-accent-violet/30 text-accent-violet hover:bg-bg-hover transition-colors"
        title="企业版强制 BYOK，点击配置"
      >
        <Key className="w-3.5 h-3.5" />
        <span>BYOK 必填</span>
      </button>
    )
  }

  // BYOK 已激活（Pro/Team 用户超额降级）
  if (isByokActive()) {
    return (
      <button
        onClick={onByokClick}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-bg-deep border border-accent-emerald/30 text-accent-emerald hover:bg-bg-hover transition-colors"
        title="正在使用自己的 API Key，点击管理"
      >
        <InfinityIcon className="w-3.5 h-3.5" />
        <span>BYOK 无限</span>
      </button>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-500 bg-bg-deep border border-border-subtle">
        <Zap className="w-3.5 h-3.5 animate-pulse" />
        <span>加载中...</span>
      </div>
    )
  }

  if (!quota) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-500 bg-bg-deep border border-border-subtle">
        <Zap className="w-3.5 h-3.5" />
        <span>-</span>
      </div>
    )
  }

  // 不限量（保留兼容）
  if (quota.isUnlimited || !isFinite(quota.remaining)) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-bg-deep border border-border-subtle text-zinc-300">
        <InfinityIcon className="w-3.5 h-3.5 text-accent-emerald" />
        <span>无限</span>
      </div>
    )
  }

  const percent = quota.total > 0 ? (quota.used / quota.total) * 100 : 0
  const remaining = quota.remaining
  const formatNum = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
    return String(n)
  }

  // 颜色：> 80% 红色警告，> 60% 橙色，正常绿色
  const isCritical = percent >= 80
  const isWarning = percent >= 60 && !isCritical
  const colorClass = isCritical
    ? 'text-rose-400 border-rose-500/30'
    : isWarning
      ? 'text-amber-400 border-amber-500/30'
      : 'text-accent-emerald border-accent-emerald/30'

  const tierName = TIER_INFO[quota.tier as keyof typeof TIER_INFO]?.name || quota.tier
  const periodLabel = quota.period === 'day' ? '今日' : '本月'
  const resetLabel = quota.period === 'day' ? '明日重置' : '下月重置'

  return (
    <div className="relative group">
      <button
        onClick={isCritical ? onUpgradeClick : undefined}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-bg-deep border ${colorClass} hover:bg-bg-hover transition-colors`}
        title={`${tierName} · ${periodLabel}已用 ${formatNum(quota.used)} / ${formatNum(quota.total)} tokens`}
      >
        {isCritical ? (
          <AlertTriangle className="w-3.5 h-3.5" />
        ) : (
          <Zap className="w-3.5 h-3.5" />
        )}
        <span>{formatNum(remaining)} / {formatNum(quota.total)}</span>
      </button>

      {/* 悬停详情 */}
      <div className="hidden group-hover:block absolute top-full right-0 mt-1 w-64 bg-bg-card border border-border-default rounded-lg shadow-lg z-50 p-3 text-xs">
        <div className="flex justify-between mb-2">
          <span className="text-zinc-500">{tierName}</span>
          <span className="text-zinc-400">{periodLabel}配额</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span className="text-zinc-500">已用</span>
            <span className="text-zinc-200 font-mono">{formatNum(quota.used)} tokens</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">剩余</span>
            <span className={`font-mono ${isCritical ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-accent-emerald'}`}>
              {formatNum(remaining)} tokens
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">总量</span>
            <span className="text-zinc-300 font-mono">{formatNum(quota.total)} tokens</span>
          </div>
          <div className="flex justify-between border-t border-border-subtle pt-1.5 mt-1.5">
            <span className="text-zinc-500">{resetLabel}</span>
            <span className="text-zinc-400">{percent.toFixed(1)}%</span>
          </div>
        </div>

        {/* 进度条 */}
        <div className="mt-2 h-1.5 bg-bg-deep rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-accent-emerald'
            }`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>

        {isCritical && (
          <button
            onClick={onUpgradeClick}
            className="mt-2 w-full py-1.5 text-[11px] bg-accent-emerald/20 text-accent-emerald rounded border border-accent-emerald/30 hover:bg-accent-emerald/30 transition-colors"
          >
            升级 Pro 解锁 500万 tokens/月 →
          </button>
        )}
      </div>
    </div>
  )
}
