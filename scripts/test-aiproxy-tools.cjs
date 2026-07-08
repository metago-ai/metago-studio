// 测试 aiProxy 带 tools 的工具调用链路
const AIPROXY_URL = 'https://metago-d6gfw1e4rf2a5bcad-1257074864.ap-shanghai.app.tcloudbase.com/api/aiproxy'
const TEST_UID = 'test_tools_' + Date.now()

// 简化的工具定义（模拟 systemPrompt.ts 的 getToolDefinitions）
const tools = [
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: '列出指定目录下的文件和子目录',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '目录路径，默认为根目录', default: '' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: '读取指定文件的内容',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径' },
        },
        required: ['path'],
      },
    },
  },
]

async function testToolCall() {
  const payload = {
    action: 'chat',
    modelId: 'deepseek-v4-pro',
    messages: [{ role: 'user', content: '请列出当前工作区的所有文件' }],
    tools,
    stream: false,
    _clientUid: TEST_UID,
  }
  console.log('[test-tools] 发送带 tools 的请求...')
  const t0 = Date.now()
  try {
    const res = await fetch(AIPROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`[test-tools] ✅ ${elapsed}s | code=${data.code}`)
    const content = data.data?.content || ''
    const toolCalls = data.data?.tool_calls || data.data?.choices?.[0]?.message?.tool_calls
    console.log(`[test-tools] 回复长度: ${content.length} 字`)
    console.log(`[test-tools] 工具调用: ${toolCalls ? toolCalls.length + ' 个' : '无'}`)
    if (toolCalls) {
      toolCalls.forEach(tc => {
        console.log(`  - ${tc.function?.name || tc.name}(${tc.function?.arguments || tc.arguments || ''})`)
      })
    }
    if (content) console.log(`[test-tools] 回复前 150 字: ${content.slice(0, 150)}`)
    return { success: true, elapsed, content, toolCalls }
  } catch (e) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.error(`[test-tools] ❌ ${elapsed}s | ${e.message}`)
    return { success: false, elapsed, error: e.message }
  }
}

;(async () => {
  console.log('=== aiProxy 工具调用链路验证 ===\n')
  const result = await testToolCall()
  console.log(`\n结论: ${result.success && result.toolCalls ? '✅ 工具调用链路正常' : '⚠️ AI 未调用工具（可能 DeepSeek 判断不需要）'}`)
})()
