import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Lock,
  X,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { TEMPLATE_CATEGORIES } from '../data/templates'
import type { SceneTemplate, TemplateRunResult } from '../types'

const CATEGORY_COLORS: Record<string, string> = {
  code: 'from-accent-emerald/20 to-accent-emerald/5 border-accent-emerald/30',
  risk: 'from-accent-amber/20 to-accent-amber/5 border-accent-amber/30',
  evolution: 'from-accent-teal/20 to-accent-teal/5 border-accent-teal/30',
  compliance: 'from-accent-rose/20 to-accent-rose/5 border-accent-rose/30',
  architecture: 'from-accent-blue/20 to-accent-blue/5 border-accent-blue/30',
  provenance: 'from-accent-emerald/20 to-accent-teal/5 border-accent-teal/30',
}

export function TemplatesPage() {
  const { templates, features } = useStore()
  const [activeCategory, setActiveCategory] = useState('all')
  const [runningTemplate, setRunningTemplate] = useState<SceneTemplate | null>(null)
  const [runResult, setRunResult] = useState<TemplateRunResult | null>(null)
  const [currentStep, setCurrentStep] = useState(0)

  const canUseProTemplates = features.unlimitedTemplates

  const filteredTemplates =
    activeCategory === 'all'
      ? templates
      : templates.filter((t) => t.category === activeCategory)

  const runTemplate = (template: SceneTemplate) => {
    setRunningTemplate(template)
    setRunResult(null)
    setCurrentStep(0)

    template.steps.forEach((_step, idx) => {
      setTimeout(() => {
        setCurrentStep(idx + 1)
        if (idx === template.steps.length - 1) {
          setRunResult({
            templateId: template.id,
            timestamp: new Date().toISOString(),
            passed: true,
            stages: template.steps.map((s) => ({
              name: s.name,
              status: 'success' as const,
              output: s.description,
            })),
          })
        }
      }, (idx + 1) * 800)
    })
  }

  const closeRunner = () => {
    setRunningTemplate(null)
    setRunResult(null)
    setCurrentStep(0)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-accent-emerald" />
          场景模板
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          6 个预设场景一键运行：代码审查 · 风险决策 · 元进化 · 合规检查 · 架构设计 · 数据溯源
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="flex items-center gap-2 flex-wrap"
      >
        {TEMPLATE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
              activeCategory === cat.id
                ? 'bg-accent-emerald/20 text-accent-emerald border border-accent-emerald/40'
                : 'bg-bg-elevated/50 text-zinc-500 hover:text-zinc-200 border border-transparent'
            }`}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {filteredTemplates.map((template, idx) => (
          <motion.div
            key={template.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 + idx * 0.05 }}
            whileHover={{ scale: 1.02 }}
            className={`card-base p-5 bg-gradient-to-br ${CATEGORY_COLORS[template.category]} border transition-all duration-200 hover:shadow-glow group relative`}
          >
            {template.proOnly && (
              <span className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full bg-accent-amber/20 text-accent-amber flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Pro
              </span>
            )}
            <div className="text-3xl mb-3">{template.icon}</div>
            <h3 className="text-base font-semibold text-zinc-100 mb-1">{template.name}</h3>
            <p className="text-xs text-zinc-400 mb-3 min-h-[32px]">{template.description}</p>
            <div className="flex items-center gap-3 text-xs text-zinc-500 mb-4">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {template.estimatedDuration}
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {template.skills.length} 技能
              </span>
            </div>
            <button
              onClick={() => runTemplate(template)}
              disabled={template.proOnly && !canUseProTemplates}
              className={`w-full ${template.proOnly && !canUseProTemplates ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary'} text-xs`}
            >
              {template.proOnly && !canUseProTemplates ? (
                <>
                  <Lock className="w-3 h-3" />
                  Pro 专属
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  一键运行
                </>
              )}
            </button>
          </motion.div>
        ))}
      </motion.div>

      <AnimatePresence>
        {runningTemplate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-bg-deep/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeRunner}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="card-base p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{runningTemplate.icon}</span>
                  <div>
                    <h2 className="text-base font-semibold text-zinc-100">
                      {runningTemplate.name}
                    </h2>
                    <p className="text-xs text-zinc-500">{runningTemplate.description}</p>
                  </div>
                </div>
                <button
                  onClick={closeRunner}
                  className="text-zinc-500 hover:text-zinc-100 p-1"
                  aria-label="关闭"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                {runningTemplate.steps.map((step, idx) => {
                  const isCompleted = currentStep > idx
                  const isRunning = currentStep === idx + 1 && !runResult
                  const isPending = currentStep <= idx && !runResult
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border transition-all ${
                        isCompleted
                          ? 'border-accent-emerald/30 bg-accent-emerald/5'
                          : isRunning
                            ? 'border-accent-amber/30 bg-accent-amber/5'
                            : 'border-border-subtle bg-bg-elevated/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-accent-emerald" />
                          ) : isRunning ? (
                            <Loader2 className="w-5 h-5 text-accent-amber animate-spin" />
                          ) : isPending ? (
                            <span className="w-5 h-5 rounded-full border-2 border-border-default text-xs flex items-center justify-center text-zinc-600">
                              {idx + 1}
                            </span>
                          ) : (
                            <XCircle className="w-5 h-5 text-accent-rose" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-sm font-medium ${isCompleted || isRunning ? 'text-zinc-100' : 'text-zinc-500'}`}
                            >
                              {step.name}
                            </span>
                            <span className="text-xs text-zinc-600 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {step.durationMs}ms
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5">{step.description}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <AnimatePresence>
                {runResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 rounded-lg bg-accent-emerald/10 border border-accent-emerald/30"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-5 h-5 text-accent-emerald" />
                      <span className="text-sm font-medium text-accent-emerald">运行完成</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      场景「{runningTemplate.name}」已成功执行 {runningTemplate.steps.length} 个步骤。
                    </p>
                    <button className="mt-3 btn-primary text-xs">
                      查看完整报告
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
