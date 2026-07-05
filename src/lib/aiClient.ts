/**
 * AI 核心调度层（V2 - 环境感知 + 工具调用）
 *
 * 核心升级：
 * 1. 动态 System Prompt（环境感知）
 * 2. Function Call 支持（AI 自动调用文件/搜索/Git 工具）
 * 3. 多轮工具调用循环（直到任务完成）
 */

import { callFunction } from './cloudFunctions'
import { findModel } from './modelRegistry'
import { decideSearch } from './searchDecider'
import { webSearch, formatSearchResultsForPrompt } from './searchEngine'
import { buildSystemPrompt, getToolDefinitions, executeTool, type EnvironmentContext } from './agent/systemPrompt'
import { getMCPLogStore } from './mcpRegistry'
import { recordUsage, extractUsage } from './tokenMeter'
import { isByokActive } from './byokService'
import type { ChatMessage, SearchMode } from '../types'

// ============ 对话请求 ============

export interface ChatRequest {
  messages: ChatMessage[]
  modelId: string
  searchMode: SearchMode
  /** 环境上下文（用于动态 System Prompt） */
  envContext?: EnvironmentContext
  /** 流式回调 */
  onToken?: (token: string) => void
  /** 流式回调（思考过程） */
  onReasoning?: (token: string) => void
  /** 工具调用回调（展示 AI 在做什么） */
  onToolCall?: (toolName: string, args: Record<string, unknown>, result: string) => void
  /** 最大工具调用轮数 */
  maxToolRounds?: number
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

export async function sendChat(req: ChatRequest): Promise<{
  content: string
  reasoning?: string
  searchResults?: ChatMessage['searchResults']
  modelId: string
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; result: string }>
}> {
  const model = findModel(req.modelId)
  if (!model) throw new Error(`未找到模型：${req.modelId}`)

  // 1. 构建动态 System Prompt
  const systemPrompt = req.envContext
    ? await buildSystemPrompt(req.envContext)
    : '你是 MetaGO Agent，元构超级智能生命体的核心智能体。'

  // 2. 判断联网
  const lastUserMsg = [...req.messages].reverse().find(m => m.role === 'user')
  const userText = lastUserMsg?.content ?? ''
  const decision = decideSearch(userText, req.envContext?.selectedCode, req.searchMode)

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

  const fullSystemPrompt = searchContext
    ? `${systemPrompt}\n\n--- 联网搜索结果 ---\n${searchContext}`
    : systemPrompt

  // 3. 组装消息历史
  const history = req.messages
    .filter(m => !m.error)
    .map(m => ({ role: m.role, content: m.content }))

  // 4. 工具定义
  const tools = getToolDefinitions()
  const maxRounds = req.maxToolRounds ?? 8
  const allToolCalls: Array<{ name: string; args: Record<string, unknown>; result: string }> = []

  // 5. 多轮工具调用循环
  let currentMessages = [
    { role: 'system', content: fullSystemPrompt },
    ...history,
  ]

  for (let round = 0; round < maxRounds; round++) {
    // 调用 LLM
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

    const res = await callFunction<any>('aiProxy', payload)
    if (res.code !== 0 || !res.data) {
      throw new Error(res.message || 'AI 调用失败')
    }

    const llmResponse = res.data
    // V2: 上报 Token 用量（BYOK 模式自动跳过）
    reportUsageIfNeeded(llmResponse.usage, model.id)
    const toolCalls = llmResponse.tool_calls || llmResponse.choices?.[0]?.message?.tool_calls

    // 无工具调用 → 最终回复
    if (!toolCalls || toolCalls.length === 0) {
      const content = llmResponse.content || llmResponse.choices?.[0]?.message?.content || ''
      const reasoning = llmResponse.reasoning || llmResponse.choices?.[0]?.message?.reasoning_content || ''

      // 流式输出（最终回复）
      if (req.onToken) {
        await streamOutput(content, req.onToken, reasoning, req.onReasoning)
      }

      return {
        content,
        reasoning,
        searchResults,
        modelId: model.id,
        toolCalls: allToolCalls,
      }
    }

    // 有工具调用 → 执行工具
    // 把 assistant 的 tool_calls 消息加入历史
    currentMessages.push({
      role: 'assistant',
      content: llmResponse.content || '',
      tool_calls: toolCalls,
    } as any)

    // 逐个执行工具
    for (const tc of toolCalls) {
      const fnName = tc.function?.name || tc.name
      let fnArgs = {}
      try {
        fnArgs = JSON.parse(tc.function?.arguments || tc.arguments || '{}')
      } catch { /* 忽略 */ }

      const t0 = Date.now()
      const result = await executeTool(fnName, fnArgs)
      const duration = Date.now() - t0
      allToolCalls.push({ name: fnName, args: fnArgs, result })
      req.onToolCall?.(fnName, fnArgs, result)

      // 记录到 MCP 日志 store（MCPPanel 实时展示）
      const truncated = result.length > 500 ? result.slice(0, 500) + '...' : result
      getMCPLogStore().add({
        toolName: fnName,
        params: fnArgs,
        result: truncated,
        duration,
      })

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

  // 达到最大轮数，强制获取最终回复
  const finalPayload = {
    action: 'chat',
    modelId: model.id,
    modelType: model.type,
    messages: currentMessages,
    stream: false,
  }

  const finalRes = await callFunction<any>('aiProxy', finalPayload)
  // V2: 上报 Token 用量（fallback 路径）
  reportUsageIfNeeded(finalRes.data?.usage, model.id)
  const finalContent = finalRes.data?.content || '达到最大工具调用轮数。'

  if (req.onToken) {
    await streamOutput(finalContent, req.onToken)
  }

  return {
    content: finalContent,
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

  const res = await callFunction<{ content: string; usage?: any }>('aiProxy', {
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
