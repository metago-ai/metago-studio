/**
 * Electron AI 对话端到端验证编排脚本
 *
 * 流程：
 *   1. 启动 Vite dev server（后台）
 *   2. 等待 http://localhost:5173 就绪
 *   3. 启动 Electron 加载 verify-ai.html
 *   4. 捕获 [VERIFY_RESULT] 输出
 *   5. 清理所有子进程，退出
 *
 * 用法：node scripts/run-electron-verify.cjs
 *
 * 这是 AGENTS.md 第十一章要求的"真实浏览器环境运行时验证"。
 * 相比 npm run verify（CLI 调用云函数），本脚本在 Electron Chromium 中
 * 加载真实页面 + 真实 CloudBase SDK，完整模拟用户侧调用链。
 */

const { spawn } = require('child_process')
const http = require('http')
const path = require('path')

const STUDIO_DIR = path.resolve(__dirname, '..')
const VERIFY_URL = 'http://localhost:8080/studio/verify-ai.html'
const VITE_READY_TIMEOUT_MS = 30000
const ELECTRON_VERIFY_TIMEOUT_MS = 120000

function waitForServer(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          res.resume()
          resolve()
        } else {
          res.resume()
          retryOrFail()
        }
      })
      req.on('error', retryOrFail)
      function retryOrFail() {
        if (Date.now() - start > timeoutMs) {
          reject(new Error('等待 ' + url + ' 超时(' + timeoutMs + 'ms)'))
        } else {
          setTimeout(check, 500)
        }
      }
    }
    check()
  })
}

async function main() {
  console.log('=== Electron AI 对话端到端验证 ===')
  console.log('[verify] 工作目录: ' + STUDIO_DIR)
  console.log('[verify] 验证 URL: ' + VERIFY_URL)
  console.log('')

  // 检查 8080 端口是否已被占用（可能有已运行的 dev server）
  let viteOwned = false
  let viteProc = null
  try {
    await waitForServer('http://localhost:8080/studio/', 2000)
    console.log('[verify] 检测到 8080 端口已有服务，复用现有 dev server')
  } catch (e) {
    console.log('[verify] 启动 Vite dev server (port 8080, 已在 CloudBase 安全域名白名单)...')
    viteOwned = true
    viteProc = spawn('npx', ['vite', '--port', '8080', '--strictPort'], {
      cwd: STUDIO_DIR,
      shell: true,
      stdio: 'pipe',
    })
    viteProc.stdout.on('data', (d) => {
      const s = d.toString().trim()
      if (s) console.log('[vite] ' + s)
    })
    viteProc.stderr.on('data', (d) => {
      const s = d.toString().trim()
      if (s) console.error('[vite:err] ' + s)
    })
    viteProc.on('exit', (code) => {
      if (viteOwned) console.log('[verify] Vite 进程退出, code=' + code)
    })
  }

  let exitCode = 0
  let electronProc = null

  try {
    console.log('[verify] 等待 dev server 就绪...')
    await waitForServer('http://localhost:8080/studio/', VITE_READY_TIMEOUT_MS)
    console.log('[verify] dev server 就绪')
    console.log('')

    // 启动 Electron
    console.log('[verify] 启动 Electron...')
    const electronBin = 'npx'
    const electronArgs = ['electron', path.join(STUDIO_DIR, 'scripts', 'electron-verify-main.cjs')]
    electronProc = spawn(electronBin, electronArgs, {
      cwd: STUDIO_DIR,
      shell: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        VERIFY_URL,
      },
    })

    const timeoutHandle = setTimeout(() => {
      console.error('\n[verify] Electron 验证超时(' + ELECTRON_VERIFY_TIMEOUT_MS + 'ms)，终止进程')
      if (electronProc && !electronProc.killed) {
        electronProc.kill('SIGTERM')
        setTimeout(() => {
          if (electronProc && !electronProc.killed) {
            electronProc.kill('SIGKILL')
          }
        }, 2000)
      }
      exitCode = 124
    }, ELECTRON_VERIFY_TIMEOUT_MS)

    await new Promise((resolve) => {
      electronProc.on('exit', (code) => {
        clearTimeout(timeoutHandle)
        console.log('[verify] Electron 退出, code=' + code)
        if (code !== 0) exitCode = code || 1
        resolve()
      })
    })
  } catch (e) {
    console.error('[verify] 错误: ' + e.message)
    exitCode = 1
  } finally {
    // 清理
    if (electronProc && !electronProc.killed) {
      try { electronProc.kill('SIGKILL') } catch (e) {}
    }
    if (viteOwned && viteProc && !viteProc.killed) {
      console.log('[verify] 停止 Vite dev server...')
      try { viteProc.kill('SIGTERM') } catch (e) {}
      // 给 Vite 2 秒优雅退出
      await new Promise(r => setTimeout(r, 1500))
      if (viteProc && !viteProc.killed) {
        try { viteProc.kill('SIGKILL') } catch (e) {}
      }
    }
  }

  console.log('')
  console.log('[verify] 完成, exit code=' + exitCode)
  process.exit(exitCode)
}

main().catch((e) => {
  console.error('[verify] 致命错误:', e)
  process.exit(1)
})
