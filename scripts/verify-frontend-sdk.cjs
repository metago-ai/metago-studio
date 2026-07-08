/**
 * 模拟前端 CloudBase SDK 调用 aiProxy 的完整链路
 *
 * 使用 @cloudbase/js-sdk（前端 SDK），polyfill localStorage
 * 验证 _clientUid 传递 + 云函数返回非 401
 */

// Polyfill localStorage（Node.js 没有原生 localStorage）
const localStorageMap = new Map()
global.localStorage = {
  getItem: (key) => localStorageMap.get(key) ?? null,
  setItem: (key, val) => localStorageMap.set(key, String(val)),
  removeItem: (key) => localStorageMap.delete(key),
  clear: () => localStorageMap.clear(),
}

// Polyfill window（部分 SDK 内部可能引用）
if (!global.window) {
  global.window = {
    localStorage: global.localStorage,
  }
}

const cloudbase = require('@cloudbase/js-sdk')

const ENV_ID = 'metago-d6gfw1e4rf2a5bcad'

async function main() {
  console.log('========================================')
  console.log('  前端 SDK 完整调用链验证')
  console.log('========================================\n')

  // [1] 初始化 CloudBase SDK（与 cloudbase.ts getApp() 一致）
  console.log('[1] 初始化 CloudBase SDK...')
  const app = cloudbase.init({
    env: ENV_ID,
    region: 'ap-shanghai',
    persistence: 'local',
  })

  // [2] 模拟 cloudFunctions.ts callFunction 的 skipAuth 逻辑
  console.log('[2] 模拟 skipAuth 逻辑（aiProxy 允许未登录调用）...')

  let currentUid = null

  // 优先使用已登录用户的 userId（这里没有，所以为 null）
  currentUid = localStorage.getItem('metago_user_id')
  console.log(`    getLoggedInUserId(): ${currentUid || 'null'}`)

  // 尝试匿名登录
  try {
    const auth = app.auth({ persistence: 'local' })
    if (!auth.hasLoginState()) {
      console.log('    无登录态，尝试匿名登录...')
      const loginResult = await auth.signInAnonymously()
      if (!currentUid) {
        if (loginResult?.user?.uid) {
          currentUid = loginResult.user.uid
          console.log(`    匿名登录成功，uid: ${currentUid}`)
        } else if (loginResult?.uid) {
          currentUid = loginResult.uid
          console.log(`    匿名登录成功，uid: ${currentUid}`)
        }
      }
    } else {
      console.log('    已有登录态')
    }

    // 兜底：从 currentUser 获取
    if (!currentUid) {
      const currentUser = await auth.currentUser?.()
      if (currentUser?.uid) {
        currentUid = currentUser.uid
        console.log(`    从 currentUser 获取 uid: ${currentUid}`)
      }
    }
  } catch (e) {
    console.log(`    匿名登录失败（可能控制台未启用）: ${e.message}`)
  }

  // 终极兜底：本地生成匿名 ID（与 cloudFunctions.ts 一致，在 try/catch 外面）
  if (!currentUid) {
    console.log('    [终极兜底] 生成本地 anon ID...')
    const LOCAL_KEY = 'metago_anon_uid'
    let anonUid = localStorage.getItem(LOCAL_KEY)
    if (!anonUid) {
      anonUid = 'anon_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10)
      localStorage.setItem(LOCAL_KEY, anonUid)
    }
    currentUid = anonUid
    console.log(`    生成本地 anon ID: ${currentUid}`)
  }

  console.log(`\n[3] 最终 currentUid: ${currentUid}`)

  // [4] 构造 payload 并调用云函数
  const payload = {
    action: 'chat',
    modelId: 'deepseek-v4-pro',
    modelType: 'deepseek',
    messages: [
      { role: 'user', content: '回复"pong"两个字' }
    ],
    systemPrompt: '你是 MetaGO Agent。请简短回复。',
    _clientUid: currentUid,
  }

  console.log('\n[4] 调用 aiProxy 云函数...')
  console.log(`    payload._clientUid: ${payload._clientUid}`)

  try {
    const res = await app.callFunction({
      name: 'aiProxy',
      data: payload,
    })

    console.log(`\n[5] 响应:`)
    console.log(`    requestId: ${res?.requestId || '无'}`)
    console.log(`    result: ${res?.result !== undefined ? JSON.stringify(res?.result).slice(0, 300) : 'undefined'}`)
    console.log(`    code: ${res?.code}`)
    console.log(`    message: ${res?.message}`)
    console.log(`    完整响应: ${JSON.stringify(res).slice(0, 800)}`)

    // 验证
    console.log('\n========================================')
    console.log('  验证结果')
    console.log('========================================')

    // 修复后的 result 检查逻辑
    let returnData
    if (res?.result !== undefined && res?.result !== null) {
      returnData = res.result
    } else if (res?.code !== undefined) {
      returnData = { code: res.code, message: res.message || '云函数业务错误', data: res.data ?? null }
    } else {
      returnData = { code: 500, message: '云函数返回空', data: null }
    }

    const is401 = returnData?.code === 401
    const hasValidData = returnData?.code === 0 || returnData?.data || returnData?.choices

    console.log(`✅ _clientUid 已传递: ${payload._clientUid ? '是' : '否'}`)
    console.log(`${!is401 ? '✅' : '❌'} 不再返回 401: ${!is401 ? '是' : '否（仍返回 401）'}`)
    console.log(`${hasValidData ? '✅' : '❌'} 返回有效数据: ${hasValidData ? '是' : '否'}`)

    if (is401) {
      console.log('\n❌ 验证失败：仍返回 401 未登录')
      process.exit(1)
    } else if (hasValidData) {
      console.log('\n✅ 验证通过：AI 对话链路正常')
      // 显示 AI 回复内容
      if (returnData?.data?.choices?.[0]?.message?.content) {
        console.log(`\nAI 回复: ${returnData.data.choices[0].message.content}`)
      } else if (returnData?.data?.message) {
        console.log(`\n返回消息: ${returnData.data.message}`)
      }
      process.exit(0)
    } else {
      console.log(`\n⚠️ 未返回 401，但数据格式异常`)
      console.log(`返回内容: ${JSON.stringify(returnData).slice(0, 300)}`)
      process.exit(1)
    }
  } catch (e) {
    console.error(`\n❌ 调用失败: ${e.message}`)
    console.error(e.stack)
    process.exit(1)
  }
}

main().catch(e => {
  console.error('未捕获异常:', e)
  process.exit(1)
})
