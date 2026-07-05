/**
 * 上下文窗口可视化面板
 *
 * 显示 AI 当前能看到的所有上下文信息：
 * - 系统提示词
 * - 项目规则
 * - 对话历史
 * - 选中代码
 * - token 用量
 */

import { Brain, FileText, MessageSquare, Code2, Shield } from 'lucide-react'
import { getMemoryManager } from '../../lib/memoryManager'

interface ContextPanelProps {
  /** 当前选中的代码行数 */
  selectedCodeLines: number
  /** 消息数 */
  messageCount: number
}

/** 上下文窗口可视化 */
export function ContextPanel({ selectedCodeLines, messageCount }: ContextPanelProps) {
  const memory = getMemoryManager()
  const totalTokens = memory.getTotalTokens()
  const maxTokens = 200000
  const percent = Math.min(Math.round((totalTokens / maxTokens) * 100), 100)

  const projectMemory = memory.getProjectMemory()

  // 各部分 token 估算
  const systemPromptTokens = 500
  const rulesTokens = projectMemory?.rules ? memory.countTokens(projectMemory.rules.content) : 0
  const structureTokens = projectMemory?.structureSummary ? memory.countTokens(projectMemory.structureSummary) : 0
  const messagesTokens = totalTokens
  const codeTokens = selectedCodeLines * 8  // 约每行 8 token

  const segments = [
    { label: '系统提示', tokens: systemPromptTokens, color: 'bg-zinc-500', icon: Shield },
    { label: '项目规则', tokens: rulesTokens, color: 'bg-accent-emerald', icon: FileText },
    { label: '项目结构', tokens: structureTokens, color: 'bg-accent-teal', icon: Brain },
    { label: '对话历史', tokens: messagesTokens, color: 'bg-accent-blue', icon: MessageSquare },
    { label: '选中代码', tokens: codeTokens, color: 'bg-orange-400', icon: Code2 },
  ]

  return (
    <div className="space-y-2">
      {/* token 用量条 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-zinc-500 flex items-center gap-1">
            <Brain className="w-3 h-3" />
            上下文窗口
          </span>
          <span className={`text-[10px] font-mono ${percent > 80 ? 'text-orange-400' : 'text-zinc-400'}`}>
            {(totalTokens / 1000).toFixed(1)}K / {maxTokens / 1000}K ({percent}%)
          </span>
        </div>
        {/* 堆叠进度条 */}
        <div className="h-2 rounded-full bg-bg-deep overflow-hidden flex">
          {segments.map((seg) => {
            const segPercent = Math.min((seg.tokens / maxTokens) * 100, 100)
            if (segPercent < 0.1) return null
            return (
              <div
                key={seg.label}
                className={seg.color}
                style={{ width: `${segPercent}%` }}
                title={`${seg.label}: ${seg.tokens} tokens`}
              />
            )
          })}
        </div>
      </div>

      {/* 明细 */}
      <div className="space-y-0.5">
        {segments.map((seg) => {
          const Icon = seg.icon
          return (
            <div key={seg.label} className="flex items-center gap-2 text-[10px]">
              <Icon className="w-2.5 h-2.5 text-zinc-500" />
              <span className="text-zinc-400 flex-1">{seg.label}</span>
              <span className="text-zinc-500 font-mono">
                {seg.tokens > 0 ? `${(seg.tokens / 1000).toFixed(1)}K` : '—'}
              </span>
            </div>
          )
        })}
      </div>

      {/* 消息数 */}
      <div className="flex items-center justify-between text-[10px] text-zinc-500 border-t border-border-subtle pt-1">
        <span>对话消息</span>
        <span className="font-mono">{messageCount} 条</span>
      </div>

      {/* 压缩提示 */}
      {percent > 60 && (
        <div className="px-2 py-1 rounded bg-orange-500/10 border border-orange-500/20 text-[10px] text-orange-400">
          {percent > 80 ? '⚠️ 接近上限，建议清理对话' : '上下文用量较高'}
        </div>
      )}
    </div>
  )
}
