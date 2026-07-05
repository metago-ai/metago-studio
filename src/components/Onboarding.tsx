import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Dna, Crown, ArrowRight, X, Sparkles, Package, BarChart3,
} from 'lucide-react'

const ONBOARDING_KEY = 'metago_onboarding_completed_v1'

/** 快速开始行动入口（解决"看完不知道做什么"问题） */
const QUICK_ACTIONS = [
  { icon: Shield, title: '体验决策锁', desc: '立即试用 4 道关卡校验', path: '/decision-lock', bg: 'bg-accent-emerald/15', text: 'text-accent-emerald' },
  { icon: Package, title: '组装能力 Kit', desc: '选择技能生成定制包', path: '/kit', bg: 'bg-accent-teal/15', text: 'text-accent-teal' },
  { icon: BarChart3, title: '查看能力度量', desc: '了解你的能力画像', path: '/metrics', bg: 'bg-accent-blue/15', text: 'text-accent-blue' },
] as const

const STEPS = [
  {
    icon: Sparkles,
    title: '欢迎使用 MetaGO Studio',
    desc: '元构能力的可视化工作台。让 AI 输出更可靠，让能力进化可追踪。',
    color: 'emerald',
  },
  {
    icon: Shield,
    title: '决策锁校验',
    desc: '4 道关卡实时校验 AI 输出：意图验证 → 谱系追踪 → 语义输出 → 内容完整性。杜绝幻觉和占位符。',
    color: 'blue',
  },
  {
    icon: Dna,
    title: '元进化档案',
    desc: '记录你的能力进化历程。触发 → 边界 → 差距 → 行动 → 验证，完整追踪每一次成长。',
    color: 'teal',
  },
  {
    icon: Crown,
    title: '14 天免费试用',
    desc: '无需付费即可体验全部 Pro 功能。试用结束自动降级，不会自动扣费。',
    color: 'amber',
  },
]

export function Onboarding({ onComplete }: { onComplete?: () => void }) {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    try {
      const completed = localStorage.getItem(ONBOARDING_KEY)
      if (!completed) setShow(true)
    } catch {
      // localStorage 不可用，不显示引导
    }
  }, [])

  const handleClose = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, '1')
    } catch {
      // ignore
    }
    setShow(false)
    onComplete?.()
  }

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      handleClose()
    }
  }

  const handleQuickAction = (path: string) => {
    handleClose()
    navigate(path)
  }

  const currentStep = STEPS[step]
  const Icon = currentStep.icon
  const colorMap: Record<string, string> = {
    emerald: 'from-accent-emerald to-accent-teal',
    blue: 'from-blue-500 to-accent-blue',
    teal: 'from-accent-teal to-accent-emerald',
    amber: 'from-amber-500 to-accent-amber',
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-bg-card rounded-2xl border border-border-subtle p-8 shadow-2xl"
          >
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Progress dots */}
            <div className="flex gap-1.5 mb-6">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all ${
                    i === step ? 'w-8 bg-accent-emerald' : i < step ? 'w-4 bg-accent-emerald/40' : 'w-4 bg-zinc-700'
                  }`}
                />
              ))}
            </div>

            {/* Icon */}
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${colorMap[currentStep.color]} flex items-center justify-center mb-6`}>
              <Icon className="w-8 h-8 text-white" />
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-xl font-bold text-zinc-100 mb-3">{currentStep.title}</h2>
                <p className="text-sm text-zinc-400 leading-relaxed">{currentStep.desc}</p>
              </motion.div>
            </AnimatePresence>

            {/* 最后一步：推荐第一步行动指引 */}
            {step === STEPS.length - 1 && (
              <div className="mt-5 space-y-2">
                <p className="text-xs text-zinc-500 font-medium flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-accent-amber" />
                  推荐第一步：
                </p>
                {QUICK_ACTIONS.map((action) => {
                  const ActionIcon = action.icon
                  return (
                    <button
                      key={action.path}
                      onClick={() => handleQuickAction(action.path)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-border-subtle hover:border-accent-emerald/40 hover:bg-bg-hover transition-all text-left group"
                    >
                      <div className={`w-8 h-8 rounded-lg ${action.bg} flex items-center justify-center flex-shrink-0`}>
                        <ActionIcon className={`w-4 h-4 ${action.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-200">{action.title}</div>
                        <div className="text-xs text-zinc-500">{action.desc}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-accent-emerald group-hover:translate-x-0.5 transition-all" />
                    </button>
                  )
                })}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between mt-8">
              <button
                onClick={handleClose}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                跳过引导
              </button>
              <button
                onClick={handleNext}
                className="btn-primary text-sm flex items-center gap-2"
              >
                {step === STEPS.length - 1 ? '开始使用' : '下一步'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
