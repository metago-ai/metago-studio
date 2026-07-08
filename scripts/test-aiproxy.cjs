// 测试 aiProxy 云函数：验证简单对话和工具调用场景
// Node 22+ 已内置 fetch

const AIPROXY_URL = 'https://metago-d6gfw1e4rf2a5bcad-1257074864.ap-shanghai.app.tcloudbase.com/api/aiproxy'
const TEST_UID = 'test_verify_uid_' + Date.now()

async function testSimple() {
  const payload = {
    action: 'chat',
    modelId: 'deepseek-v4-pro',
    messages: [{ role: 'user', content: '你好，请简单介绍一下你自己，一句话即可' }],
    stream: false,
    _clientUid: TEST_UID,
  }
  console.log('[test-simple] 发送简单对话请求...')
  const t0 = Date.now()
  try {
    const res = await fetch(AIPROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`[test-simple] ✅ ${elapsed}s | code=${data.code}`)
    console.log(`[test-simple] 回复: ${(data.data?.content || '').slice(0, 100)}`)
    return { success: true, elapsed, content: data.data?.content }
  } catch (e) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.error(`[test-simple] ❌ ${elapsed}s | ${e.message}`)
    return { success: false, elapsed, error: e.message }
  }
}

async function testWithTools() {
  const payload = {
    action: 'chat',
    modelId: 'deepseek-v4-pro',
    messages: [{ role: 'user', content: '请列出当前工作区的所有文件' }],
    stream: false,
    _clientUid: TEST_UID,
  }
  console.log('\n[test-tools] 发送带工具调用的请求（会触发 list_files 工具）...')
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
        console.log(`  - ${tc.function?.name || tc.name}`)
      })
    }
    console.log(`[test-tools] 回复前 100 字: ${content.slice(0, 100)}`)
    return { success: true, elapsed, content, toolCalls }
  } catch (e) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.error(`[test-tools] ❌ ${elapsed}s | ${e.message}`)
    return { success: false, elapsed, error: e.message }
  }
}

;(async () => {
  console.log('=== aiProxy 端到端验证 ===\n')
  const simple = await testSimple()
  const tools = await testWithTools()

  console.log('\n=== 验证总结 ===')
  console.log(`简单对话: ${simple.success ? '✅' : '❌'} (${simple.elapsed}s)`)
  console.log(`工具调用: ${tools.success ? '✅' : '❌'} (${tools.elapsed}s)`)

  if (!simple.success || !tools.success) {
    process.exit(1)
  }
})()
