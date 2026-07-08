/**
 * 直接测试 DeepSeek API 响应速度（关闭推理模式）
 * 模拟合伙人测试场景：写一个完整的HTML页面
 */
const https = require('https')

const API_KEY = process.env.DEEPSEEK_API_KEY || ''
const API_URL = 'https://api.deepseek.com/chat/completions'

const testPrompt = `请帮我写一个完整的HTML页面，叫"团队效率计算器"。
功能：输入团队人数和月成本，自动对比传统模式vs元构模式的效率差异。
规则：
- 传统模式：每人月成本2万元
- 元构模式：3人+AI，月成本4.2万元
- 假设传统30人团队等于元构3人+AI的产出
- 显示结果包含：成本对比、效率倍数、年度节省金额
- 设计要好看、专业，适合给客户展示`

async function test() {
  if (!API_KEY) {
    console.error('[test] 请设置 DEEPSEEK_API_KEY 环境变量')
    process.exit(1)
  }

  const startTime = Date.now()
  console.log('[test] 开始调用 DeepSeek API（关闭推理模式）...')
  console.log('[test] 测试场景：写一个完整的HTML页面')

  const requestBody = JSON.stringify({
    model: 'deepseek-v4-pro',
    messages: [{ role: 'user', content: testPrompt }],
    stream: false,
    max_tokens: 8192,
    // 不包含 thinking 和 reasoning_effort（关闭推理模式）
  })

  const options = {
    hostname: 'api.deepseek.com',
    path: '/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Length': Buffer.byteLength(requestBody),
    },
  }

  const req = https.request(options, (res) => {
    let data = ''
    res.on('data', (chunk) => { data += chunk })
    res.on('end', () => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`\n[test] 耗时: ${elapsed}s`)
      console.log(`[test] HTTP 状态码: ${res.statusCode}`)

      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices?.[0]?.message?.content || ''
        console.log(`[test] 内容长度: ${content.length} 字符`)
        console.log(`[test] usage:`, JSON.stringify(parsed.usage))
        console.log(`[test] 内容前300字:\n${content.substring(0, 300)}`)
        console.log(`\n[test] 结论: ${elapsed > 60 ? '❌ 超过60秒（会超时）' : '✅ 60秒内完成（不会超时）'}`)
      } catch (e) {
        console.error(`[test] 解析失败:`, e.message)
        console.log(`[test] 原始响应: ${data.substring(0, 500)}`)
      }
    })
  })

  req.on('error', (e) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.error(`[test] 错误（${elapsed}s）:`, e.message)
  })

  req.setTimeout(180000, () => {
    req.destroy(new Error('请求超时（180s）'))
  })

  req.write(requestBody)
  req.end()
}

test()
