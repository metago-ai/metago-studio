/**
 * aiProxy 响应速度测试脚本
 * 测试关闭推理模式后的实际响应时间
 */
const tcb = require('@cloudbase/node-sdk')

const app = tcb.init({ env: 'metago-d6gfw1e4rf2a5bcad' })

async function test() {
  const startTime = Date.now()
  console.log('[test] 开始调用 aiProxy.chat（关闭推理模式）...')

  try {
    const result = await app.callFunction({
      name: 'aiProxy',
      data: {
        action: 'chat',
        modelId: 'deepseek-v4-pro',
        messages: [
          { role: 'user', content: '写一个简单的Hello World网页，包含标题和按钮' }
        ],
      },
    })

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[test] 耗时: ${elapsed}s`)
    console.log(`[test] code: ${result.result.code}`)

    if (result.result.code === 0 && result.result.data) {
      const content = result.result.data.content || ''
      console.log(`[test] 内容长度: ${content.length} 字符`)
      console.log(`[test] 内容前200字: ${content.substring(0, 200)}`)
      console.log(`[test] usage:`, JSON.stringify(result.result.data.usage))
    } else {
      console.log(`[test] 失败:`, result.result.message)
    }
  } catch (e) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.error(`[test] 异常（${elapsed}s）:`, e.message)
  }
}

test()
