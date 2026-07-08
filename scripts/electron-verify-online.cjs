/**
 * Electron 在线验证主进程（加载线上 Studio 页面）
 *
 * 加载 https://metago.life/studio/ 页面，等待页面完成匿名登录后，
 * 用 webContents.executeJavaScript 注入验证代码：
 *   1. 从 localStorage 读取 access_token
 *   2. 用 fetch 调用 CloudBase 云函数 API
 *   3. 验证返回 code=0 且 content 非空
 *
 * 这样请求从 https://metago.life 域名发出，能通过 CloudBase 网关的 Origin 检查。
 */

const { app, BrowserWindow } = require('electron')

let mainWindow = null
const VERIFY_URL = process.env.VERIFY_URL || 'https://metago.life/studio/#/agent'
const VERIFY_TIMEOUT_MS = 120000

let verifyTimeout = null
let gotResult = false

const INJECT_VERIFY_CODE = `
(async () => {
  function logStep(msg) {
    console.log('[VERIFY_STEP] ' + msg)
  }
  function logResult(result) {
    console.log('[VERIFY_RESULT]' + JSON.stringify(result))
  }

  try {
    logStep('页面已加载，等待 8 秒让 SDK 完成初始化和匿名登录')
    await new Promise(r => setTimeout(r, 8000))

    // 0. 打印 localStorage 所有键
    const lsKeys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      const v = localStorage.getItem(k)
      lsKeys.push({ key: k, valPreview: v ? v.slice(0, 80) : null })
    }
    logStep('localStorage 键数: ' + localStorage.length)
    console.log('[VERIFY_LS]' + JSON.stringify(lsKeys))

    // 1. 从 localStorage 读取 access_token
    logStep('从 localStorage 读取 access_token')
    let accessToken = null
    let uid = null
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      const val = localStorage.getItem(key)
      if (key && key.includes('credentials')) {
        try {
          const parsed = JSON.parse(val)
          accessToken = parsed.access_token || parsed.data?.access_token
          if (parsed.access_token) logStep('从 ' + key + ' 拿到 access_token (长度=' + parsed.access_token.length + ')')
        } catch (e) {}
      }
      if (key && key.includes('user_info')) {
        try {
          const parsed = JSON.parse(val)
          uid = parsed?.content?.sub || parsed?.sub || parsed?.user?.uid
          if (uid) logStep('从 ' + key + ' 拿到 uid=' + uid)
        } catch (e) {}
      }
    }

    // 2. 如果没有 token，主动调用匿名登录 API（需要 x-device-id header）
    let deviceId = null
    if (!accessToken) {
      logStep('未找到 access_token，用 fetch 调用匿名登录 API（含 x-device-id）')
      // 生成 32 位 hex device-id（模拟 SDK 行为）
      deviceId = Array.from({length: 32}, () => Math.floor(Math.random() * 16).toString(16)).join('')
      logStep('生成 deviceId=' + deviceId)
      try {
        const loginRes = await fetch('https://metago-d6gfw1e4rf2a5bcad.api.tcloudbasegateway.com/auth/v1/signin/anonymously?client_id=metago-d6gfw1e4rf2a5bcad', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-SDK-Version': '@cloudbase/js-sdk/3.6.1',
            'x-device-id': deviceId,
            'x-request-id': 'verify-' + Date.now(),
            'Accept-Language': 'zh-CN',
          },
          body: '{}',
        })
        logStep('匿名登录响应 status=' + loginRes.status + ', ok=' + loginRes.ok)
        const loginText = await loginRes.text()
        logStep('匿名登录响应体(前300): ' + loginText.slice(0, 300))
        try {
          const loginData = JSON.parse(loginText)
          accessToken = loginData.access_token
          uid = loginData.uid || (loginData.user && loginData.user.uid) || uid
          // 从 JWT 解析 uid（access_token 是 JWT，payload 里有 user_id）
          if (!uid && accessToken) {
            try {
              const payload = JSON.parse(atob(accessToken.split('.')[1]))
              uid = payload.sub || payload.user_id || uid
              logStep('从 JWT 解析 uid=' + uid)
            } catch (e) {}
          }
          logStep('解析后 accessToken=' + (accessToken ? '有(长度' + accessToken.length + ')' : '无') + ', uid=' + uid)
        } catch (e) {
          logStep('JSON 解析失败: ' + e.message)
        }
      } catch (e) {
        logStep('匿名登录 fetch 异常: ' + e.message + ' (name=' + e.name + ')')
      }
    } else {
      // 已有 token 时也生成一个 deviceId 供后续请求使用
      deviceId = Array.from({length: 32}, () => Math.floor(Math.random() * 16).toString(16)).join('')
      logStep('找到 access_token, uid=' + uid + ', 生成 deviceId=' + deviceId)
    }

    if (!accessToken) {
      logResult({ success: false, error: '无法获取 access_token', uid, lsKeys })
      return
    }

    // 3. 用 fetch 调用云函数 API
    const payload = {
      action: 'chat',
      modelId: 'deepseek-v4-pro',
      messages: [{ role: 'user', content: 'ping' }],
      _clientUid: uid || ('verify_online_' + Date.now()),
    }
    logStep('调用 aiProxy (POST https://metago-d6gfw1e4rf2a5bcad.api.tcloudbasegateway.com/v1/functions/aiProxy)')
    logStep('payload._clientUid=' + payload._clientUid)

    const apiRes = await fetch('https://metago-d6gfw1e4rf2a5bcad.api.tcloudbasegateway.com/v1/functions/aiProxy', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': 'Bearer ' + accessToken,
        'X-SDK-Version': '@cloudbase/js-sdk/3.6.1',
        'X-Request-Id': 'verify-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        'x-device-id': deviceId,
        'Accept-Language': 'zh-CN',
      },
      body: JSON.stringify(payload),
    })
    const apiText = await apiRes.text()
    logStep('aiProxy 响应 status=' + apiRes.status + ', ok=' + apiRes.ok)
    logStep('aiProxy 响应体(前500): ' + apiText.slice(0, 500))

    let apiData = {}
    try { apiData = JSON.parse(apiText) } catch (e) { logStep('aiProxy 响应 JSON 解析失败: ' + e.message) }

    const result = {
      success: apiData.code === 0 && Boolean(apiData.data?.content),
      httpStatus: apiRes.status,
      code: apiData.code,
      contentPreview: apiData.data?.content ? apiData.data.content.slice(0, 300) : null,
      message: apiData.message,
      uid: payload._clientUid,
      dataKeys: apiData.data ? Object.keys(apiData.data) : [],
      timestamp: new Date().toISOString(),
    }
    logResult(result)
  } catch (e) {
    logResult({ success: false, error: e.message, stack: e.stack && e.stack.split('\\n').slice(0, 3).join(' | ') })
  }
})()
`

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.webContents.on('console-message', (_event, _level, message, _line, _sourceId) => {
    if (message.startsWith('[VERIFY_STEP]') || message.startsWith('[VERIFY_LS]')) {
      console.log('[renderer] ' + message)
    } else if (message.startsWith('[VERIFY_RESULT]')) {
      if (gotResult) return
      gotResult = true
      const json = message.slice('[VERIFY_RESULT]'.length)
      console.log('\n========== 在线验证结果 ==========')
      try {
        const parsed = JSON.parse(json)
        console.log(JSON.stringify(parsed, null, 2))
        console.log('\n结论: ' + (parsed.success ? '通过 (AI 对话端到端验证成功)' : '失败'))
      } catch (e) {
        console.log(json)
      }
      console.log('==================================\n')
      clearTimeout(verifyTimeout)
      setTimeout(() => app.quit(), 500)
    } else if (message.includes('cloudFunctions') || message.includes('aiProxy') || message.includes('error')) {
      console.log('[renderer] ' + message)
    }
  })

  mainWindow.webContents.on('did-finish-load', async () => {
    console.log('[electron] 页面加载完成: ' + VERIFY_URL)
    console.log('[electron] 等待 2 秒后注入验证代码...')
    await new Promise(r => setTimeout(r, 2000))
    console.log('[electron] 注入验证代码')
    try {
      await mainWindow.webContents.executeJavaScript(INJECT_VERIFY_CODE)
    } catch (e) {
      if (!gotResult) {
        gotResult = true
        console.log('[VERIFY_RESULT]{"success":false,"error":"executeJavaScript 失败: ' + e.message + '"}')
        app.quit()
      }
    }
  })

  mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
    console.error('[electron] 加载失败: code=' + errorCode + ', desc=' + errorDescription + ', url=' + validatedURL)
    if (!gotResult) {
      gotResult = true
      console.log('[VERIFY_RESULT]{"success":false,"error":"页面加载失败: ' + errorDescription + '"}')
      app.quit()
    }
  })

  console.log('[electron] 加载 URL: ' + VERIFY_URL)
  mainWindow.loadURL(VERIFY_URL)

  verifyTimeout = setTimeout(() => {
    if (!gotResult) {
      gotResult = true
      console.log('\n[VERIFY_RESULT]{"success":false,"error":"验证超时(' + VERIFY_TIMEOUT_MS + 'ms)"}')
      console.log('[electron] 超时退出')
      app.quit()
    }
  }, VERIFY_TIMEOUT_MS)
})

app.on('window-all-closed', () => {
  app.quit()
})

process.on('exit', () => {
  clearTimeout(verifyTimeout)
})
