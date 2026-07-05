import React, { useState } from 'react'
import { Loader2, CheckCircle2, XCircle, Circle, ChevronRight, Zap, Trash2 } from 'lucide-react'

// 内联类型定义（原 agentLoop.ts 已删除，这里是唯一使用方）
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface AgentStep {
  id: string
  index: number
  action: string
  params: Record<string, unknown>
  result?: unknown
  error?: string
  status: StepStatus
  reasoning?: string
  timestamp: string
}

interface TodoPanelProps {
  steps: AgentStep[]
  running: boolean
  onAbort?: () => void
  /** 清空步骤列表 */
  onClear?: () => void
}

/** Agent 执行步骤可视化面板 */
export function TodoPanel({ steps, running, onAbort, onClear }: TodoPanelProps) {
  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-border-subtle bg-bg-deep/50">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-accent-emerald" />
          <span className="text-xs font-medium text-zinc-300">Agent 执行计划</span>
          {steps.length > 0 && (
            <span className="text-[10px] text-zinc-500">
              {steps.filter(s => s.status === 'completed').length}/{steps.length} 步完成
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {running && onAbort && (
            <button
              onClick={onAbort}
              className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
            >
              停止
            </button>
          )}
          {!running && steps.length > 0 && onClear && (
            <button
              onClick={onClear}
              title="清空步骤列表"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-bg-hover text-zinc-400 border border-border-subtle hover:text-zinc-200 hover:border-zinc-500"
            >
              <Trash2 className="w-2.5 h-2.5" />
              清除
            </button>
          )}
        </div>
      </div>

      {/* 步骤列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {steps.length === 0 && !running && (
          <div className="text-center py-4 text-[11px] text-zinc-600">
            发送"自主执行"类指令后，AI 的步骤将显示在此
          </div>
        )}

        {steps.map((step) => (
          <StepItem key={step.id} step={step} />
        ))}

        {running && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-zinc-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            AI 正在思考下一步...
          </div>
        )}
      </div>
    </div>
  )
}

function StepItem({ step }: { step: AgentStep }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetails = Boolean(step.result || step.error)

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-deep/30 overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <StepIcon status={step.status} />
        <span className="text-[10px] text-zinc-500">#{step.index}</span>
        <span className="text-[11px] font-medium text-zinc-200 flex-1 truncate">
          {step.action || '思考中'}
        </span>
        {hasDetails && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-zinc-500 hover:text-zinc-300"
          >
            <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        )}
      </div>

      {/* 思考说明 */}
      {step.reasoning && (
        <div className="px-2 pb-1 text-[10px] text-zinc-500 leading-relaxed">
          {step.reasoning}
        </div>
      )}

      {/* 展开详情 */}
      {expanded && hasDetails && (
        <div className="px-2 pb-2 border-t border-border-subtle pt-1.5">
          {step.params && Object.keys(step.params).length > 0 && (
            <div className="mb-1">
              <div className="text-[9px] text-zinc-600 mb-0.5">参数</div>
              <pre className="text-[10px] text-zinc-400 bg-bg-deep rounded p-1.5 overflow-x-auto font-mono max-h-24">
                {JSON.stringify(step.params, null, 2)}
              </pre>
            </div>
          )}
          {step.result != null && (
            <div className="mb-1">
              <div className="text-[9px] text-accent-emerald mb-0.5">结果</div>
              <pre className="text-[10px] text-zinc-400 bg-bg-deep rounded p-1.5 overflow-x-auto font-mono max-h-32">
                {typeof step.result === 'string' ? step.result : JSON.stringify(step.result, null, 2) as React.ReactNode}
              </pre>
            </div>
          )}
          {step.error && (
            <div>
              <div className="text-[9px] text-red-400 mb-0.5">错误</div>
              <pre className="text-[10px] text-red-400 bg-red-500/5 rounded p-1.5">
                {step.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-3.5 h-3.5 text-accent-emerald flex-shrink-0" />
    case 'failed':
      return <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
    case 'running':
      return <Loader2 className="w-3.5 h-3.5 text-accent-blue animate-spin flex-shrink-0" />
    default:
      return <Circle className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
  }
}
