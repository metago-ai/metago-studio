/**
 * 信用等级徽章组件
 *
 * 可在多处复用：
 *  - 行为价值面板顶部
 *  - Header 用户菜单
 *  - 个人主页
 *  - 排行榜
 */
import { Sprout, Hammer, Award, Crown, Sparkle } from 'lucide-react'
import { getLevelByScore, getLevelById } from '../lib/creditLevels'
import type { CreditLevelId } from '../types'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sprout,
  Hammer,
  Award,
  Crown,
  Sparkle,
}

interface CreditBadgeProps {
  /** 通过 score 或 levelId 指定等级（二选一） */
  score?: number
  levelId?: CreditLevelId
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** 是否展示等级名称 */
  showName?: boolean
  /** 是否展示分数 */
  showScore?: boolean
  /** 自定义 className */
  className?: string
}

export function CreditBadge({
  score,
  levelId,
  size = 'md',
  showName = true,
  showScore = false,
  className = '',
}: CreditBadgeProps) {
  const level = levelId ? getLevelById(levelId) : getLevelByScore(score ?? 0)
  const Icon = ICON_MAP[level.icon] ?? Sprout

  const sizeMap = {
    sm: { icon: 'w-3 h-3', text: 'text-[10px]', pad: 'px-1.5 py-0.5' },
    md: { icon: 'w-3.5 h-3.5', text: 'text-xs', pad: 'px-2 py-1' },
    lg: { icon: 'w-5 h-5', text: 'text-sm', pad: 'px-3 py-1.5' },
    xl: { icon: 'w-8 h-8', text: 'text-lg', pad: 'px-4 py-2' },
  }
  const s = sizeMap[size]

  return (
    <span
      className={`inline-flex items-center gap-1 ${s.pad} rounded-full bg-bg-elevated border border-border-subtle ${level.color} ${className}`}
      title={`${level.name} · ${level.minScore}-${level.maxScore === Number.MAX_SAFE_INTEGER ? '∞' : level.maxScore} 分`}
    >
      <Icon className={s.icon} />
      {showName && <span className={`font-medium ${s.text}`}>{level.name}</span>}
      {showScore && (
        <span className={`${s.text} text-zinc-500`}>
          {score ?? 0} 分
        </span>
      )}
    </span>
  )
}
