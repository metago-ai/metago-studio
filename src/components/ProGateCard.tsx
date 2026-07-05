/**
 * ProGateCard - 统一的 Pro 功能门控拦截组件（V3 - 2026-07-06）
 *
 * 当 free 用户访问 Pro 功能时展示：
 * 1. 功能说明
 * 2. "立即订阅 Pro"主按钮（V3 移除 14 天免费试用）
 * 3. "输入授权码"次按钮
 * 4. "了解详情"链接
 *
 * 替代各页面自行实现的简陋锁定展示，确保门控触点都有订阅引导。
 */
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Crown, CheckCircle2, ArrowRight, KeyRound, Zap } from 'lucide-react'

interface ProGateCardProps {
  /** 功能名称，如"私有技能库" */
  featureName: string
  /** 功能描述，1-2 句话 */
  description: string
  /** 功能亮点列表（3-5 条） */
  highlights: string[]
  /** 图标（可选，默认 Crown） */
  icon?: React.ComponentType<{ className?: string }>
}

export function ProGateCard({ featureName, description, highlights, icon: Icon = Crown }: ProGateCardProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full rounded-2xl border border-accent-amber/30 bg-bg-card/80 backdrop-blur-md p-8 text-center shadow-card"
      >
        {/* 图标 */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-accent-amber/20 to-accent-rose/20 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-accent-amber" />
        </div>

        <h2 className="text-xl font-bold text-zinc-100 mb-2">{featureName}是 Pro 功能</h2>
        <p className="text-sm text-zinc-400 mb-6">{description}</p>

        {/* 功能亮点 */}
        <div className="space-y-2 mb-6 text-left">
          {highlights.map((feat) => (
            <div key={feat} className="flex items-center gap-2 text-sm text-zinc-300">
              <CheckCircle2 className="w-4 h-4 text-accent-emerald flex-shrink-0" />
              <span>{feat}</span>
            </div>
          ))}
        </div>

        {/* 主按钮：立即订阅 Pro（V3 移除试用） */}
        <Link
          to="/pro"
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-accent-emerald to-accent-teal text-bg-deep font-semibold text-sm hover:opacity-90 transition-opacity mb-3"
        >
          <Zap className="w-4 h-4" /> 立即订阅 Pro（¥39/月起）
        </Link>

        {/* 次按钮 */}
        <div className="flex items-center justify-center gap-4 text-xs">
          <Link
            to="/pro"
            className="inline-flex items-center gap-1 text-zinc-400 hover:text-accent-emerald transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            输入授权码
          </Link>
          <span className="text-zinc-600">·</span>
          <Link
            to="/pro"
            className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            了解 Pro 详情
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
