import { useState } from 'react'
import {
  Shield, ChevronDown, ChevronUp, MapPin, AlertTriangle,
  CheckCircle2, Info, AlertOctagon, Lightbulb, Code,
} from 'lucide-react'
import type { ReviewIssue, ReviewSession, Severity } from '../../types'
import { countBySeverity } from '../../lib/reviewParser'

interface ReviewBoardProps {
  /** 当前审查会话（最近一次 AI 审查结果） */
  session: ReviewSession | null
  /** 决策锁是否通过 */
  decisionLockPassed?: boolean
  /** 决策锁阻断原因 */
  decisionLockReason?: string
  /** 点击问题项的回调（跳转到代码位置） */
  onJumpToIssue: (issue: ReviewIssue) => void
}

const SEVERITY_CONFIG: Record<Severity, {
  label: string
  color: string
  bg: string
  border: string
  icon: typeof AlertOctagon
}> = {
  critical: {
    label: 'Critical',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: AlertOctagon,
  },
  major: {
    label: 'Major',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    icon: AlertTriangle,
  },
  minor: {
    label: 'Minor',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    icon: Info,
  },
  info: {
    label: 'Info',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    icon: Lightbulb,
  },
}

/** 决策锁审查看板 */
export function ReviewBoard({
  session, decisionLockPassed, decisionLockReason, onJumpToIssue,
}: ReviewBoardProps) {
  const [collapsed, setCollapsed] = useState(false)

  const issues = session?.issues ?? []
  const counts = countBySeverity(issues)
  const totalIssues = issues.length

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full px-3 py-2 border-b border-border-subtle bg-bg-deep/50 hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Shield className={`w-3.5 h-3.5 ${decisionLockPassed === false ? 'text-red-400' : 'text-accent-emerald'}`} />
          <span className="text-xs font-medium text-zinc-300">决策锁审查看板</span>
          <span title="只在点击「代码审查」或「安全审计」按钮时激活。AI 审查代码后在下方列出 Critical/Major/Minor/Info 四级问题，可点击跳转到代码位置。" className="text-[10px] text-zinc-600 cursor-help border border-zinc-700 rounded-full w-3.5 h-3.5 flex items-center justify-center">?</span>
          {totalIssues > 0 && (
            <span className="text-[10px] text-zinc-500 px-1.5 py-0.5 rounded bg-bg-deep border border-border-subtle">
              {totalIssues} 项问题
            </span>
          )}
        </div>
        {collapsed ? (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
        )}
      </button>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {/* 决策锁状态 */}
          {decisionLockPassed !== undefined && (
            <DecisionLockStatus passed={decisionLockPassed} reason={decisionLockReason} />
          )}

          {/* 空状态 */}
          {!session && (
            <div className="text-center py-6 text-[11px] text-zinc-600 px-2">
              <Shield className="w-6 h-6 mx-auto mb-2 opacity-30" />
              <p className="mb-1">点击上方工具栏 <span className="text-accent-emerald">代码审查</span> 或 <span className="text-accent-emerald">安全审计</span> 按钮，AI 会审查选中代码并在下方显示结构化问题列表。</p>
              <p className="text-[10px] text-zinc-700 mt-2">问题按 Critical / Major / Minor / Info 四级分级，可点击定位到代码位置。</p>
            </div>
          )}

          {/* 统计条 */}
          {totalIssues > 0 && (
            <div className="flex gap-1 px-1">
              {(['critical', 'major', 'minor', 'info'] as Severity[]).map(sev => {
                const cfg = SEVERITY_CONFIG[sev]
                const count = counts[sev]
                if (count === 0) return null
                return (
                  <div
                    key={sev}
                    className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-medium ${cfg.bg} ${cfg.color} border ${cfg.border}`}
                  >
                    <cfg.icon className="w-3 h-3" />
                    {count}
                  </div>
                )
              })}
            </div>
          )}

          {/* 问题列表 */}
          {issues.map((issue, idx) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              index={idx + 1}
              onJump={() => onJumpToIssue(issue)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============ 子组件：决策锁状态 ============

function DecisionLockStatus({ passed, reason }: { passed: boolean; reason?: string }) {
  return (
    <div className={`px-2.5 py-1.5 rounded-lg border flex items-start gap-1.5 ${
      passed
        ? 'bg-accent-emerald/5 border-accent-emerald/20'
        : 'bg-red-500/5 border-red-500/20'
    }`}>
      {passed ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-accent-emerald flex-shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div className={`text-[10px] font-medium ${passed ? 'text-accent-emerald' : 'text-red-400'}`}>
          决策锁 {passed ? '已通过' : '已阻断'}
        </div>
        {!passed && reason && (
          <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">
            {reason}
          </div>
        )}
      </div>
    </div>
  )
}

// ============ 子组件：问题卡片 ============

function IssueCard({ issue, index, onJump }: {
  issue: ReviewIssue
  index: number
  onJump: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = SEVERITY_CONFIG[issue.severity]
  const Icon = cfg.icon
  const hasLocation = Boolean(issue.fileName && issue.lineRange)
  const hasDetails = Boolean(issue.suggestion || issue.rationale)

  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} overflow-hidden`}>
      {/* 头部：等级 + 定位 + 展开 */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${cfg.color}`} />
        <span className={`text-[10px] font-bold ${cfg.color}`}>#{index}</span>
        <span className={`text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>

        {/* 定位（可点击跳转） */}
        {hasLocation && (
          <button
            onClick={onJump}
            className="flex items-center gap-0.5 ml-auto text-[10px] text-zinc-400 hover:text-accent-emerald transition-colors"
            title="点击跳转到代码位置"
          >
            <MapPin className="w-3 h-3" />
            {issue.fileName}{issue.lineRange && `:${issue.lineRange.start}${issue.lineRange.end !== issue.lineRange.start ? `-${issue.lineRange.end}` : ''}`}
          </button>
        )}

        {hasDetails && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-zinc-500 hover:text-zinc-300 ml-1"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* 描述 */}
      <div className="px-2.5 pb-1.5 text-[11px] text-zinc-300 leading-relaxed">
        {issue.description}
      </div>

      {/* 展开内容：修复建议 + 原理 */}
      {expanded && hasDetails && (
        <div className="px-2.5 pb-2 space-y-1.5 border-t border-border-subtle pt-1.5">
          {issue.suggestion && (
            <div>
              <div className="flex items-center gap-1 text-[10px] text-accent-emerald mb-0.5">
                <Code className="w-3 h-3" />
                修复建议
              </div>
              <pre className="text-[10px] text-zinc-300 bg-bg-deep rounded p-1.5 overflow-x-auto whitespace-pre-wrap font-mono max-h-40">
                {issue.suggestion}
              </pre>
            </div>
          )}
          {issue.rationale && (
            <div>
              <div className="flex items-center gap-1 text-[10px] text-blue-400 mb-0.5">
                <Info className="w-3 h-3" />
                原理说明
              </div>
              <div className="text-[10px] text-zinc-400 leading-relaxed">
                {issue.rationale}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
