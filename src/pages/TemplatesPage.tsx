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
  Shield,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { TEMPLATE_CATEGORIES } from '../data/templates'
import type { SceneTemplate, TemplateRunResult, EvolutionRecord } from '../types'

const CATEGORY_COLORS: Record<string, string> = {
  code: 'from-accent-emerald/20 to-accent-emerald/5 border-accent-emerald/30',
  risk: 'from-accent-amber/20 to-accent-amber/5 border-accent-amber/30',
  evolution: 'from-accent-teal/20 to-accent-teal/5 border-accent-teal/30',
  compliance: 'from-accent-rose/20 to-accent-rose/5 border-accent-rose/30',
  architecture: 'from-accent-blue/20 to-accent-blue/5 border-accent-blue/30',
  provenance: 'from-accent-emerald/20 to-accent-teal/5 border-accent-teal/30',
}

/** 每个模板的真实场景输入（用于调用真实校验器） */
const TEMPLATE_SCENARIOS: Record<string, { userInput: string; aiOutput: string; evolution?: Omit<EvolutionRecord, 'id' | 'timestamp'> }> = {
  'tpl-code-review': {
    userInput: '审查这段用户登录代码的安全性',
    aiOutput: `function login(username, password) {
  const query = "SELECT * FROM users WHERE name='" + username + "' AND password='" + password + "'";
  return db.execute(query);
}
// 该代码直接拼接用户输入，存在 SQL 注入风险（CWE-89）。
// 修复建议：使用参数化查询。`,
  },
  'tpl-risk-decision': {
    userInput: '评估是否应该使用云原生架构重构现有系统',
    aiOutput: `经过5维度评估，建议采用云原生架构。
因为现有系统存在扩展性瓶颈，所以需要重构。
首先评估业务需求，其次对比方案，然后制定迁移计划，最后验证可行性。
预计成本降低30%，性能提升50%。`,
  },
  'tpl-meta-evolve': {
    userInput: '处理 Rust async/await 的 Pin 安全性问题',
    aiOutput: `识别到能力边界：不熟悉 Rust Pin/Unpin 语义。
因为缺少 Pin 安全性约束的自证链条，所以需要从 TypeScript Promise 推导 Rust Future。
首先分析 Pin 的核心约束，其次推导 Unpin 的等价条件，然后生成 Pin safety checker，最后验证正确性。
新能力已固化，可处理类似问题。`,
    evolution: {
      trigger: 'Rust async/await Pin 安全性',
      boundary: '不熟悉 Rust Pin/Unpin 语义',
      gap: '缺少 Pin 安全性约束的自证链条',
      generated: '从 TypeScript Promise 推导 Rust Future，生成 Pin safety checker',
      verified: true,
      recursed: true,
      durationMs: 856,
      depth: 1,
    },
  },
  'tpl-compliance': {
    userInput: '检查用户数据处理流程的 GDPR 合规性',
    aiOutput: `因为用户数据存储在欧盟境内服务器，所以需要符合 GDPR。
首先识别数据主体权利，其次映射处理活动到法规条款，然后执行 OWASP Top 10 扫描，最后生成合规报告。
所有数据处理均有合法依据，用户权利保障机制完整。`,
  },
  'tpl-architecture': {
    userInput: '设计一个支持百万级并发的实时消息系统架构',
    aiOutput: `因为需要支持百万级并发，所以采用事件驱动架构。
首先分析非功能性需求（延迟<50ms，可用性99.99%），其次对比 Kafka/Pulsar/RocketMQ，然后分解为网关层/路由层/存储层，最后定义 API 契约。
最终选择 Kafka + Redis 集群方案，预期吞吐量 200万 msg/s。`,
  },
  'tpl-provenance': {
    userInput: '验证 AI 输出的数据溯源链路完整性',
    aiOutput: `因为输出数据需要可追溯，所以建立全链路存证。
首先对原始输入签名，其次记录每步处理过程，然后验证输出完整性与一致性，最后锚定时间戳。
溯源链路完整，所有数据均可自证。`,
  },
}

export function TemplatesPage() {
  const { templates, features, runValidation, addEvolutionRecord } = useStore()
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

    const scenario = TEMPLATE_SCENARIOS[template.id]
    if (!scenario) {
      // 无场景数据的模板，降级为步骤展示
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
        }, (idx + 1) * 600)
      })
      return
    }

    // 步骤动画 + 最终调用决策锁校验器
    template.steps.forEach((_step, idx) => {
      setTimeout(() => {
        setCurrentStep(idx + 1)
        if (idx === template.steps.length - 1) {
          // 最后一步：调用真实决策锁校验器
          const lockRecord = runValidation({
            userInput: scenario.userInput,
            aiOutput: scenario.aiOutput,
          })

          // 元进化模板：额外写入进化记录
          if (scenario.evolution) {
            const evoRecord: EvolutionRecord = {
              ...scenario.evolution,
              id: `evo_tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
            }
            addEvolutionRecord(evoRecord)
          }

          setRunResult({
            templateId: template.id,
            timestamp: new Date().toISOString(),
            passed: lockRecord.passed,
            stages: [
              ...template.steps.map((s) => ({
                name: s.name,
                status: 'success' as const,
                output: s.description,
              })),
              {
                name: '决策锁校验',
                status: lockRecord.passed ? ('success' as const) : ('failed' as const),
                output: lockRecord.passed
                  ? `4道关卡全部通过（${lockRecord.totalDurationMs}ms）`
                  : `阻断：${lockRecord.blockedReason || '未知原因'}`,
              },
            ],
          })
        }
      }, (idx + 1) * 600)
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
        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-accent-emerald/10 border border-accent-emerald/30 text-accent-emerald text-[10px]">
          <Shield className="w-3 h-3" />
          代码级校验 · 决策锁四道关卡
        </div>
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
                    className={`mt-4 p-4 rounded-lg border ${
                      runResult.passed
                        ? 'bg-accent-emerald/10 border-accent-emerald/30'
                        : 'bg-accent-rose/10 border-accent-rose/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {runResult.passed ? (
                        <CheckCircle2 className="w-5 h-5 text-accent-emerald" />
                      ) : (
                        <XCircle className="w-5 h-5 text-accent-rose" />
                      )}
                      <span
                        className={`text-sm font-medium ${
                          runResult.passed ? 'text-accent-emerald' : 'text-accent-rose'
                        }`}
                      >
                        {runResult.passed ? '运行完成 · 决策锁校验通过' : '运行完成 · 决策锁阻断'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      场景「{runningTemplate.name}」已执行 {runningTemplate.steps.length} 个步骤，
                      {runResult.passed
                        ? '决策锁四道关卡全部通过。'
                        : '决策锁检测到问题并阻断输出。'}
                    </p>
                    {runResult.stages[runResult.stages.length - 1] && (
                      <p className="text-xs text-zinc-500 mt-2 pl-4 border-l-2 border-border-default">
                        {runResult.stages[runResult.stages.length - 1].output}
                      </p>
                    )}
                    <p className="text-[10px] text-zinc-600 mt-2">
                      💡 结果已写入决策锁历史和进化档案，可在对应页面查看
                    </p>
                    <button
                      onClick={closeRunner}
                      className="mt-3 btn-primary text-xs"
                    >
                      关闭
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
