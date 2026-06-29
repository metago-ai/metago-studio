import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, CheckCircle2, XCircle, Clock, Play, Download, AlertTriangle, Dna,
  ChevronDown, ChevronRight, Trash2, Crown,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { exportAndDownloadLockJSONL, exportAndDownloadLockMarkdown } from '../lib/exporters'
import type { DecisionLockRecord } from '../types'

const SAMPLE_INPUTS = [
  {
    label: 'SQL 注入风险',
    user: '请审查这段代码的安全性',
    output: '因为这段代码直接拼接用户输入到 SQL 查询中，所以存在 SQL 注入风险。首先应使用参数化查询，其次应校验输入类型，最后限制查询权限。建议改用 prepared statement。',
  },
  {
    label: '占位符幻觉',
    user: '请生成一个 React 组件',
    output: '这是一个 React 组件：\n\nfunction MyComponent() {\n  return <div>${variable}</div>\n}\n\n请替换 variable 为你的实际变量名。[TODO: 添加样式]',
  },
  {
    label: '伪造数据',
    user: '请分析这个产品的市场表现',
    output: '根据调查数据显示，该产品有 85%的提升，用户满意度达到 99.99%，100%保证了安全性。据统计，市场占有率增长了 3.5 倍。',
  },
  {
    label: '完整输出',
    user: '请解释什么是决策锁',
    output: '决策锁是 MetaGO 的核心机制。首先，它通过四道关卡校验 AI 输出：意图验证(IVL)、意图谱系追踪(ILT)、语义输出门(OSG)、完整性校验。其次，每道关卡都有明确的通过条件和失败处理。因此，决策锁能有效杜绝幻觉输出。最后，未通过的输出会被阻断并触发元进化循环，让 AI 从错误中学习。',
  },
]

export function DecisionLockPage() {
  const { decisionLockHistory, lockStats, runValidation, clearDecisionLockHistory, features } = useStore()
  const [userInput, setUserInput] = useState(SAMPLE_INPUTS[0].user)
  const [aiOutput, setAiOutput] = useState(SAMPLE_INPUTS[0].output)
  const [currentRecord, setCurrentRecord] = useState<DecisionLockRecord | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [expandedStage, setExpandedStage] = useState<string | null>('ivl')
  const [showHistory, setShowHistory] = useState(true)

  const isHardValidation = features.decisionLockHardValidation

  const runValidationHandler = () => {
    setIsRunning(true)
    setExpandedStage(null)
    // 真实校验器是同步的，但加一点延迟以展示动画
    setTimeout(() => {
      const record = runValidation({ userInput, aiOutput })
      setCurrentRecord(record)
      setIsRunning(false)
      // 展开第一个关卡
      setExpandedStage(record.stages[0]?.id || 'ivl')
    }, 300)
  }

  const loadSample = (idx: number) => {
    setUserInput(SAMPLE_INPUTS[idx].user)
    setAiOutput(SAMPLE_INPUTS[idx].output)
    setCurrentRecord(null)
  }

  const handleExportJSONL = () => {
    if (decisionLockHistory.length === 0) return
    exportAndDownloadLockJSONL(decisionLockHistory)
  }
  const handleExportMarkdown = () => {
    if (decisionLockHistory.length === 0) return
    exportAndDownloadLockMarkdown(decisionLockHistory)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 头部 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-accent-emerald" />
            决策锁{isHardValidation ? '强制校验' : '可视化'}
            {isHardValidation && (
              <span className="px-2 py-0.5 rounded bg-accent-emerald/20 text-accent-emerald text-[10px] font-bold uppercase">
                硬校验
              </span>
            )}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            四道关卡：意图验证(IVL) → 意图谱系追踪(ILT) → 语义输出门(OSG) → 完整性校验
          </p>
        </div>
        {!isHardValidation && (
          <a href="#/pro" className="btn-secondary text-xs">
            <Crown className="w-3.5 h-3.5" />
            升级 Pro 启用硬校验
          </a>
        )}
      </motion.div>

      {/* 统计卡片 */}
      {decisionLockHistory.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 lg:grid-cols-5 gap-3"
        >
          <div className="card-base p-3 text-center">
            <div className="text-xl font-bold text-zinc-100">{lockStats.total}</div>
            <div className="text-[10px] text-zinc-500">总校验</div>
          </div>
          <div className="card-base p-3 text-center">
            <div className="text-xl font-bold text-accent-emerald">{lockStats.passed}</div>
            <div className="text-[10px] text-zinc-500">通过</div>
          </div>
          <div className="card-base p-3 text-center">
            <div className="text-xl font-bold text-accent-rose">{lockStats.blocked}</div>
            <div className="text-[10px] text-zinc-500">阻断</div>
          </div>
          <div className="card-base p-3 text-center">
            <div className="text-xl font-bold text-accent-teal">{lockStats.passRate.toFixed(1)}%</div>
            <div className="text-[10px] text-zinc-500">通过率</div>
          </div>
          <div className="card-base p-3 text-center">
            <div className="text-xl font-bold text-accent-amber">{lockStats.avgDurationMs}ms</div>
            <div className="text-[10px] text-zinc-500">平均耗时</div>
          </div>
        </motion.div>
      )}

      {/* 输入区域 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="card-base p-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-zinc-400 mb-2 block">用户输入（意图）</label>
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              className="input-base min-h-[100px] font-mono text-xs resize-y"
              placeholder="用户的需求..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400 mb-2 block">AI 输出（待校验）</label>
            <textarea
              value={aiOutput}
              onChange={(e) => setAiOutput(e.target.value)}
              className="input-base min-h-[100px] font-mono text-xs resize-y"
              placeholder="AI 生成的输出..."
            />
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500">示例：</span>
            {SAMPLE_INPUTS.map((s, i) => (
              <button
                key={i}
                onClick={() => loadSample(i)}
                className="text-xs px-2 py-1 rounded bg-bg-elevated text-zinc-400 hover:text-accent-emerald hover:bg-bg-hover transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            onClick={runValidationHandler}
            disabled={isRunning || !userInput.trim() || !aiOutput.trim()}
            className="btn-primary"
          >
            {isRunning ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-bg-deep border-t-transparent rounded-full"
                />
                校验中...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                运行校验
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* 校验结果 */}
      <AnimatePresence mode="wait">
        {currentRecord && (
          <motion.div
            key={currentRecord.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="card-base p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {currentRecord.passed ? (
                  <CheckCircle2 className="w-6 h-6 text-accent-emerald" />
                ) : (
                  <XCircle className="w-6 h-6 text-accent-rose" />
                )}
                <div>
                  <h2 className="text-base font-semibold text-zinc-100">
                    {currentRecord.passed ? '✅ 校验通过' : '❌ 校验阻断'}
                  </h2>
                  <p className="text-xs text-zinc-500">
                    总耗时 {currentRecord.totalDurationMs}ms ·{' '}
                    {new Date(currentRecord.timestamp).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportJSONL}
                  disabled={decisionLockHistory.length === 0}
                  className="btn-ghost text-xs disabled:opacity-40"
                >
                  <Download className="w-3 h-3" />
                  JSONL
                </button>
                <button
                  onClick={handleExportMarkdown}
                  disabled={decisionLockHistory.length === 0}
                  className="btn-ghost text-xs disabled:opacity-40"
                >
                  <Download className="w-3 h-3" />
                  Markdown
                </button>
              </div>
            </div>

            {currentRecord.blockedReason && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-4 p-4 rounded-lg bg-accent-rose/10 border border-accent-rose/30 flex items-start gap-3"
              >
                <AlertTriangle className="w-5 h-5 text-accent-rose flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-accent-rose mb-1">输出被阻断</p>
                  <p className="text-xs text-zinc-400">{currentRecord.blockedReason}</p>
                  <a href="#/evolution" className="mt-2 text-xs text-accent-emerald hover:underline flex items-center gap-1 w-fit">
                    <Dna className="w-3 h-3" />
                    触发元进化循环
                  </a>
                </div>
              </motion.div>
            )}

            <div className="space-y-3">
              {currentRecord.stages.map((stage, idx) => {
                const isExpanded = expandedStage === stage.id
                const showBlocked = !stage.passed && stage.durationMs === 0
                return (
                  <div
                    key={stage.id}
                    className={`rounded-lg border transition-all ${
                      stage.passed
                        ? 'border-accent-emerald/30 bg-accent-emerald/5'
                        : showBlocked
                          ? 'border-border-subtle bg-bg-elevated/30 opacity-60'
                          : 'border-accent-rose/30 bg-accent-rose/5'
                    }`}
                  >
                    <button
                      onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
                      className="w-full p-4 flex items-center gap-3 text-left"
                      disabled={showBlocked}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            stage.passed
                              ? 'bg-accent-emerald/20 text-accent-emerald'
                              : 'bg-accent-rose/20 text-accent-rose'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        {stage.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-accent-emerald" />
                        ) : showBlocked ? (
                          <Clock className="w-4 h-4 text-zinc-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-accent-rose" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-100">{stage.name}</span>
                          <span className="text-xs text-zinc-600">{stage.fullName}</span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{stage.description}</p>
                      </div>
                      {stage.durationMs > 0 && (
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {stage.durationMs}ms
                        </span>
                      )}
                      {!showBlocked && (
                        isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-zinc-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-zinc-500" />
                        )
                      )}
                    </button>
                    <AnimatePresence>
                      {isExpanded && !showBlocked && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="px-4 pb-4"
                        >
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2 border-t border-border-subtle">
                            {stage.details.map((detail, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                {detail.ok ? (
                                  <CheckCircle2 className="w-3 h-3 text-accent-emerald flex-shrink-0" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-accent-rose flex-shrink-0" />
                                )}
                                <span className="text-zinc-500">{detail.label}:</span>
                                <span className={detail.ok ? 'text-zinc-200' : 'text-accent-rose font-medium'}>
                                  {detail.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 校验历史 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-base p-5"
      >
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-left"
          >
            <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-500" />
              校验历史（{decisionLockHistory.length} 条）
            </h3>
            {showHistory ? (
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            )}
          </button>
          {decisionLockHistory.length > 0 && (
            <button
              onClick={() => {
                if (confirm(`确定清空 ${decisionLockHistory.length} 条校验历史？`)) {
                  clearDecisionLockHistory()
                  setCurrentRecord(null)
                }
              }}
              className="text-xs text-zinc-500 hover:text-accent-rose flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              清空
            </button>
          )}
        </div>
        <AnimatePresence>
          {showHistory && decisionLockHistory.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 space-y-2 overflow-hidden max-h-96 overflow-y-auto"
            >
              {decisionLockHistory.map((record) => (
                <button
                  key={record.id}
                  onClick={() => { setCurrentRecord(record); setExpandedStage(record.stages[0]?.id || 'ivl') }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-bg-elevated/50 hover:bg-bg-hover transition-colors text-left"
                >
                  {record.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-accent-emerald flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-accent-rose flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 truncate">{record.input}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      {new Date(record.timestamp).toLocaleString('zh-CN')}
                      {record.blockedReason && ` · ${record.blockedReason.slice(0, 50)}`}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-500">{record.totalDurationMs}ms</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
