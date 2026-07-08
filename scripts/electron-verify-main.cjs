/**
 * Electron 验证主进程入口
 *
 * 加载 verify-ai.html（通过 Vite dev server），在真实 Chromium 环境中
 * 执行 CloudBase SDK 调用 aiProxy 云函数的完整链路验证。
 *
 * 用法：
 *   VERIFY_URL=http://localhost:5173/verify-ai.html npx electron scripts/electron-verify-main.cjs
 *
 * 输出：
 *   [VERIFY_STEP] ...  验证步骤
 *   [VERIFY_RESULT]{...}  验证结果（JSON）
 */

const { app, BrowserWindow } = require('electron')

let mainWindow = null
const VERIFY_URL = process.env.VERIFY_URL || 'http://localhost:8080/studio/verify-ai.html'
const VERIFY_TIMEOUT_MS = 90000

let verifyTimeout = null
let gotResult = false

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
    if (message.startsWith('[VERIFY_STEP]')) {
      console.log('[renderer] ' + message)
    } else if (message.startsWith('[VERIFY_RESULT]')) {
      if (gotResult) return
      gotResult = true
      const json = message.slice('[VERIFY_RESULT]'.length)
      console.log('\n========== 验证结果 ==========')
      try {
        const parsed = JSON.parse(json)
        console.log(JSON.stringify(parsed, null, 2))
        console.log('\n结论: ' + (parsed.success ? '通过 (AI 对话端到端验证成功)' : '失败'))
      } catch (e) {
        console.log(json)
      }
      console.log('==============================\n')
      clearTimeout(verifyTimeout)
      setTimeout(() => app.quit(), 500)
    } else {
      console.log('[renderer] ' + message)
    }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[electron] 页面加载完成: ' + VERIFY_URL)
  })

  mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
    console.error('[electron] 加载失败: code=' + errorCode + ', desc=' + errorDescription + ', url=' + validatedURL)
    if (!gotResult) {
      gotResult = true
      console.log('[VERIFY_RESULT]{"success":false,"error":"页面加载失败: ' + errorDescription + '"}')
      app.quit()
    }
  })

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[electron] 渲染进程崩溃: ' + JSON.stringify(details))
    if (!gotResult) {
      gotResult = true
      console.log('[VERIFY_RESULT]{"success":false,"error":"渲染进程崩溃: ' + (details?.reason || 'unknown') + '"}')
      app.quit()
    }
  })

  console.log('[electron] 加载 URL: ' + VERIFY_URL)
  mainWindow.loadURL(VERIFY_URL)

  verifyTimeout = setTimeout(() => {
    if (!gotResult) {
      gotResult = true
      console.log('\n[VERIFY_RESULT]{"success":false,"error":"验证超时(' + VERIFY_TIMEOUT_MS + 'ms)，未收到结果"}')
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
