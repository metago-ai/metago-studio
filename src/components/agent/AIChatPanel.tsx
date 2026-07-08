import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Send, Loader2, Globe, Sparkles, Code2, ChevronDown, ChevronUp,
  AlertCircle, Bot, Wrench, Crown, ArrowRight, Plus, Image as ImageIcon, X,
  Copy, Check, FilePlus, CornerDownRight, History, Settings,
} from 'lucide-react'
import { ModelSelector } from './ModelSelector'
import { SettingsHub } from './SettingsHub'
import { MentionPopover, detectMentionTrigger, type MentionItem } from './MentionPopover'
import { sendChat, type ImageAttachment } from '../../lib/aiClient'
import { checkQuota, type QuotaInfo } from '../../lib/userService'
import { isByokActive, isByokRequired } from '../../lib/byokService'
import { QuotaExhaustedDialog } from './QuotaExhaustedDialog'
import { DEFAULT_MODEL_ID } from '../../lib/modelRegistry'
import { parseReviewIssues } from '../../lib/reviewParser'
import { isDesktop } from '../../lib/fs/fsInterface'
import { getFS } from '../../lib/fs/fsInterface'
import { getSessionStore } from '../../lib/sessionStore'
import { AGENT_TOOLS } from '../../lib/agent/systemPrompt'
import { MCP_TOOLS } from '../../lib/mcpRegistry'
import { parseAgentMentions, type CustomAgent } from '../../lib/settingsStore'
import { getGitStatus } from '../../lib/git/gitProvider'
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
  { id: 'review', label: '代码审查', icon: Code2, prompt: '请审查选中的代码，按 Critical/Major/Minor/Info 分级指出所有问题。', isReview: true },
  { id: 'security', label: '安全审计', icon: AlertCircle, prompt: '请对选中的代码进行安全审计，按 OWASP Top 10 检查漏洞。', isReview: true },
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
  // 监听 license 变化（授权码激活后自动刷新配额）
  const license = useStore(s => s.license)
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
  const [toolActivity, setToolActivity] = useState<Array<{
    name: string
    status: 'running' | 'done'
    args?: Record<string, unknown>
    resultPreview?: string
    duration?: number
    startTime?: number
  }>>([])
  // V3: 多模态图片附件
  const [attachments, setAttachments] = useState<ImageAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  // 审查看板触发追踪：只有用户点击"代码审查"/"安全审计"快捷按钮时才触发
  const isReviewRequestRef = useRef(false)
  // 配额 V2：基于 Token（已登录走 tokenMeter→云端，未登录降级 localStorage 10万/天）
  const [quota, setQuota] = useState<QuotaInfo>({ remaining: FREE_DAILY_TOKEN_QUOTA, total: FREE_DAILY_TOKEN_QUOTA, used: 0, tier: 'free', isUnlimited: false, period: 'day', byokActive: false })
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false)
  const navigate = useNavigate()

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // V3 对标 Trae @Builder / #Web：提及弹出框状态
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [mentionState, setMentionState] = useState<{
    trigger: '@' | '#'
    query: string
    startPos: number
    position: { top: number; left: number }
  } | null>(null)

  /**
   * 检测 textarea 中光标位置是否触发 @ 或 # 提及
   * 触发时计算弹出框位置（基于光标坐标）
   */
  const checkMentionTrigger = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    const cursorPos = ta.selectionStart
    const text = ta.value
    const result = detectMentionTrigger(text, cursorPos)
    if (result.trigger) {
      // 计算光标坐标（用镜像 div 法，textarea 无法直接获取光标像素位置）
      const rect = ta.getBoundingClientRect()
      // 简化：弹出框位置 = textarea 顶部偏上 + 左对齐
      // 完整方案可后续接入 textarea-caret-position 库
      setMentionState({
        trigger: result.trigger,
        query: result.query,
        startPos: result.startPos,
        position: {
          top: rect.top - 8, // 弹出框在 textarea 上方
          left: rect.left + 16,
        },
      })
    } else {
      setMentionState(null)
    }
  }, [])

  /**
   * 选中提及项后，替换 textarea 中 @/# 触发文本为 insertText
   */
  const handleMentionSelect = useCallback((item: MentionItem) => {
    const ta = textareaRef.current
    if (!ta || !mentionState) return
    const before = ta.value.slice(0, mentionState.startPos)
    const after = ta.value.slice(ta.selectionStart)
    const newValue = before + item.insertText + ' ' + after
    setInput(newValue)
    setMentionState(null)
    // 焦点回到 textarea，光标放在插入文本后
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const newCursorPos = (before + item.insertText + ' ').length
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    })
  }, [mentionState])

  /**
   * 关闭提及弹出框
   */
  const closeMention = useCallback(() => setMentionState(null), [])

  // textarea onChange 包装：先更新 input，再检测 mention
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    // 异步检测 mention（等 React 更新完 textarea value）
    requestAnimationFrame(() => checkMentionTrigger())
  }, [checkMentionTrigger])

  // textarea onKeyUp：方向键移动光标后重新检测 mention
  const handleTextareaKeyUp = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // MentionPopover 已处理 ArrowUp/Down/Enter/Escape，这里只处理其他可能改变光标的键
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Click'].includes(e.key)) {
      checkMentionTrigger()
    }
  }, [checkMentionTrigger])

  // textarea onBlur：延迟关闭（让 MentionPopover 的 onClick 先触发）
  const handleTextareaBlur = useCallback(() => {
    setTimeout(() => setMentionState(null), 200)
  }, [])

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
  }, [license])

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
    // V3: 允许仅图片无文本发送（多模态）
    if ((!prompt && attachments.length === 0) || loading) return

    if (!isUnlimited && remainingQuota <= 0) {
      // V2: 弹出配额耗尽弹窗（Free 升级提示 / Pro 三选一）
      setQuotaDialogOpen(true)
      return
    }

    // V3 对标 Trae 回退版本：发送前抓取工作区快照（仅桌面端 + 已打开工作区）
    let workspaceSnapshot: ChatMessage['workspaceSnapshot']
    if (isDesktop() && workspacePath) {
      try {
        const fs = await getFS()
        if (fs.isReady()) {
          const status = await getGitStatus(fs)
          if (status && status.changes.length > 0) {
            workspaceSnapshot = {
              stashRef: `metago-snapshot-${Date.now()}`,
              branch: status.branch,
              timestamp: new Date().toISOString(),
              changedFiles: status.changes.length,
            }
          }
        }
      } catch { /* 桌面端 fs 未就绪或非 git 仓库时静默降级 */ }
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      // V3: 仅图片无文本时用默认提示
      content: prompt || (attachments.length > 0 ? '请分析这张图片' : ''),
      timestamp: new Date().toISOString(),
      workspaceSnapshot,
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

    // V3 对标 Trae @Builder：解析 @智能体提及，构造 agentOverride 实际切换 systemPrompt 和工具集
    const mentionedAgents: CustomAgent[] = parseAgentMentions(prompt)
    const primaryAgent = mentionedAgents[0] // 取第一个提及的智能体为主智能体
    const agentOverride = primaryAgent
      ? {
          systemPrompt: primaryAgent.systemPrompt,
          enabledTools: primaryAgent.enabledTools as string[] | '*',
          enabledMCP: primaryAgent.enabledMCP as string[] | '*',
          agentName: primaryAgent.name,
        }
      : undefined

    try {
      const result = await sendChat({
        messages: [...messages, userMsg],
        modelId,
        searchMode,
        attachments: attachments.length > 0 ? attachments : undefined,
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
        agentOverride,
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
        // V3: 流式 token 接收——AI 边输出边显示（不等完整响应）
        onStreamToken: (token) => {
          setMessages(prev => prev.map(m =>
            m.id === assistantMsg.id ? { ...m, content: m.content + token } : m
          ))
        },
        // V3: 工具开始执行时立即通知 UI（带参数）
        onToolCallStart: (toolName, args) => {
          setToolActivity(prev => [...prev, {
            name: toolName,
            status: 'running',
            args,
            startTime: Date.now(),
          }])
        },
        onToolCall: (toolName, args, result) => {
          // V3: result 非空 = 执行完成，更新对应 running 项为 done，带结果摘要和耗时
          setToolActivity(prev => {
            const idx = prev.findIndex(t => t.name === toolName && t.status === 'running')
            if (idx >= 0) {
              const next = [...prev]
              const item = next[idx]
              next[idx] = {
                ...item,
                status: 'done',
                resultPreview: result.length > 120 ? result.slice(0, 120) + '...' : result,
                duration: item.startTime ? Date.now() - item.startTime : undefined,
              }
              return next
            }
            // 找不到 running 项，直接加 done 项
            return [...prev, { name: toolName, status: 'done' as const, args, resultPreview: result.length > 120 ? result.slice(0, 120) + '...' : result }]
          })
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

      // 审查看板：仅在用户点击"代码审查"/"安全审计"快捷按钮时触发
      // 普通对话不解析为审查问题（避免把聊天内容误显示为 Critical 问题）
      if (isReviewRequestRef.current && onReviewComplete && result.content) {
        isReviewRequestRef.current = false
        const issues = parseReviewIssues(result.content, activeFileName ?? undefined)
        onReviewComplete(assistantMsg.id, issues, result.content)
      } else if (isReviewRequestRef.current) {
        // 审查请求但没有 content（异常），重置标记
        isReviewRequestRef.current = false
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
      setAttachments([])
      onSendEnd?.()
    }
  }, [input, loading, messages, modelId, searchMode, selectedCode, activeFileName,
      activeFileLanguage, selectedLineRange, isPro, workspacePath, workspaceName,
      projectType, activeSkills, onReviewComplete, onToolCall, onSendStart, onSendEnd,
      remainingQuota, isUnlimited, attachments])

  // V3: 多模态——图片上传 / 粘贴 / 删除
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return
    imageFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        setAttachments(prev => [...prev, {
          dataUrl,
          mimeType: file.type,
          thumbnailUrl: dataUrl,
          name: file.name,
        }])
      }
      reader.readAsDataURL(file)
    })
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = reader.result as string
            setAttachments(prev => [...prev, {
              dataUrl,
              mimeType: file.type,
              thumbnailUrl: dataUrl,
              name: `pasted-${Date.now()}.png`,
            }])
          }
          reader.readAsDataURL(file)
        }
      }
    }
  }, [])

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }, [])

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
          {/* V3 对标 Trae：独立的设置齿轮按钮，直接打开 10 大配置面板 */}
          <button
            onClick={() => setSettingsOpen(true)}
            title="设置（账号/通用/智能体/MCP/对话流/规则/技能/模型/索引/HOOKS）"
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-bg-deep border border-border-subtle text-zinc-400 hover:text-zinc-200 hover:border-border-default hover:bg-bg-hover transition-colors flex-shrink-0"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
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

      {/* 工具调用进度（V3: 带参数摘要 + 耗时 + 结果预览） */}
      {toolActivity.length > 0 && (
        <div className="flex-shrink-0 px-3 py-1.5 border-t border-border-subtle bg-bg-deep/30 max-h-40 overflow-y-auto">
          {toolActivity.map((t, i) => (
            <div key={i} className="text-[10px] space-y-0.5">
              <div className="flex items-center gap-1.5">
                {t.status === 'running'
                  ? <Loader2 className="w-2.5 h-2.5 animate-spin text-accent-emerald flex-shrink-0" />
                  : <Wrench className="w-2.5 h-2.5 text-accent-emerald flex-shrink-0" />
                }
                <span className="font-mono text-accent-emerald">{t.name}</span>
                {/* 参数摘要 */}
                {t.args && Object.keys(t.args).length > 0 && (
                  <span className="text-zinc-500 truncate max-w-[180px]">
                    {Object.entries(t.args)
                      .map(([k, v]) => `${k}: ${typeof v === 'string' ? `"${v.slice(0, 30)}"` : JSON.stringify(v).slice(0, 30)}`)
                      .join(', ')}
                  </span>
                )}
                <span className={t.status === 'running' ? 'text-accent-amber flex-shrink-0' : 'text-zinc-500 flex-shrink-0'}>
                  {t.status === 'running' ? '执行中...' : t.duration ? `${t.duration}ms` : '已完成'}
                </span>
              </div>
              {/* 结果预览（仅完成时显示） */}
              {t.status === 'done' && t.resultPreview && (
                <div className="ml-4 text-zinc-600 truncate max-w-full">
                  → {t.resultPreview}
                </div>
              )}
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
                onClick={() => {
                  if (action.isReview) isReviewRequestRef.current = true
                  handleSend(action.prompt)
                }}
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
        {/* V3: 多模态——图片附件缩略图 */}
        {attachments.length > 0 && (
          <div className="mb-1.5 flex gap-1 flex-wrap">
            {attachments.map((att, i) => (
              <div key={i} className="relative w-12 h-12 rounded border border-border-subtle overflow-hidden group bg-bg-deep">
                <img src={att.thumbnailUrl || att.dataUrl} alt={att.name || ''} className="w-full h-full object-cover" />
                <button
                  onClick={() => removeAttachment(i)}
                  title="移除图片"
                  className="absolute top-0 right-0 w-4 h-4 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onKeyUp={handleTextareaKeyUp}
            onBlur={handleTextareaBlur}
            onPaste={handlePaste}
            placeholder={workspacePath ? "输入问题，我可以直接读写你的文件...（@提及智能体，#引用上下文，可粘贴图片）" : "打开工作区后，我可以直接操作你的代码...（@提及智能体，#引用上下文，可粘贴图片）"}
            rows={2}
            disabled={loading || (!isUnlimited && remainingQuota <= 0)}
            className="w-full px-3 py-2 pl-8 pr-10 bg-bg-deep border border-border-subtle rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent-emerald/50 resize-none disabled:opacity-60"
          />
          {/* V3: 图片上传按钮（左下角） */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            title="上传图片（多模态）"
            className="absolute left-2 bottom-2 w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-accent-emerald disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ImageIcon className="w-3.5 h-3.5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={e => {
              handleFileSelect(e.target.files)
              e.target.value = '' // 清空 input 允许重复选择同一文件
            }}
            className="hidden"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || (!input.trim() && attachments.length === 0) || (!isUnlimited && remainingQuota <= 0)}
            className="absolute right-2 bottom-2 w-7 h-7 flex items-center justify-center rounded-lg bg-accent-emerald/15 text-accent-emerald hover:bg-accent-emerald/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <SettingsHub open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* V3 对标 Trae @Builder / #Web：提及弹出框 */}
      {mentionState && (
        <MentionPopover
          trigger={mentionState.trigger}
          query={mentionState.query}
          position={mentionState.position}
          onSelect={handleMentionSelect}
          onClose={closeMention}
        />
      )}

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

/**
 * Markdown → 纯文本转换（对标 Trae 纯文本输出风格）
 *
 * AI 模型有时不遵守 systemPrompt 的"禁止 Markdown"指令，
 * 这层 UI 兜底确保输出永远是纯文本，不出现 #、|、**、``` 等语法符号。
 *
 * 转换规则：
 * - # 标题 → 去掉 # 前缀，保留文字
 * - | 表格 | → 用空格对齐的纯文本
 * - **加粗** / __加粗__ → 去掉标记，保留文字
 * - *斜体* / _斜体_ → 去掉标记，保留文字
 * - `行内代码` → 去掉反引号，保留内容
 * - ```代码块``` → 去掉三反引号，保留内容（缩进呈现）
 * - --- / *** 分割线 → 替换为 ━━━━━━━━━━
 * - > 引用 → 去掉 > 前缀
 * - - / * / 1. 列表 → 保留（已是纯文本友好格式）
 */
function markdownToPlainText(text: string): string {
  if (!text) return ''
  return text
    // 代码块 ```...``` → 去掉三反引号，内容缩进 2 空格
    .replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
      return code.split('\n').map((line: string) => '  ' + line).join('\n').trimEnd()
    })
    // 行内代码 `code` → code
    .replace(/`([^`\n]+)`/g, '$1')
    // 加粗 **text** 或 __text__ → text
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    // 斜体 *text* 或 _text_ → text（注意不误伤 ** 和 __，已先处理）
    .replace(/(?<!\*)\*(?!\*)([^*\n]+)\*(?!\*)/g, '$1')
    .replace(/(?<!_)_(?!_)([^_\n]+)_(?!_)/g, '$1')
    // 标题 # / ## / ### → 去掉 # 前缀
    .replace(/^#{1,6}\s+/gm, '')
    // 分割线 --- / *** / ___ → ━━━━━━━━━━
    .replace(/^(-{3,}|\*{3,}|_{3,})\s*$/gm, '━━━━━━━━━━━━━━')
    // 引用 > text → text
    .replace(/^>\s+/gm, '')
    // 表格行 | a | b | c | → a  b  c
    .replace(/^\|(.+)\|\s*$/gm, (_, content: string) => {
      const cells = content.split('|').map((c: string) => c.trim()).filter(Boolean)
      return cells.join('  ')
    })
    // 表格分隔行 |---|---| → 删除
    .replace(/^\|[\s:|-]+\|\s*$/gm, '')
    // 连续多个空行压缩为 2 个
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function EmptyState({ hasWorkspace }: { hasWorkspace: boolean }) {
  // V3: 动态派生工具数（不硬编码，新增工具自动反映）
  const engineeringCount = AGENT_TOOLS.length
  const mcpCount = MCP_TOOLS.length
  const totalCount = engineeringCount + mcpCount
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-8">
      <div className="w-12 h-12 rounded-full bg-accent-emerald/10 flex items-center justify-center mb-3">
        <Bot className="w-6 h-6 text-accent-emerald" />
      </div>
      <h3 className="text-sm font-medium text-zinc-300 mb-1">MetaGO Agent</h3>
      <p className="text-[11px] text-zinc-500 max-w-[260px] leading-relaxed">
        {hasWorkspace
          ? '我是你的开发智能体。我可以直接读写文件、搜索代码、运行 Git 操作、执行深度代码审查。告诉我你想做什么。'
          : `打开工作区后，我可以直接操作你的代码。我拥有 ${totalCount} 个可调用工具（${engineeringCount} 个工程工具 + ${mcpCount} 个元构思维技能），涵盖文件系统、Git、Shell、任务管理、部署验证、子代理、流式编辑、自省、代码智能。`}
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
  const [copied, setCopied] = useState(false)
  const isUser = msg.role === 'user'

  // V3 对标 Trae 代码块操作按钮：拆分 content 为段落（普通文本 + 代码块）
  // 仅对 AI 消息生效；用户消息保持原样
  const segments = useMemo(() => isUser ? [] : parseContentSegments(msg.content), [msg.content, isUser])
  const hasCodeBlocks = segments.some(s => s.type === 'code')
  // AI 消息的纯文本兜底（无代码块时走旧逻辑）
  const displayContent = isUser ? msg.content : markdownToPlainText(msg.content)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = displayContent
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch { /* 忽略 */ }
      document.body.removeChild(textarea)
    }
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[90%] ${isUser ? 'order-2' : ''}`}>
        {msg.reasoning && (
          <div className="mb-1.5">
            <button
              onClick={() => setShowReasoning(!showReasoning)}
              className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
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
              正在思考...
            </div>
          ) : hasCodeBlocks ? (
            // V3 对标 Trae：有代码块时分段渲染，每段代码块带操作按钮
            <div className="space-y-1.5">
              {segments.map((seg, i) => seg.type === 'text'
                ? <div key={i} className="whitespace-pre-wrap break-words">{markdownToPlainText(seg.content)}</div>
                : <CodeBlock key={i} code={seg.content} language={seg.language} />
              )}
            </div>
          ) : (
            <div className="whitespace-pre-wrap break-words">{displayContent}</div>
          )}
        </div>

        {/* V3 对标 Trae 回退版本：显示对话前工作区快照 */}
        {isUser && msg.workspaceSnapshot && (
          <div className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500">
            <History className="w-2.5 h-2.5" />
            <span>对话前快照：{msg.workspaceSnapshot.changedFiles} 个改动（{msg.workspaceSnapshot.branch}）</span>
          </div>
        )}

        {!isUser && !msg.streaming && !msg.error && msg.content && (
          <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-600">
            {msg.modelId && <span>{msg.modelId}</span>}
            <span>{new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
            <button
              onClick={handleCopy}
              title="复制整条回复"
              className="flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-bg-hover hover:text-zinc-300 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-2.5 h-2.5" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="w-2.5 h-2.5" />
                  复制
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * V3 对标 Trae 代码块操作按钮
 *
 * 把 AI 回复中的 ```代码块``` 拆分为段落：
 *   - type='text': 普通文本段（可能含 Markdown，渲染时再转纯文本）
 *   - type='code': 代码段（保留原样，配套操作按钮）
 *
 * 仅识别 ```...``` 三反引号代码块，行内 `code` 不拆分（保留在文本段中由 markdownToPlainText 处理）
 */
type ContentSegment =
  | { type: 'text'; content: string }
  | { type: 'code'; content: string; language?: string }

function parseContentSegments(text: string): ContentSegment[] {
  if (!text) return []
  const segments: ContentSegment[] = []
  // 匹配 ```language\ncode\n``` 或 ```\ncode\n```
  const regex = /```([\w-]*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    // 代码块之前的文本段
    if (match.index > lastIndex) {
      const textSeg = text.slice(lastIndex, match.index)
      if (textSeg.trim()) segments.push({ type: 'text', content: textSeg })
    }
    // 代码段
    const language = match[1] || undefined
    const code = match[2].replace(/\n$/, '') // 去掉末尾换行
    segments.push({ type: 'code', content: code, language })
    lastIndex = regex.lastIndex
  }
  // 末尾文本段
  if (lastIndex < text.length) {
    const textSeg = text.slice(lastIndex)
    if (textSeg.trim()) segments.push({ type: 'text', content: textSeg })
  }
  return segments.length > 0 ? segments : [{ type: 'text', content: text }]
}

/**
 * V3 代码块组件（对标 Trae 代码块操作按钮）
 *
 * 操作按钮：
 *   1. 复制：复制代码到剪贴板
 *   2. 添加到新文件：下载为 .ts/.js/.py 等文件（按语言推断扩展名）
 *   3. 插入到光标处：复制到剪贴板 + 提示用户手动粘贴（Web 端无法直接操作编辑器）
 */
function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = code
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try { document.execCommand('copy') } catch { /* 忽略 */ }
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownload = () => {
    const ext = getLanguageExtension(language)
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `metago-snippet-${Date.now()}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2000)
  }

  const handleInsertToCursor = async () => {
    // Web 端无法直接操作 CodeMirror 编辑器（跨组件状态）
    // 复制到剪贴板 + 提示用户手动粘贴到光标位置
    try {
      await navigator.clipboard.writeText(code)
      alert('代码已复制到剪贴板，请在编辑器中按 Ctrl+V 粘贴到光标位置。')
    } catch {
      alert('复制失败，请手动选择代码块内容并复制。')
    }
  }

  return (
    <div className="my-1.5 bg-bg-card border border-border-default rounded overflow-hidden">
      {/* 代码块头部：语言标识 + 操作按钮 */}
      <div className="px-2 py-1 bg-bg-deep/70 border-b border-border-subtle flex items-center justify-between text-[10px]">
        <span className="text-zinc-500 font-mono uppercase tracking-wide">{language || 'code'}</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleCopy}
            title="复制代码"
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-zinc-400 hover:text-accent-emerald hover:bg-bg-hover transition-colors"
          >
            {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
            {copied ? '已复制' : '复制'}
          </button>
          <button
            onClick={handleDownload}
            title="下载为新文件"
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-zinc-400 hover:text-accent-emerald hover:bg-bg-hover transition-colors"
          >
            {downloaded ? <Check className="w-2.5 h-2.5" /> : <FilePlus className="w-2.5 h-2.5" />}
            {downloaded ? '已下载' : '新文件'}
          </button>
          <button
            onClick={handleInsertToCursor}
            title="插入到光标处（复制到剪贴板，手动粘贴）"
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-zinc-400 hover:text-accent-emerald hover:bg-bg-hover transition-colors"
          >
            <CornerDownRight className="w-2.5 h-2.5" />
            插入
          </button>
        </div>
      </div>
      {/* 代码内容 */}
      <pre className="px-2.5 py-1.5 text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

/** 根据语言名获取文件扩展名（用于"添加到新文件"下载） */
function getLanguageExtension(lang?: string): string {
  if (!lang) return 'txt'
  const map: Record<string, string> = {
    typescript: 'ts', ts: 'ts', tsx: 'tsx',
    javascript: 'js', js: 'js', jsx: 'jsx',
    python: 'py', py: 'py',
    rust: 'rs', rs: 'rs',
    go: 'go',
    java: 'java',
    c: 'c', cpp: 'cpp', 'c++': 'cpp',
    csharp: 'cs', cs: 'cs',
    php: 'php',
    ruby: 'rb', rb: 'rb',
    swift: 'swift',
    kotlin: 'kt',
    shell: 'sh', bash: 'sh', sh: 'sh', zsh: 'sh',
    sql: 'sql',
    html: 'html', css: 'css', scss: 'scss',
    json: 'json', yaml: 'yaml', yml: 'yml',
    xml: 'xml', markdown: 'md', md: 'md',
  }
  return map[lang.toLowerCase()] || 'txt'
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
