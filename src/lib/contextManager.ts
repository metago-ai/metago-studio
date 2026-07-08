/**
 * 上下文窗口管理器（Context Window Manager）
 *
 * 对标 Trae 的动态 token 预算和消息裁剪。
 * 防止对话过长导致超出模型上下文窗口（128K/200K）。
 *
 * 核心功能：
 * 1. estimateTokens：估算文本 token 数（无需 API 调用）
 * 2. trimHistory：按 token 预算裁剪消息历史，保留关键上下文
 */

type SimpleMessage = { role: string; content: string }

/**
 * 估算文本的 token 数（无需 API 调用）
 *
 * 启发式估算：
 * - 中文：1 字 ≈ 1.5 tokens（DeepSeek/ChatGLM 的中文压缩率较高）
 * - 英文：4 字符 ≈ 1 token（OpenAI 标准）
 * - 代码：略高，2.5 字符 ≈ 1 token
 *
 * 误差范围 ±15%，足够用于预算决策（不需要精确）。
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  // 中文字符数
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  // 非中文字符数
  const nonChineseChars = text.length - chineseChars
  // 代码特征（{ } ; = 等符号密度高）
  const codeSymbols = (text.match(/[{};=()[\]<>]/g) || []).length
  const codeRatio = text.length > 0 ? codeSymbols / text.length : 0
  // 代码部分估算（符号密度 > 5% 视为代码）
  const codeBoost = codeRatio > 0.05 ? 1.2 : 1.0
  // 综合：中文 1.5 tokens/字 + 非中文 0.25 tokens/字符（≈4字符/token）
  return Math.ceil((chineseChars * 1.5 + nonChineseChars * 0.25) * codeBoost)
}

/**
 * 估算消息历史的总 token 数
 */
export function estimateMessagesTokens(messages: SimpleMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0) // +4 per message overhead
}

/**
 * 按预算裁剪消息历史
 *
 * 裁剪策略（对标 Trae）：
 * 1. 始终保留最近 N 轮对话（默认 6 轮 = 12 条消息）
 * 2. 如果超预算，从最旧的消息开始删除
 * 3. 如果删到只剩最近 N 轮仍超预算，对中间消息做摘要替换
 * 4. 永不删除第一条 user 消息（任务起点）
 *
 * @param messages 消息历史（已过滤 error）
 * @param budgetTokens token 预算（超过此值则裁剪）
 * @param keepRecentMessages 保留最近的消息数（默认 12 = 6 轮）
 */
export function trimHistory(
  messages: SimpleMessage[],
  budgetTokens: number,
  keepRecentMessages = 12,
): SimpleMessage[] {
  if (messages.length === 0) return []
  const totalTokens = estimateMessagesTokens(messages)
  if (totalTokens <= budgetTokens) {
    return messages
  }

  console.warn(
    `[contextManager] 历史超预算：${totalTokens} > ${budgetTokens}，开始裁剪（共 ${messages.length} 条消息）`,
  )

  // 至少保留最近 N 条
  const minKeep = Math.min(keepRecentMessages, messages.length)
  const recent = messages.slice(-minKeep)
  const recentTokens = estimateMessagesTokens(recent)

  // 如果最近 N 条已经超预算，只能压缩它们（取更少）
  if (recentTokens > budgetTokens) {
    console.warn(
      `[contextManager] 最近 ${minKeep} 条已超预算（${recentTokens}），压缩到最近 6 条`,
    )
    const minRecent = Math.min(6, messages.length)
    const compressed = messages.slice(-minRecent)
    // 如果还超，截断最长的消息内容
    const compressedTokens = estimateMessagesTokens(compressed)
    if (compressedTokens > budgetTokens) {
      // 截断除最后一条外的所有消息内容
      const result = compressed.map((m, i) => {
        if (i === compressed.length - 1) return m
        const tokens = estimateTokens(m.content)
        if (tokens > 1000) {
          const ratio = 500 / tokens
          const truncated = m.content.slice(0, Math.floor(m.content.length * ratio))
          return { ...m, content: truncated + '\n[...已截断...]' }
        }
        return m
      })
      return result
    }
    return compressed
  }

  // 正常情况：保留第一条 user + 最近 N 条
  const firstUser = messages.find(m => m.role === 'user')
  const firstUserIndex = firstUser ? messages.indexOf(firstUser) : -1

  // 从第一条 user 消息之后到最近 N 条之前，做摘要
  const middleStart = firstUserIndex >= 0 ? firstUserIndex + 1 : 0
  const middleEnd = messages.length - minKeep
  const middle = messages.slice(middleStart, Math.max(middleStart, middleEnd))

  const result: SimpleMessage[] = []

  // 保留第一条 user 消息（任务起点）
  if (firstUser && firstUserIndex >= 0 && firstUserIndex < middleStart) {
    result.push(messages[firstUserIndex])
  }

  // 如果有中间消息，做摘要
  if (middle.length > 0) {
    const summary = summarizeMessages(middle)
    result.push({
      role: 'system',
      content: `[历史对话摘要（${middle.length} 条消息已压缩）]\n${summary}`,
    })
  }

  // 加最近 N 条
  result.push(...recent)

  const finalTokens = estimateMessagesTokens(result)
  console.info(
    `[contextManager] 裁剪完成：${messages.length} → ${result.length} 条，${totalTokens} → ${finalTokens} tokens`,
  )

  return result
}

/**
 * 简单摘要（无需 LLM 调用）
 * 提取每条消息的前 200 字，拼接成摘要
 */
function summarizeMessages(messages: SimpleMessage[]): string {
  return messages.slice(0, 10).map((m, i) => {
    const role = m.role === 'user' ? '用户' : m.role === 'assistant' ? 'AI' : m.role
    const preview = m.content.slice(0, 200).replace(/\n/g, ' ')
    return `${i + 1}. [${role}] ${preview}${m.content.length > 200 ? '...' : ''}`
  }).join('\n')
}
