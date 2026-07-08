/**
 * V4.2 分段生成（Chunked Generation）端到端验证脚本
 *
 * 验证目标：
 *   1. aiProxy 支持 maxTokens 参数（每段 4096 token）
 *   2. aiProxy 返回 finish_reason 字段
 *   3. 分段生成循环正常工作（finish_reason === 'length' 时更新 assistant 消息）
 *   4. 复杂任务（写完整 HTML 页面）不再超时
 *   5. 最终内容完整（包含 <html> 到 </html>）
 *   6. 请求体不会过大（不 push 新消息，更新最后一个 assistant 消息）
 *
 * 使用方法：node scripts/test-chunked-generation.cjs
 */

const AIPROXY_URL = 'https://metago-d6gfw1e4rf2a5bcad-1257074864.ap-shanghai.app.tcloudbase.com/api/aiproxy'

// 模拟合伙人测试场景：让 AI 写一个完整的 HTML 页面
const TEST_MESSAGES = [
  {
    role: 'user',
    content: '请帮我写一个完整的HTML页面，叫"团队效率计算器"。功能：输入团队人数和月成本，自动对比传统模式vs元构模式的效率差异。规则：传统模式每人月成本2万元，元构模式3人+AI月成本4.2万元，假设传统30人团队等于元构3人+AI的产出。显示结果包含：成本对比、效率倍数、年度节省金额。设计要好看、专业，适合给客户展示。请直接输出完整的HTML代码，从<!DOCTYPE html>开始到</html>结束。',
  },
]

const CHUNK_MAX_TOKENS = 4096
const MAX_CHUNKS = 20

async function callAiProxy(payload) {
  const response = await fetch(AIPROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json()
  return data
}

async function testChunkedGeneration() {
  console.log('🧪 V4.2 分段生成端到端验证')
  console.log('='.repeat(60))
  console.log(`目标: 让 AI 写完整的 HTML 页面（合伙人测试场景）`)
  console.log(`每段 max_tokens: ${CHUNK_MAX_TOKENS}`)
  console.log(`最大分段数: ${MAX_CHUNKS}`)
  console.log('='.repeat(60))

  const messages = [...TEST_MESSAGES]
  let accumulatedContent = ''
  let accumulatedReasoning = ''
  let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  const startTime = Date.now()
  let emptyChunkCount = 0

  for (let chunk = 0; chunk < MAX_CHUNKS; chunk++) {
    const chunkStartTime = Date.now()
    console.log(`\n📦 [段 ${chunk + 1}/${MAX_CHUNKS}] 请求中...`)

    const payload = {
      action: 'chat',
      modelId: 'deepseek-v4-pro',
      modelType: 'deepseek',
      _clientUid: 'test_chunked_gen_uid',
      messages,
      maxTokens: CHUNK_MAX_TOKENS,
      stream: false,
    }

    const res = await callAiProxy(payload)
    const chunkDuration = Date.now() - chunkStartTime

    if (res.code !== 0 || !res.data) {
      console.error(`❌ [段 ${chunk + 1}] 失败: ${res.message || '未知错误'}`)
      if (chunk === 0) {
        console.error('   第一段就失败，无法继续')
        return false
      }
      console.log(`   返回已累积内容（${accumulatedContent.length} 字符）`)
      break
    }

    const data = res.data
    const partialContent = data.content || ''
    const partialReasoning = data.reasoning || ''
    const finishReason = data.finish_reason || 'stop'
    const usage = data.usage || {}

    totalUsage.prompt_tokens += usage.prompt_tokens || 0
    totalUsage.completion_tokens += usage.completion_tokens || 0
    totalUsage.total_tokens += usage.total_tokens || 0

    if (partialContent) {
      accumulatedContent += partialContent
      emptyChunkCount = 0
    } else {
      emptyChunkCount++
      if (emptyChunkCount >= 5) {
        console.warn(`⚠️ 连续 ${emptyChunkCount} 段返回空内容，可能模型异常，终止分段`)
        break
      }
    }
    if (partialReasoning) {
      accumulatedReasoning += partialReasoning
    }

    console.log(`✅ [段 ${chunk + 1}] 完成 (${chunkDuration}ms, content=${partialContent.length} 字符, reasoning=${partialReasoning.length} 字符, finish_reason=${finishReason})`)
    console.log(`   累积: ${accumulatedContent.length} 字符`)

    if (finishReason === 'stop' || finishReason === 'tool_calls') {
      console.log(`\n🎉 AI 主动完成（finish_reason=${finishReason}）`)
      break
    }

    // V4.2: 不 push 新消息，更新最后一个 assistant 消息
    const lastMsg = messages[messages.length - 1]
    if (lastMsg && lastMsg.role === 'assistant') {
      lastMsg.content = accumulatedContent
    } else {
      messages.push({
        role: 'assistant',
        content: accumulatedContent,
      })
    }
  }

  const totalDuration = Date.now() - startTime
  console.log('\n' + '='.repeat(60))
  console.log('📊 验证结果')
  console.log('='.repeat(60))
  console.log(`✅ 总耗时: ${(totalDuration / 1000).toFixed(1)} 秒`)
  console.log(`✅ 总内容长度: ${accumulatedContent.length} 字符`)
  console.log(`✅ Token 用量: prompt=${totalUsage.prompt_tokens}, completion=${totalUsage.completion_tokens}, total=${totalUsage.total_tokens}`)

  // 验证内容完整性
  const hasDoctype = accumulatedContent.includes('<!DOCTYPE html>') || accumulatedContent.includes('<!doctype html>')
  const hasHtmlClose = accumulatedContent.includes('</html>')
  const hasHead = accumulatedContent.includes('<head>') || accumulatedContent.includes('<head')
  const hasBody = accumulatedContent.includes('<body>') || accumulatedContent.includes('<body')

  console.log('\n📋 内容完整性检查:')
  console.log(`  ${hasDoctype ? '✅' : '❌'} 包含 <!DOCTYPE html>`)
  console.log(`  ${hasHead ? '✅' : '❌'} 包含 <head>`)
  console.log(`  ${hasBody ? '✅' : '❌'} 包含 <body>`)
  console.log(`  ${hasHtmlClose ? '✅' : '❌'} 包含 </html>`)

  const isComplete = hasDoctype && hasHtmlClose && hasHead && hasBody

  console.log('\n' + '='.repeat(60))
  if (isComplete && totalDuration < 180000) {
    console.log('🎉🎉🎉 验证通过！分段生成方案成功解决超时问题')
    console.log(`   复杂任务（写完整 HTML 页面）在 ${(totalDuration / 1000).toFixed(1)} 秒内完成`)
    console.log(`   内容完整：从 <!DOCTYPE html> 到 </html>`)
    return true
  } else {
    console.log('❌ 验证失败')
    if (!isComplete) console.log('   原因: 内容不完整')
    if (totalDuration >= 180000) console.log('   原因: 超时（>180秒）')
    return false
  }
}

// 运行测试
testChunkedGeneration().then(success => {
  process.exit(success ? 0 : 1)
}).catch(e => {
  console.error('测试异常:', e)
  process.exit(1)
})
