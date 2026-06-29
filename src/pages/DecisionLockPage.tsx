import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Download,
  Share2,
  AlertTriangle,
  Dna,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { SUCCESS_RECORD, BLOCKED_RECORD } from '../data/decisionLock'
import type { DecisionLockRecord } from '../types'

const SAMPLE_INPUTS = [
  '请审查：const query = "SELECT * FROM users WHERE id = " + userInput',
  '请重构这段代码（实际意图是代码审查）',
  '请评估技术选型：PostgreSQL vs MongoDB',
]

export function DecisionLockPage() {
  const { decisionLockHistory } = useStore()
  const [input, setInput] = useState(SAMPLE_INPUTS[0])
  const [currentRecord, setCurrentRecord] = useState<DecisionLockRecord>(SUCCESS_RECORD)
  const [isRunning, setIsRunning] = useState(false)
  const [expandedStage, setExpandedStage] = useState<string | null>('ivl')
  const [showHistory, setShowHistory] = useState(false)

  const runValidation = () => {
    setIsRunning(true)
    setExpandedStage(null)
    setTimeout(() => {
      const isBlocked = input.includes('重构') && input.includes('审查')
      setCurrentRecord(isBlocked ? BLOCKED_RECORD : SUCCESS_RECORD)
      setIsRunning(false)
      setExpandedStage(isBlocked ? 'ivl' : 'ivl')
    }, 1200)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Shield className="w-6 h-6 text-accent-emerald" />
          决策锁可视化
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          四道关卡：意图验证(IVL) → 意图谱系追踪(ILT) → 语义输出门(OSG) → 完整性校验
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="card-base p-5"
      >
        <label className="text-xs font-medium text-zinc-400 mb-2 block">输入内容</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="input-base min-h-[80px] font-mono text-xs resize-y"
          placeholder="输入需要校验的内容..."
        />
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500">示例：</span>
            {SAMPLE_INPUTS.map((s, i) => (
              <button
                key={i}
                onClick={() => setInput(s)}
                className="text-xs px-2 py-1 rounded bg-bg-elevated text-zinc-400 hover:text-accent-emerald hover:bg-bg-hover transition-colors"
              >
                示例 {i + 1}
              </button>
            ))}
          </div>
          <button
            onClick={runValidation}
            disabled={isRunning || !input.trim()}
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

      <AnimatePresence mode="wait">
        {currentRecord && (
          <motion.div
            key={currentRecord.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
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
                    {currentRecord.passed ? '校验通过' : '校验阻断'}
                  </h2>
                  <p className="text-xs text-zinc-500">
                    总耗时 {currentRecord.totalDurationMs}ms ·{' '}
                    {new Date(currentRecord.timestamp).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-ghost text-xs">
                  <Download className="w-3 h-3" />
                  导出报告
                </button>
                <button className="btn-ghost text-xs">
                  <Share2 className="w-3 h-3" />
                  分享
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
                  <button className="mt-2 text-xs text-accent-emerald hover:underline flex items-center gap-1">
                    <Dna className="w-3 h-3" />
                    查看元进化过程
                  </button>
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
                              <div
                                key={i}
                                className="flex items-center gap-2 text-xs"
                              >
                                {detail.ok ? (
                                  <CheckCircle2 className="w-3 h-3 text-accent-emerald flex-shrink-0" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-accent-rose flex-shrink-0" />
                                )}
                                <span className="text-zinc-500">{detail.label}:</span>
                                <span
                                  className={
                                    detail.ok ? 'text-zinc-200' : 'text-accent-rose font-medium'
                                  }
                                >
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

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="card-base p-5"
      >
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between text-left"
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
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 space-y-2 overflow-hidden"
            >
              {decisionLockHistory.map((record) => (
                <button
                  key={record.id}
                  onClick={() => setCurrentRecord(record)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-bg-elevated/50 hover:bg-bg-hover transition-colors text-left"
                >
                  {record.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-accent-emerald flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-accent-rose flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 truncate">{record.input}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">{record.timestamp}</p>
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
