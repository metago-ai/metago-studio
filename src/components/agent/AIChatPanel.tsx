import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Send, Loader2, Globe, Sparkles, Code2, ChevronDown, ChevronUp,
  AlertCircle, Bot, Wrench, Crown, ArrowRight, Plus,
} from 'lucide-react'
import { ModelSelector } from './ModelSelector'
import { SettingsDialog } from './SettingsDialog'
import { sendChat } from '../../lib/aiClient'
import { checkQuota, type QuotaInfo } from '../../lib/userService'
import { isByokActive, isByokRequired } from '../../lib/byokService'
import { QuotaExhaustedDialog } from './QuotaExhaustedDialog'
import { DEFAULT_MODEL_ID } from '../../lib/modelRegistry'
import { parseReviewIssues } from '../../lib/reviewParser'
import { isDesktop } from '../../lib/fs/fsInterface'
import { getSessionStore } from '../../lib/sessionStore'
import type { ChatMessage, SearchMode, ReviewIssue } from '../../types'
import { useStore } from '../../store/useStore'

interface AIChatPanelProps {
  selectedCode: string
  activeFileName: string | null
  activeFileLanguage: string | null
  selectedLineRange?: { start: number; end: number }
  isPro: boolean
  workspacePath?: string
  workspaceName?: string
  projectType?: string
  activeSkills?: string[]
  /** 当前会话 ID（从历史恢复时传入，用于初始化消息） */
  sessionId?: string
  /** 新建对话回调 */
  onNewChat?: () => void
  /** 会话创建后通知父组件（用于记录 currentSessionId） */
  onSessionCreated?: (id: string) => void
  /** 消息数量变化通知父组件（用于 token 用量显示） */
  onMessageCountChange?: (count: number) => void
  onReviewComplete?: (messageId: string, issues: ReviewIssue[], fullContent: string) => void
  /** 工具调用回调（透传给父组件以更新 Agent 执行步骤面板） */
  onToolCall?: (toolName: string, args: Record<string, unknown>, result: string) => void
  /** 发送消息开始回调（父组件清空步骤并标记 running） */
  onSendStart?: () => void
  /** 发送消息结束回调（父组件取消 running 标记） */
  onSendEnd?: () => void
}

const QUICK_ACTIONS = [
  { id: 'review', label: '代码审查', icon: Code2, prompt: '请审查选中的代码，按 Critical/Major/Minor/Info 分级指出所有问题。' },
  { id: 'security', label: '安全审计', icon: AlertCircle, prompt: '请对选中的代码进行安全审计，按 OWASP Top 10 检查漏洞。' },
  { id: 'optimize', label: '性能优化', icon: Sparkles, prompt: '请分析选中代码的性能瓶颈，并给出优化建议。' },
  { id: 'explain', label: '解释代码', icon: Bot, prompt: '请解释这段代码的作用、关键逻辑和潜在问题。' },
]

const FREE_DAILY_TOKEN_QUOTA = 100_000

export function AIChatPanel({
  selectedCode, activeFileName, activeFileLanguage, selectedLineRange,
  isPro, workspacePath, workspaceName, projectType, activeSkills,
  sessionId, onNewChat, onSessionCreated, onMessageCountChange,
  onReviewComplete, onToolCall, onSendStart, onSendEnd,
}: AIChatPanelProps) {
  // 当前 AI 数字员工角色（影响 system prompt）
  const currentRoleId = useStore(s => s.currentRoleId)
  // 消息初始化：如果有 sessionId（从历史恢复），从 sessionStore 加载该会话消息
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (sessionId) {
      try {
        const store = getSessionStore()
        const all = store.getAll()
        const session = all.find(s => s.id === sessionId)
        return session?.messages ?? []
      } catch { return [] }
    }
    return []
  })
  // 当前会话 ID（ref 避免闭包陷阱）
  const currentSessionIdRef = useRef<string | undefined>(sessionId)
  // sessionId 变化时（点击历史会话 / 新建对话）重新加载消息
  useEffect(() => {
    if (sessionId) {
      try {
        const store = getSessionStore()
        const all = store.getAll()
        const session = all.find(s => s.id === sessionId)
        setMessages(session?.messages ?? [])
      } catch { setMessages([]) }
    } else {
      setMessages([])
    }
    // 重置 ref，避免闭包引用旧 session
    currentSessionIdRef.current = sessionId
  }, [sessionId])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID)
  const [searchMode, setSearchMode] = useState<SearchMode>('auto')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toolActivity, setToolActivity] = useState<Array<{ name: string; status: 'running' | 'done' }>>([])
  // 配额 V2：基于 Token（已登录走 tokenMeter→云端，未登录降级 localStorage 10万/天）
  const [quota, setQuota] = useState<QuotaInfo>({ remaining: FREE_DAILY_TOKEN_QUOTA, total: FREE_DAILY_TOKEN_QUOTA, used: 0, tier: 'free', isUnlimited: false, period: 'day', byokActive: false })
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false)
  const navigate = useNavigate()

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 会话持久化：messages 变化时立即写入 sessionStore（同步，避免组件卸载丢失数据）
  useEffect(() => {
    if (messages.length === 0) return
    const store = getSessionStore()
    let sid = currentSessionIdRef.current
    if (!sid) {
      // 首条消息时创建新会话
      const firstUserMsg = messages.find(m => m.role === 'user')
      const title = firstUserMsg ? firstUserMsg.content.slice(0, 30) : '新会话'
      const session = store.create(title, workspaceName)
      sid = session.id
      currentSessionIdRef.current = sid
      // 异步通知父组件（不阻塞当前渲染周期，避免引发重挂载时序问题）
      const sidCopy = sid
      queueMicrotask(() => onSessionCreated?.(sidCopy))
    }
    // 立即同步持久化（不使用防抖，避免在异步流程中被丢失）
    store.updateMessages(sid, messages)
  }, [messages, workspaceName, onSessionCreated])

  // 通知父组件消息数量变化（用于 token 用量显示）
  useEffect(() => {
    onMessageCountChange?.(messages.length)
  }, [messages.length, onMessageCountChange])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const q = await checkQuota()
        if (!cancelled) setQuota(q)
      } catch { /* 降级方案已由 userService 内部处理 */ }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // V2: 配额判断基于 Token + tier + BYOK
  // - isPro 仅用于解锁 QUICK_ACTIONS 等付费功能，不再等同于无限额度
  // - isUnlimited: 仅 BYOK 激活或 Enterprise 强制 BYOK 时为 true（其他档位均按 Token 配额计量）
  // - remaining: 剩余 Token 数（已自动处理 Infinity）
  const isUnlimited = quota.isUnlimited || isByokActive() || isByokRequired()
  const remainingQuota = isUnlimited ? Infinity : Math.max(0, quota.remaining)

  const handleSend = useCallback(async (overridePrompt?: string) => {
    const prompt = overridePrompt ?? input.trim()
    if (!prompt || loading) return

    if (!isUnlimited && remainingQuota <= 0) {
      // V2: 弹出配额耗尽弹窗（Free 升级提示 / Pro 三选一）
      setQuotaDialogOpen(true)
      return
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    }

    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      streaming: true,
      modelId,
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setLoading(true)
    setToolActivity([])
    onSendStart?.()

    try {
      const result = await sendChat({
        messages: [...messages, userMsg],
        modelId,
        searchMode,
        envContext: {
          workspacePath,
          workspaceName,
          projectType,
          activeFileName: activeFileName ?? undefined,
          activeFileLanguage: activeFileLanguage ?? undefined,
          selectedCode,
          selectedLineRange,
          activeSkills,
          isDesktop: isDesktop(),
          currentRoleId,
        },
        onToken: (token) => {
          setMessages(prev => prev.map(m =>
            m.id === assistantMsg.id ? { ...m, content: m.content + token } : m
          ))
        },
        onReasoning: (token) => {
          setMessages(prev => prev.map(m =>
            m.id === assistantMsg.id ? { ...m, reasoning: (m.reasoning ?? '') + token } : m
          ))
        },
        onToolCall: (toolName, args, result) => {
          setToolActivity(prev => [...prev, { name: toolName, status: 'done' }])
          onToolCall?.(toolName, args, result)
        },
      })

      setMessages(prev => prev.map(m =>
        m.id === assistantMsg.id
          ? {
            ...m,
            content: result.content,
            reasoning: result.reasoning,
            searchResults: result.searchResults,
            streaming: false,
            modelId: result.modelId,
          }
          : m
      ))

      if (onReviewComplete && result.content) {
        const issues = parseReviewIssues(result.content, activeFileName ?? undefined)
        onReviewComplete(assistantMsg.id, issues, result.content)
      }

      // V2: Token 上报已由 aiClient.sendChat 内部自动调用 tokenMeter.recordUsage
      // 这里只需刷新本地配额显示（tokenMeter 已写入 localStorage，下次 checkQuota 会读取）
      if (!isUnlimited) {
        // 乐观更新：从下次 checkQuota 拿到准确值
        setQuota(prev => ({
          ...prev,
          used: prev.used + 1, // 占位，真实 Token 由 checkQuota 刷新
          remaining: Math.max(0, prev.remaining - 1),
        }))
      }
      checkQuota().then(setQuota).catch(() => {})
    } catch (e: any) {
      setMessages(prev => prev.map(m =>
        m.id === assistantMsg.id
          ? { ...m, streaming: false, error: e?.message || '调用失败' }
          : m
      ))
    } finally {
      setLoading(false)
      setToolActivity([])
      onSendEnd?.()
    }
  }, [input, loading, messages, modelId, searchMode, selectedCode, activeFileName,
      activeFileLanguage, selectedLineRange, isPro, workspacePath, workspaceName,
      projectType, activeSkills, onReviewComplete, onToolCall, onSendStart, onSendEnd,
      remainingQuota, isUnlimited])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部：模型选择 + 配额 + 新建对话 */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-border-subtle bg-bg-deep/50">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <ModelSelector
              value={modelId}
              onChange={setModelId}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </div>
          <SearchModeToggle mode={searchMode} onChange={setSearchMode} />
          {onNewChat && (
            <button
              onClick={onNewChat}
              disabled={loading}
              title="新建对话"
              className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent-emerald/15 text-accent-emerald hover:bg-accent-emerald/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {/* 配额显示 */}
        <div className="mt-1 flex items-center gap-2 text-[10px]">
          {isUnlimited ? (
            <span className="flex items-center gap-1 text-accent-amber">
              <Crown className="w-3.5 h-3.5" />
              {isByokActive() ? 'BYOK · 无限' : isByokRequired() ? 'Enterprise · BYOK' : 'Pro · 无限'}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-zinc-500">
              {quota.period === 'day' ? '今日' : '本月'}剩余{' '}
              <span className={remainingQuota > 30000 ? 'text-zinc-300' : 'text-orange-400'}>
                {formatTokenNum(remainingQuota)}
              </span>
              {' '}/ {formatTokenNum(quota.total)} tokens
              {remainingQuota <= 30000 && (
                <button
                  onClick={() => navigate('/pro')}
                  className="ml-1 text-accent-amber hover:underline flex items-center gap-0.5"
                >
                  升级 Pro <ArrowRight className="w-2.5 h-2.5" />
                </button>
              )}
            </span>
          )}
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 ? <EmptyState hasWorkspace={Boolean(workspacePath)} /> : (
          messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 工具调用进度 */}
      {toolActivity.length > 0 && (
        <div className="flex-shrink-0 px-3 py-1.5 border-t border-border-subtle bg-bg-deep/30">
          {toolActivity.map((t, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px] text-accent-emerald">
              <Wrench className="w-2.5 h-2.5" />
              <span className="font-mono">{t.name}</span>
              <span className="text-zinc-500">已完成</span>
            </div>
          ))}
        </div>
      )}

      {/* 快捷操作 */}
      {selectedCode && (
        <div className="flex-shrink-0 px-3 py-1.5 border-t border-border-subtle flex gap-1 overflow-x-auto">
          {QUICK_ACTIONS.map(action => {
            const Icon = action.icon
            return (
              <button
                key={action.id}
                onClick={() => handleSend(action.prompt)}
                disabled={loading}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-bg-deep border border-border-subtle text-zinc-300 hover:border-accent-emerald/30 hover:text-accent-emerald transition-colors whitespace-nowrap disabled:opacity-50"
              >
                <Icon className="w-3 h-3" />
                {action.label}
              </button>
            )
          })}
        </div>
      )}

      {/* 输入框 */}
      <div className="flex-shrink-0 p-3 border-t border-border-subtle">
        {selectedCode && (
          <div className="mb-1.5 px-2 py-1 rounded bg-accent-emerald/10 border border-accent-emerald/20 text-[10px] text-accent-emerald">
            已选中：{activeFileName}{selectedLineRange ? `:${selectedLineRange.start}-${selectedLineRange.end}` : ''}（{selectedCode.split('\n').length} 行）
          </div>
        )}
        <div className="relative">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={workspacePath ? "输入问题，我可以直接读写你的文件..." : "打开工作区后，我可以直接操作你的代码..."}
            rows={2}
            disabled={loading || (!isUnlimited && remainingQuota <= 0)}
            className="w-full px-3 py-2 pr-10 bg-bg-deep border border-border-subtle rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent-emerald/50 resize-none disabled:opacity-60"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim() || (!isUnlimited && remainingQuota <= 0)}
            className="absolute right-2 bottom-2 w-7 h-7 flex items-center justify-center rounded-lg bg-accent-emerald/15 text-accent-emerald hover:bg-accent-emerald/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* V2: 配额耗尽弹窗（Free 升级提示 / Pro 三选一：暂停/按量/BYOK） */}
      <QuotaExhaustedDialog
        open={quotaDialogOpen}
        onClose={() => setQuotaDialogOpen(false)}
        used={quota.used}
        total={quota.total}
        period={quota.period === 'year' ? 'month' : quota.period}
        onUpgradePro={() => {
          setQuotaDialogOpen(false)
          navigate('/pro')
        }}
        onBindByok={() => {
          setQuotaDialogOpen(false)
          navigate('/pro?tab=byok')
        }}
        onAcceptOverage={() => {
          // V2 后续接入支付系统，当前版本仅关闭弹窗并提示
          setQuotaDialogOpen(false)
          alert('按量付费功能即将上线，敬请期待。当前可绑定自己的 API Key 继续。')
        }}
      />
    </div>
  )
}

/** Token 数字格式化：100000 → 100K，5000000 → 5M */
function formatTokenNum(n: number): string {
  if (!isFinite(n)) return '∞'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function EmptyState({ hasWorkspace }: { hasWorkspace: boolean }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-8">
      <div className="w-12 h-12 rounded-full bg-accent-emerald/10 flex items-center justify-center mb-3">
        <Bot className="w-6 h-6 text-accent-emerald" />
      </div>
      <h3 className="text-sm font-medium text-zinc-300 mb-1">MetaGO Agent</h3>
      <p className="text-[11px] text-zinc-500 max-w-[260px] leading-relaxed">
        {hasWorkspace
          ? '我是你的开发智能体。我可以直接读写文件、搜索代码、运行 Git 操作、执行深度代码审查。告诉我你想做什么。'
          : '打开工作区后，我可以直接操作你的代码。我拥有 39 个 MCP 工具和 39 个元构技能。'}
      </p>
      <div className="mt-3 flex flex-wrap gap-1 justify-center">
        <span className="px-1.5 py-0.5 text-[9px] rounded bg-bg-deep text-zinc-500 border border-border-subtle">读取文件</span>
        <span className="px-1.5 py-0.5 text-[9px] rounded bg-bg-deep text-zinc-500 border border-border-subtle">跨文件搜索</span>
        <span className="px-1.5 py-0.5 text-[9px] rounded bg-bg-deep text-zinc-500 border border-border-subtle">Git 操作</span>
        <span className="px-1.5 py-0.5 text-[9px] rounded bg-bg-deep text-zinc-500 border border-border-subtle">代码审查</span>
        <span className="px-1.5 py-0.5 text-[9px] rounded bg-bg-deep text-zinc-500 border border-border-subtle">安全审计</span>
      </div>
    </div>
  )
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const [showReasoning, setShowReasoning] = useState(false)
  const isUser = msg.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[90%] ${isUser ? 'order-2' : ''}`}>
        {msg.reasoning && (
          <div className="mb-1.5">
            <button
              onClick={() => setShowReasoning(!showReasoning)}
              className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              {showReasoning ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              思考过程
            </button>
            {showReasoning && (
              <div className="mt-1 px-2.5 py-1.5 bg-bg-deep border border-border-subtle rounded text-[10px] text-zinc-400 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                {msg.reasoning}
              </div>
            )}
          </div>
        )}

        {msg.searchResults && msg.searchResults.length > 0 && (
          <div className="mb-1.5 px-2.5 py-1.5 bg-accent-blue/5 border border-accent-blue/20 rounded">
            <div className="flex items-center gap-1 text-[10px] text-accent-blue mb-1">
              <Globe className="w-3 h-3" />
              已联网搜索（{msg.searchResults.length} 条结果）
            </div>
            <div className="space-y-0.5">
              {msg.searchResults.slice(0, 3).map((r, i) => (
                <div key={i} className="text-[10px] text-zinc-500 truncate">[{i + 1}] {r.title}</div>
              ))}
            </div>
          </div>
        )}

        <div className={`px-3 py-2 rounded-lg text-xs ${
          isUser
            ? 'bg-accent-emerald/15 text-zinc-100'
            : msg.error
              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
              : 'bg-bg-deep text-zinc-200 border border-border-subtle'
        }`}>
          {msg.error ? (
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {msg.error}
            </div>
          ) : msg.streaming && !msg.content ? (
            <div className="flex items-center gap-1.5 text-zinc-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              正在分析...
            </div>
          ) : (
            <div className="whitespace-pre-wrap break-words">{msg.content}</div>
          )}
        </div>

        {!isUser && !msg.streaming && !msg.error && (
          <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-600">
            {msg.modelId && <span>{msg.modelId}</span>}
            <span>{new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function SearchModeToggle({ mode, onChange }: { mode: SearchMode; onChange: (m: SearchMode) => void }) {
  const next: Record<SearchMode, SearchMode> = { auto: 'always', always: 'never', never: 'auto' }
  const labels: Record<SearchMode, { text: string; color: string }> = {
    auto: { text: '自动', color: 'text-zinc-400' },
    always: { text: '联网', color: 'text-accent-blue' },
    never: { text: '离线', color: 'text-zinc-600' },
  }
  const cfg = labels[mode]
  return (
    <button
      onClick={() => onChange(next[mode])}
      className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium bg-bg-deep border border-border-subtle ${cfg.color} hover:bg-bg-hover transition-colors`}
      title={`联网模式：${cfg.text}`}
    >
      <Globe className="w-3 h-3" />
      {cfg.text}
    </button>
  )
}
