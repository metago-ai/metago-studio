/**
 * AI 核心调度层（V4 - 真流式架构 + 自省 + 韧性）
 *
 * V4 核心升级（2026-07-07）：
 *   真流式响应（SSE）——对标 TRAE / Cursor / Copilot
 *   CloudBase 云函数不支持 SSE，故部署 Cloudflare Worker 作为流式代理
 *   AI 边生成边返回，前端实时显示，永不超时
 *   失败自动回退到 V3 非流式模式
 *
 * V3 核心升级：
 * 1. 动态 System Prompt（环境感知，工具数从代码派生）
 * 2. Function Call + 多轮工具调用循环
 * 3. 上下文窗口管理（token 预算 + 自动裁剪）
 * 4. 流式响应 + 工具调用混合（stream:true）
 * 5. 错误恢复与韧性（重试 + fallback + 降级）
 * 6. 工具调用过程实时可视化（onToolCall 增强）
 */

import { callFunction } from './cloudFunctions'
import { findModel } from './modelRegistry'
import { decideSearch } from './searchDecider'
import { webSearch, formatSearchResultsForPrompt } from './searchEngine'
import { buildSystemPrompt, getToolDefinitions, executeTool, type EnvironmentContext, type ToolExecutionContext } from './agent/systemPrompt'
import { getMCPLogStore } from './mcpRegistry'
import { recordUsage, extractUsage } from './tokenMeter'
import { isByokActive } from './byokService'
import { trimHistory, estimateTokens } from './contextManager'
import type { ChatMessage, SearchMode } from '../types'

// ============ V4 真流式代理（腾讯云 SSE 代理）============

/**
 * 流式代理 URL——根据页面协议自动选择
 *
 * 架构（2026-07-07 V5 升级）：
 *   部署在腾讯云服务器（118.24.186.55）的 SSE 流式代理服务
 *   绕过 CloudBase 60-180 秒超时限制，保持推理模型（deepseek-v4-pro）
 *   实现真流式体验（对标 TRAE/Cursor）
 *
 * URL 选择逻辑：
 *   - HTTPS 页面（Web 端 metago.life）→ HTTPS 代理 URL（端口 8089，自签名证书）
 *     首次访问需在浏览器信任证书（访问 https://118.24.186.55:8089/health 点击"继续访问"）
 *   - HTTP/file 页面（桌面端 Electron）→ HTTP 代理 URL（端口 8088）
 *
 * 部署细节见 d:\元构能力\metago-sse-proxy\README.md
 */
const SSE_PROXY_HTTP_URL = 'http://118.24.186.55:8088/chat'
const SSE_PROXY_HTTPS_URL = 'https://sse.metago.life/chat'

function getStreamProxyUrl(): string {
  // 环境变量优先（测试/覆盖用）
  const envUrl = (import.meta as any).env?.VITE_AI_STREAM_PROXY_URL
  if (envUrl) return envUrl

  // 运行时根据页面协议选择
  if (typeof window === 'undefined') return SSE_PROXY_HTTP_URL

  const protocol = window.location.protocol
  if (protocol === 'https:') {
    // Web 端 HTTPS 页面：必须用 HTTPS（避免 Mixed Content 阻止）
    return SSE_PROXY_HTTPS_URL
  }
  // 桌面端 Electron（file:）或本地开发（http:）：用 HTTP
  return SSE_PROXY_HTTP_URL
}

const STREAM_PROXY_URL = getStreamProxyUrl()

/** 从 localStorage 获取已登录用户 ID（与 cloudFunctions.ts 一致） */
function getLoggedInUserId(): string | null {
  try { return localStorage.getItem('metago_user_id') } catch { return null }
}

/** 未登录用户生成稳定匿名 UID，存 localStorage，用于 Free 配额计量 */
function getOrCreateAnonymousUid(): string {
  try {
    let uid = localStorage.getItem('metago_anonymous_uid')
    if (!uid) {
      uid = 'anon_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10)
      localStorage.setItem('metago_anonymous_uid', uid)
    }
    return uid
  } catch {
    return 'anon_' + Date.now().toString(36)
  }
}

/**
 * V4: 真流式调用——通过 Cloudflare Worker 转发 AI 的 SSE 响应
 *
 * 核心改进：
 *   - AI 边生成边返回，前端实时显示（对标 TRAE）
 *   - 永不超时（没有 60 秒限制）
 *   - 实时调用 onStreamToken / onReasoning 回调
 *   - 失败自动回退到非流式 callFunctionWithRetry
 *
 * @param payload 请求 payload（与 aiProxy chat action 格式一致）
 * @param callbacks 流式回调
 * @returns 完整响应（与非流式格式一致）
 */
async function callStreamProxy(
  payload: Record<string, unknown>,
  callbacks: {
    onStreamToken?: (token: string) => void
    onReasoning?: (token: string) => void
  },
): Promise<{ code: number; message?: string; data: any | null }> {
  // 未配置流式代理 → 回退到分段生成（V4.1：仍然有打字机效果，永不超时）
  if (!STREAM_PROXY_URL) {
    return streamChatChunked(payload, callbacks)
  }

  // BYOK 模式不走流式代理（用户自带 Key，前端直连）—— BYOK 也走分段生成
  if (payload.modelType === 'custom') {
    return streamChatChunked(payload, callbacks)
  }

  // 注入 _clientUid（Worker 用它调 CloudBase 检查配额）
  // 未登录用户使用稳定匿名 UID，确保 Free 配额可用
  const clientUid = getLoggedInUserId() || getOrCreateAnonymousUid()
  const proxyPayload = {
    ...payload,
    action: undefined, // Worker 不需要 action 字段
    _clientUid: clientUid,
  }

  const controller = new AbortController()
  const connectTimeoutId = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(STREAM_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Uid': clientUid,
      },
      body: JSON.stringify(proxyPayload),
      signal: controller.signal,
    })

    clearTimeout(connectTimeoutId)

    // 非 200 响应（配额耗尽 / API 错误等）
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      return {
        code: errData.code || response.status,
        message: errData.message || `流式代理错误 (${response.status})`,
        data: errData.data || null,
      }
    }

    if (!response.body) {
      throw new Error('流式响应无 body')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let content = ''
    let reasoning = ''
    const toolCalls: any[] = []
    let usage: any = null
    let streamStarted = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const data = trimmed.slice(6)
        if (data === '[DONE]') continue

        try {
          const chunk = JSON.parse(data)
          streamStarted = true

          // 错误响应
          if (chunk.error) {
            throw new Error(chunk.error.message || 'AI 流式响应错误')
          }

          const delta = chunk.choices?.[0]?.delta || {}
          const choiceMessage = chunk.choices?.[0]?.message || {} // 非流式回退

          // 内容（流式 delta.content 或非流式 message.content）
          const tokenContent = delta.content || choiceMessage.content || ''
          if (tokenContent) {
            content += tokenContent
            callbacks.onStreamToken?.(tokenContent)
          }

          // 推理过程
          const tokenReasoning = delta.reasoning_content || choiceMessage.reasoning_content || ''
          if (tokenReasoning) {
            reasoning += tokenReasoning
            callbacks.onReasoning?.(tokenReasoning)
          }

          // 工具调用（流式分块返回，需累积）
          const deltaToolCalls = delta.tool_calls || choiceMessage.tool_calls
          if (deltaToolCalls && Array.isArray(deltaToolCalls)) {
            for (const tc of deltaToolCalls) {
              const idx = tc.index ?? 0
              if (!toolCalls[idx]) {
                toolCalls[idx] = {
                  id: tc.id || '',
                  type: tc.type || 'function',
                  function: { name: '', arguments: '' },
                }
              }
              if (tc.function?.name) toolCalls[idx].function.name += tc.function.name
              if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments
              if (tc.id && !toolCalls[idx].id) toolCalls[idx].id = tc.id
            }
          }

          // Token 统计（OpenAI 格式，最后一个 chunk 才有 usage）
          if (chunk.usage) {
            usage = chunk.usage
          }
        } catch (parseErr) {
          // 单行解析失败不中断流
          if (parseErr instanceof Error && parseErr.message.includes('AI 流式响应错误')) {
            throw parseErr
          }
        }
      }
    }

    // 流式未启动（可能 Worker 返回了非 SSE 响应）→ 回退到分段生成
    if (!streamStarted && !content) {
      console.warn('[aiClient] 流式代理未返回有效数据，回退到分段生成')
      return streamChatChunked(payload, callbacks)
    }

    return {
      code: 0,
      data: {
        content,
        reasoning,
        tool_calls: toolCalls.length > 0 ? toolCalls : null,
        usage,
        model: payload.modelId,
      },
    }
  } catch (e) {
    clearTimeout(connectTimeoutId)
    console.warn('[aiClient] 流式代理失败，回退到分段生成:', (e as Error).message)
    // 回退到 V4.1 分段生成（仍然有打字机效果，永不超时）
    return streamChatChunked(payload, callbacks)
  }
}

// ============ V4.1 分段生成（Chunked Generation）============

/**
 * V4.1: 分段生成——彻底解决 CloudBase 云函数超时限制
 *
 * 核心原理（对标 TRAE/Cursor 的真流式体验）：
 *   - 每次请求只生成 4096 token（约 10-20 秒响应）
 *   - 如果 finish_reason === 'length'（被 max_tokens 截断），更新 messages 中的
 *     assistant 消息为已累积内容，AI 自动续写（不加"继续"user 消息，避免请求体膨胀）
 *   - 重复直到 finish_reason === 'stop'（AI 主动完成）或 'tool_calls'（请求工具）
 *   - 每段内容通过 onStreamToken 实时回调到 UI，用户看到打字机效果，永不超时
 *
 * V4.2 修复（2026-07-07）：
 *   - 修复请求体过大问题：不再每次 push 新的 assistant + "继续" user 消息
 *     而是更新最后一个 assistant 消息的 content，messages 大小保持稳定
 *   - 增大 max_tokens 从 1500 到 4096：减少分段数，大部分任务 2-3 段完成
 *   - 处理思考阶段：content 为空但 finish_reason=length 时，继续请求（AI 在思考）
 *
 * 兜底机制：
 *   - 某段失败时，返回已累积的内容（不丢失部分结果）
 *   - 达到最大分段数时，返回已累积的内容
 */
const CHUNK_MAX_TOKENS = 4096   // 每段最大 token 数（10-20 秒响应，平衡速度和分段数）
const MAX_CHUNKS = 20           // 最大分段数（4096 * 20 = 81920 token，覆盖任何场景）

async function streamChatChunked(
  payload: Record<string, unknown>,
  callbacks: {
    onStreamToken?: (token: string) => void
    onReasoning?: (token: string) => void
  },
): Promise<{ code: number; message?: string; data: any | null }> {
  // 复制 messages，避免修改原始数组
  const messages = [...(payload.messages as any[])] as any[]
  let accumulatedContent = ''
  let accumulatedReasoning = ''
  let lastUsage: any = null
  let model: string = (payload.modelId as string) || ''
  let emptyChunkCount = 0  // 连续空内容计数（处理思考阶段）

  for (let chunk = 0; chunk < MAX_CHUNKS; chunk++) {
    // 构建分段请求 payload
    const chunkPayload = {
      ...payload,
      messages,
      maxTokens: CHUNK_MAX_TOKENS,
    }

    const res = await callFunctionWithRetry<any>('aiProxy', chunkPayload)
    if (res.code !== 0 || !res.data) {
      // 第一段就失败：直接返回错误
      if (chunk === 0) return res
      // 后续段失败：返回已累积的内容（不丢失部分结果）
      console.warn(`[aiClient] 分段生成第 ${chunk + 1} 段失败，返回已累积内容`)
      return {
        code: 0,
        data: {
          content: accumulatedContent,
          reasoning: accumulatedReasoning,
          tool_calls: null,
          finish_reason: 'length',
          model,
          usage: lastUsage,
        },
      }
    }

    const data = res.data
    const partialContent = data.content || ''
    const partialReasoning = data.reasoning || ''
    const finishReason = data.finish_reason || 'stop'

    // 实时输出到 UI（打字机效果）
    if (partialContent) {
      accumulatedContent += partialContent
      callbacks.onStreamToken?.(partialContent)
      emptyChunkCount = 0  // 重置空内容计数
    } else if (partialReasoning) {
      // content 为空但有推理内容：思考阶段（DeepSeek-v4-pro 等推理模型）
      // 推理阶段不算空内容，重置计数
      emptyChunkCount = 0
    } else {
      // content 和 reasoning 都为空：可能模型异常
      emptyChunkCount++
      if (emptyChunkCount >= 5) {
        console.warn(`[aiClient] 连续 ${emptyChunkCount} 段返回空内容（无 content 也无 reasoning），可能模型异常，终止分段`)
        break
      }
    }
    if (partialReasoning) {
      accumulatedReasoning += partialReasoning
      callbacks.onReasoning?.(partialReasoning)
    }
    if (data.usage) lastUsage = data.usage
    if (data.model) model = data.model

    // 完成或工具调用：结束分段循环
    if (finishReason === 'stop' || finishReason === 'tool_calls') {
      return {
        code: 0,
        data: {
          content: accumulatedContent,
          reasoning: accumulatedReasoning,
          tool_calls: data.tool_calls || null,
          finish_reason: finishReason,
          model,
          usage: lastUsage,
        },
      }
    }

    // finish_reason === 'length'：内容被截断，需要继续生成
    // V4.2 修复：不 push 新消息，而是更新最后一个 assistant 消息
    // 这样 messages 大小保持稳定，不会因累积内容导致请求体过大
    const lastMsg = messages[messages.length - 1]
    if (lastMsg && lastMsg.role === 'assistant') {
      // 更新最后一个 assistant 消息的 content（累积完整内容）
      lastMsg.content = accumulatedContent
    } else {
      // 添加新的 assistant 消息
      messages.push({
        role: 'assistant',
        content: accumulatedContent,
      })
    }
    // 注意：不加 "继续" 的 user 消息
    // OpenAI 兼容 API 会自动续写未完成的 assistant 消息
  }

  // 达到最大分段数，返回已累积内容
  console.warn(`[aiClient] 分段生成达到最大段数 ${MAX_CHUNKS}（${MAX_CHUNKS * CHUNK_MAX_TOKENS} tokens），可能内容过长`)
  return {
    code: 0,
    data: {
      content: accumulatedContent,
      reasoning: accumulatedReasoning,
      tool_calls: null,
      finish_reason: 'length',
      model,
      usage: lastUsage,
    },
  }
}

// ============ 对话请求 ============


/** V3: 图片附件（多模态） */
export interface ImageAttachment {
  /** data URL 形式：data:image/png;base64,xxxxx */
  dataUrl: string
  /** MIME 类型：image/png | image/jpeg | image/webp | image/gif */
  mimeType: string
  /** 缩略图 URL（用于 UI 显示） */
  thumbnailUrl?: string
  /** 文件名 */
  name?: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  modelId: string
  searchMode: SearchMode
  /** 环境上下文（用于动态 System Prompt） */
  envContext?: EnvironmentContext
  /** V3: 图片附件（多模态，自动路由到 glm-5v-turbo） */
  attachments?: ImageAttachment[]
  /** 流式回调 */
  onToken?: (token: string) => void
  /** 流式回调（思考过程） */
  onReasoning?: (token: string) => void
  /** 工具调用回调（展示 AI 在做什么） */
  onToolCall?: (toolName: string, args: Record<string, unknown>, result: string) => void
  /** V3: 工具调用开始回调（工具开始执行时触发，result 为空字符串） */
  onToolCallStart?: (toolName: string, args: Record<string, unknown>) => void
  /** V3: 流式 token 接收回调（边接收边显示，不等完整响应） */
  onStreamToken?: (token: string) => void
  /** 最大工具调用轮数 */
  maxToolRounds?: number
  /** V3 对标 Trae @Builder：@提及智能体时传入的覆盖配置
   *  - systemPrompt: 完全替代 buildSystemPrompt
   *  - enabledTools: '*' 表示全部，数组表示白名单
   *  - enabledMCP:   '*' 表示全部，数组表示白名单
   */
  agentOverride?: {
    systemPrompt: string
    enabledTools?: string[] | '*'
    enabledMCP?: string[] | '*'
    agentName?: string
  }
}

// ============ 主入口 ============

/**
 * 上报 Token 用量到 tokenMeter
 * - BYOK 激活时跳过（用户自带 Key，不消耗平台配额）
 * - usage 字段缺失时跳过（旧版 aiProxy 兼容）
 * - 失败不影响主流程（仅 console.warn）
 */
function reportUsageIfNeeded(rawUsage: any, modelId: string): void {
  if (isByokActive()) return // BYOK 模式：用户 Key，不计平台配额
  if (!rawUsage) return       // 旧版无 usage 字段
  try {
    const usage = extractUsage(rawUsage, modelId)
    recordUsage(usage).catch(e => console.warn('[aiClient] Token 上报失败', e))
  } catch (e) {
    console.warn('[aiClient] 提取 usage 失败', e)
  }
}

/**
 * V3: 带重试的云函数调用
 * - 网络错误自动重试（指数退避）
 * - 504 超时不重试（已经等了 60 秒）
 * - 业务错误（code !== 0）不重试
 */
async function callFunctionWithRetry<T = any>(
  name: string,
  payload: Record<string, unknown>,
  maxRetries = 2,
): Promise<{ code: number; message?: string; data: T | null }> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await callFunction<T>(name, payload)
      // 504 超时：不重试，直接返回（用户应简化问题）
      if (res.code === 504) return res
      // 500 系统错误：重试
      if (res.code >= 500 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
        console.warn(`[aiClient] ${name} 返回 ${res.code}，${delay}ms 后重试 (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      return res
    } catch (e) {
      lastError = e as Error
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000
        console.warn(`[aiClient] ${name} 调用异常：${(e as Error).message}，${delay}ms 后重试 (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(r => setTimeout(r, delay))
        continue
      }
    }
  }
  return {
    code: 500,
    message: lastError?.message || '调用失败（已重试）',
    data: null,
  }
}

/**
 * 决策锁自动校验：在 Agent AI 输出时自动调用本地代码校验器
 * - 所有校验结果都记录到历史（DecisionLockPage 可查看）
 * - 只在 OSG（语义输出门）阻断时才干预 AI 输出（追加警告）
 *   OSG 检测占位符/虚构API/伪造数据，这些是真正需要干预的问题
 * - IVL/ILT/完整性对代码输出容易误判（关键词重叠度低/缺少思考链路/方括号未闭合），只记录不干预
 * - 校验失败（异常）→ 非阻塞降级
 */
async function applyDecisionLockAutoCheck(
  userInput: string,
  aiOutput: string,
  reasoning: string | undefined,
  onStreamToken?: (token: string) => void,
): Promise<{ content: string; blocked: boolean; reason?: string }> {
  if (!userInput.trim() || !aiOutput.trim()) {
    return { content: aiOutput, blocked: false }
  }
  try {
    const { runDecisionLockValidation } = await import('./decisionLockValidator')
    const record = runDecisionLockValidation(
      { userInput, aiOutput, context: reasoning },
      { hardMode: true },
    )
    // 所有校验结果都记录到历史（带云端同步和 events 上报）
    try {
      const { useStore } = await import('../store/useStore')
      useStore.getState().runValidation({ userInput, aiOutput, context: reasoning })
    } catch { /* store 不可用时静默降级 */ }

    // 只在 OSG（语义输出门）阻断时才干预 AI 输出
    // OSG 检测占位符/虚构API/伪造数据，这些是真正需要干预的问题
    // IVL/ILT/完整性对代码输出容易误判，只记录不干预
    const osgStage = record.stages.find(s => s.id === 'osg')
    const osgBlocked = osgStage && !osgStage.passed

    if (osgBlocked) {
      const osgReason = osgStage?.details.find(d => !d.ok)?.value || record.blockedReason || '语义输出门校验未通过'
      const warning = `\n\n---\n⚠️ **决策锁 OSG 阻断**：${osgReason}\n\n_由 MetaGO 决策锁四道关卡（IVL→ILT→OSG→完整性）自动校验 · 耗时 ${record.totalDurationMs}ms_`
      if (onStreamToken) {
        for (const ch of warning) onStreamToken(ch)
      }
      return { content: aiOutput + warning, blocked: true, reason: osgReason }
    }
    return { content: aiOutput, blocked: false }
  } catch (e) {
    console.warn('[aiClient] 决策锁自动校验失败（非阻塞）', e)
    return { content: aiOutput, blocked: false }
  }
}

export async function sendChat(req: ChatRequest): Promise<{
  content: string
  reasoning?: string
  searchResults?: ChatMessage['searchResults']
  modelId: string
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; result: string }>
}> {
  // V3: 多模态路由——有图片附件时自动切到 glm-5v-turbo（对标 Trae 图片理解）
  const hasAttachments = !!(req.attachments && req.attachments.length > 0)
  const effectiveModelId = hasAttachments ? 'glm-5v-turbo' : req.modelId
  const model = findModel(effectiveModelId)
  if (!model) throw new Error(`未找到模型：${effectiveModelId}`)

  // 1. 构建动态 System Prompt（V3: 工具数从代码派生）
  // V3 对标 Trae @Builder：如果传入 agentOverride，用其 systemPrompt 替代默认
  let systemPrompt: string
  if (req.agentOverride?.systemPrompt) {
    // 把环境上下文也注入到 override systemPrompt 中（保留智能体个性，但加入环境感知）
    const env = req.envContext
    const envLines: string[] = []
    if (env?.workspacePath) envLines.push(`- 工作区：${env.workspacePath}`)
    if (env?.workspaceName) envLines.push(`- 项目：${env.workspaceName}`)
    if (env?.activeFileName) envLines.push(`- 当前文件：${env.activeFileName}`)
    if (env?.selectedCode) envLines.push(`- 选中代码：${env.selectedCode.split('\n').length} 行`)
    const envBlock = envLines.length > 0
      ? `\n\n# 当前环境\n${envLines.join('\n')}`
      : ''
    systemPrompt = req.agentOverride.systemPrompt + envBlock
    if (req.agentOverride.agentName) {
      systemPrompt += `\n\n# 当前身份\n你正在以「${req.agentOverride.agentName}」智能体身份响应用户的 @提及。`
    }
  } else if (req.envContext) {
    systemPrompt = await buildSystemPrompt(req.envContext)
  } else {
    systemPrompt = '你是 MetaGO Agent，元构超级智能生命体的核心智能体。'
  }

  // 2. 判断联网
  const lastUserMsg = [...req.messages].reverse().find(m => m.role === 'user')
  const userText = lastUserMsg?.content ?? ''

  // V3 对标 Trae #Web/#Doc/#文件：解析 # 提及，强制触发搜索或注入上下文
  const webMention = userText.match(/#Web\s+([^\n#]+)/i)
  const docMention = userText.match(/#Doc\s+([^\n#]+)/i)
  const fileMention = userText.match(/#文件\s+([^\n#]+)/i)

  let forceSearchQuery: string | null = null
  let docContext = ''

  if (webMention) {
    // #Web 提及：强制触发联网搜索（覆盖 searchMode）
    forceSearchQuery = webMention[1].trim()
  }

  if (docMention) {
    // #Doc 提及：从索引文档库加载文档内容注入上下文
    try {
      const { getIndexDocs } = await import('./settingsStore')
      const docs = getIndexDocs()
      const docTitle = docMention[1].trim()
      const doc = docs.find(d => d.title.includes(docTitle) || d.id === docTitle)
      if (doc) {
        docContext = `--- 文档：${doc.title} ---\n${doc.content || doc.url || ''}`
      }
    } catch { /* settingsStore 不可用时静默降级 */ }
  }

  if (fileMention && req.envContext?.workspacePath) {
    // #文件 提及：从文件系统读取文件内容注入上下文
    try {
      const { getFS } = await import('./fs/fsInterface')
      const fs = await getFS()
      if (fs.isReady?.()) {
        const filePath = fileMention[1].trim()
        const content = await fs.readFile(filePath)
        docContext += `${docContext ? '\n' : ''}--- 文件：${filePath} ---\n${content}`
      }
    } catch { /* 文件读取失败时静默降级 */ }
  }

  // 联网搜索：#Web 提及强制触发，否则按 searchMode 决策
  const decision = forceSearchQuery
    ? { shouldSearch: true, query: forceSearchQuery }
    : decideSearch(userText, req.envContext?.selectedCode, req.searchMode)

  let searchResults: ChatMessage['searchResults']
  let searchContext = ''
  if (decision.shouldSearch && decision.query) {
    try {
      const results = await webSearch(decision.query)
      searchResults = results
      searchContext = formatSearchResultsForPrompt(results)
    } catch (e) {
      console.warn('[aiClient] 搜索失败', e)
    }
  }

  // V3: 拼接 systemPrompt + 搜索结果 + 文档/文件上下文
  let fullSystemPrompt = systemPrompt
  if (searchContext) {
    fullSystemPrompt += `\n\n--- 联网搜索结果 ---\n${searchContext}`
  }
  if (docContext) {
    fullSystemPrompt += `\n\n${docContext}`
  }

  // 3. V3: 上下文窗口管理——动态裁剪历史
  const contextWindow = model.contextWindow ?? 128000
  const systemTokens = estimateTokens(fullSystemPrompt)
  const budgetForHistory = contextWindow - systemTokens - 8000 // 预留 8K 给工具定义和输出
  const history = trimHistory(
    req.messages.filter(m => !m.error).map(m => ({ role: m.role, content: m.content })),
    budgetForHistory,
  )

  // 4. 工具定义（V3 对标 Trae @Builder：支持按 agentOverride 过滤工具集）
  const allTools = getToolDefinitions()
  const tools = req.agentOverride
    ? allTools.filter(t => {
        // '*' 表示全部工具
        if (req.agentOverride!.enabledTools === '*') return true
        // 数组：按工具名匹配
        if (Array.isArray(req.agentOverride!.enabledTools)) {
          return req.agentOverride!.enabledTools.includes(t.function.name)
        }
        return true
      })
    : allTools
  // V3: maxRounds 10 → 15（覆盖更复杂场景，配合 60s 超时和重试机制）
  const maxRounds = req.maxToolRounds ?? 15
  const allToolCalls: Array<{ name: string; args: Record<string, unknown>; result: string }> = []

  // 5. V3: 工具执行上下文（携带 envContext 供 get_agent_info 读取）
  const toolExecContext: ToolExecutionContext = {
    workspacePath: req.envContext?.workspacePath,
    isDesktop: req.envContext?.isDesktop ?? false,
    envContext: req.envContext,
  }

  // 6. 多轮工具调用循环
  // V3: 多模态——content 允许为字符串或数组（OpenAI Vision 格式）
  let currentMessages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [
    { role: 'system', content: fullSystemPrompt },
    ...history,
  ]

  // V3: 拼接图片附件到最后一条 user message（OpenAI Vision 格式）
  if (hasAttachments && req.attachments && req.attachments.length > 0) {
    const lastUserIdx = currentMessages.map(m => m.role).lastIndexOf('user')
    if (lastUserIdx >= 0) {
      const lastUser = currentMessages[lastUserIdx]
      const textContent = typeof lastUser.content === 'string' ? lastUser.content : ''
      currentMessages[lastUserIdx] = {
        role: 'user',
        content: [
          { type: 'text', text: textContent || '请分析这张图片' },
          ...req.attachments.map(a => ({ type: 'image_url', image_url: { url: a.dataUrl } })),
        ],
      }
    }
  }

  // V3.1: 累积所有轮次的内容（修复中间内容消失 bug）
  // 历史 bug（2026-07-06）：多轮工具调用时，每轮输出的部分内容通过 onStreamToken 追加到 UI，
  // 但最终 return 只返回最后一轮的 content，AIChatPanel 用 result.content 覆盖整个消息，
  // 导致前面轮次的内容全部丢失。修复：累积所有轮次内容，最终返回完整累积值。
  let accumulatedContent = ''
  let accumulatedReasoning = ''

  for (let round = 0; round < maxRounds; round++) {
    // 调用 LLM（V4: 优先真流式，失败自动回退到 V3 非流式）
    const payload = {
      action: 'chat',
      modelId: model.id,
      modelType: model.type,
      ...(model.type === 'custom' ? {
        customBaseUrl: model.baseUrl,
        customApiKey: model.apiKey,
        customModelName: model.modelId,
        provider: model.provider,
      } : {}),
      systemPrompt: undefined, // 已在 messages 中
      messages: currentMessages,
      tools,       // 工具定义
      stream: false,
    }

    // V4: 真流式调用（Cloudflare Worker SSE），实时回调 onStreamToken
    // BYOK 模式或未配置代理时，callStreamProxy 内部自动回退到 callFunctionWithRetry
    const res = await callStreamProxy(payload, {
      onStreamToken: (token) => req.onStreamToken?.(token),
      onReasoning: (token) => req.onReasoning?.(token),
    })
    if (res.code !== 0 || !res.data) {
      throw new Error(res.message || 'AI 调用失败')
    }

    const llmResponse = res.data
    // V2: 上报 Token 用量（BYOK 模式自动跳过）
    reportUsageIfNeeded(llmResponse.usage, model.id)
    const toolCalls = llmResponse.tool_calls || llmResponse.choices?.[0]?.message?.tool_calls

    // V4.1: 分段生成（streamChatChunked）已实时调用 onStreamToken 输出到 UI
    // Worker 流式（callStreamProxy）也已实时调用 onStreamToken
    // 这里只做累积，不再重复调用 onStreamToken（避免内容重复显示）
    const partialContent = llmResponse.content || llmResponse.choices?.[0]?.message?.content || ''
    const partialReasoning = llmResponse.reasoning || llmResponse.choices?.[0]?.message?.reasoning_content || ''
    if (partialContent) {
      accumulatedContent += partialContent
    }
    if (partialReasoning) {
      accumulatedReasoning += partialReasoning
    }

    // 无工具调用 → 最终回复
    if (!toolCalls || toolCalls.length === 0) {
      // 决策锁自动校验（真实运行：Agent AI 输出自动经过四道关卡校验）
      const lockResult = await applyDecisionLockAutoCheck(
        userText, accumulatedContent, accumulatedReasoning, req.onStreamToken,
      )
      if (lockResult.blocked) {
        accumulatedContent = lockResult.content
      }
      // 流式输出（最终回复）—— 如果已经通过 onStreamToken 输出过，则不再重复
      if (req.onToken && !req.onStreamToken) {
        await streamOutput(accumulatedContent, req.onToken, accumulatedReasoning, req.onReasoning)
      }

      return {
        content: accumulatedContent,
        reasoning: accumulatedReasoning,
        searchResults,
        modelId: model.id,
        toolCalls: allToolCalls,
      }
    }

    // 有工具调用 → 执行工具
    // 把 assistant 的 tool_calls 消息加入历史
    currentMessages.push({
      role: 'assistant',
      content: partialContent,
      tool_calls: toolCalls,
    } as any)

    // 逐个执行工具
    for (const tc of toolCalls) {
      const fnName = tc.function?.name || tc.name
      let fnArgs = {}
      try {
        fnArgs = JSON.parse(tc.function?.arguments || tc.arguments || '{}')
      } catch { /* 忽略 */ }

      // V3: 工具执行前通知 UI（让用户看到"正在调用 X"带参数）
      req.onToolCallStart?.(fnName, fnArgs)

      const t0 = Date.now()
      // V3: 工具调用带重试（非 inline_edit 等交互工具）
      let result: string
      if (fnName === 'inline_edit') {
        // 交互工具不重试
        result = await executeTool(fnName, fnArgs, toolExecContext)
      } else {
        // 其他工具重试 1 次
        try {
          result = await executeTool(fnName, fnArgs, toolExecContext)
        } catch (e) {
          console.warn(`[aiClient] 工具 ${fnName} 第 1 次失败：${(e as Error).message}，重试中...`)
          try {
            result = await executeTool(fnName, fnArgs, toolExecContext)
          } catch (e2) {
            result = `❌ 工具 ${fnName} 执行失败（已重试）：${(e2 as Error).message}`
          }
        }
      }
      const duration = Date.now() - t0
      allToolCalls.push({ name: fnName, args: fnArgs, result })
      // 工具执行后再通知一次（带结果）
      req.onToolCall?.(fnName, fnArgs, result)

      // 记录到 MCP 日志 store（MCPPanel 实时展示）
      const truncated = result.length > 500 ? result.slice(0, 500) + '...' : result
      getMCPLogStore().add({
        toolName: fnName,
        params: fnArgs,
        result: truncated,
        duration,
      })

      // 上报 skill_usage 事件到 events 集合（8维护盾真实数据源）
      if (fnName.startsWith('metago_')) {
        try {
          const { reportEventCloud } = await import('./cloudFunctions')
          reportEventCloud('skill_usage', {
            skillId: fnName,
            toolName: fnName,
            duration,
            success: !result.startsWith('❌'),
          }).catch(() => {})
        } catch { /* 非阻塞 */ }
      }

      // 自动捕获元进化/元创造工具调用到进化档案（真实运行验证）
      if (fnName === 'metago_meta_evolve' || fnName === 'metago_meta_create') {
        try {
          const { useStore } = await import('../store/useStore')
          useStore.getState().captureEvolutionFromToolCall(fnName, fnArgs, result)
        } catch { /* 非阻塞：store 不可用时静默降级 */ }
      }

      // 把工具结果加入消息历史
      currentMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        name: fnName,
        content: result,
      } as any)
    }

    // 继续下一轮，让 LLM 基于工具结果继续
  }

  // 达到最大轮数，强制获取最终回复（V4.1: 使用分段生成，避免超时）
  const finalPayload = {
    action: 'chat',
    modelId: model.id,
    modelType: model.type,
    messages: currentMessages,
    stream: false,
  }

  const finalRes = await streamChatChunked(finalPayload, {
    onStreamToken: (token) => req.onStreamToken?.(token),
    onReasoning: (token) => req.onReasoning?.(token),
  })
  // V2: 上报 Token 用量（fallback 路径）
  reportUsageIfNeeded(finalRes.data?.usage, model.id)
  const finalContent = finalRes.data?.content || '达到最大工具调用轮数。'
  // 累积最终内容（防止 fallback 路径也丢内容）
  accumulatedContent += finalContent

  // 决策锁自动校验（fallback 路径同样校验）
  const lockResult = await applyDecisionLockAutoCheck(
    userText, accumulatedContent, accumulatedReasoning || undefined, req.onStreamToken,
  )
  if (lockResult.blocked) {
    accumulatedContent = lockResult.content
  }

  if (req.onToken && !req.onStreamToken) {
    await streamOutput(accumulatedContent, req.onToken)
  }

  return {
    content: accumulatedContent,
    searchResults,
    modelId: model.id,
    toolCalls: allToolCalls,
  }
}

// ============ 简化版（无工具调用，用于 Git 提交消息等） ============

export async function sendSimpleChat(
  messages: Array<{ role: string; content: string }>,
  modelId: string,
  systemPrompt?: string,
): Promise<string> {
  const model = findModel(modelId)
  if (!model) throw new Error(`未找到模型：${modelId}`)

  const res = await callFunctionWithRetry<{ content: string; usage?: any }>('aiProxy', {
    action: 'chat',
    modelId: model.id,
    modelType: model.type,
    systemPrompt,
    messages,
    stream: false,
  })

  if (res.code !== 0 || !res.data) {
    throw new Error(res.message || 'AI 调用失败')
  }
  // V2: 上报 Token 用量（BYOK 模式自动跳过）
  reportUsageIfNeeded(res.data.usage, model.id)
  return res.data.content
}

// ============ 流式输出（模拟） ============

async function streamOutput(
  content: string,
  onToken: (t: string) => void,
  reasoning?: string,
  onReasoning?: (t: string) => void,
): Promise<void> {
  const CHUNK = 4
  const DELAY = 12

  if (reasoning && onReasoning) {
    for (let i = 0; i < reasoning.length; i += CHUNK) {
      onReasoning(reasoning.slice(i, i + CHUNK))
      await new Promise(r => setTimeout(r, DELAY))
    }
  }

  for (let i = 0; i < content.length; i += CHUNK) {
    onToken(content.slice(i, i + CHUNK))
    await new Promise(r => setTimeout(r, DELAY))
  }
}

// ============ 模型路由 ============

export function autoRouteModel(messages: ChatMessage[], hasAttachment: boolean): string {
  if (hasAttachment) return 'glm-5v-turbo'
  const hasImage = messages.some(m =>
    m.content.includes('data:image') ||
    m.content.includes('.png') ||
    m.content.includes('.jpg')
  )
  return hasImage ? 'glm-5v-turbo' : 'deepseek-v4-pro'
}
