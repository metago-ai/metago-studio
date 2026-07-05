/**
 * 终端 IPC handlers（Electron 主进程）
 *
 * 使用 node-pty 创建真实的伪终端进程。
 */

import { ipcMain } from 'electron'
import * as os from 'os'
import { getCurrentWorkspace } from './fs'

// node-pty 延迟加载（原生模块，打包后需要从 asar.unpacked 加载）
let pty: typeof import('node-pty') | null = null
async function ensurePty() {
  if (!pty) {
    pty = await import('node-pty')
  }
  return pty
}

const shells = new Map<string, any>()

export function registerTerminalHandlers(): void {
  // 创建终端会话
  ipcMain.handle('terminal:create', async (event, cwd: string) => {
    const ptyModule = await ensurePty()
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash'
    const workDir = cwd || getCurrentWorkspace() || os.homedir()

    const ptyProcess = ptyModule.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: workDir,
      env: { ...process.env } as Record<string, string>,
    })

    const sessionId = `term-${ptyProcess.pid}`
    shells.set(sessionId, ptyProcess)

    const webContents = event.sender

    // 输出转发到渲染进程
    ptyProcess.onData((data) => {
      if (!webContents.isDestroyed()) {
        webContents.send('terminal:output', sessionId, data)
      }
    })

    return { sessionId, pid: ptyProcess.pid }
  })

  // 发送输入
  ipcMain.on('terminal:input', (_event, sessionId: string, data: string) => {
    const shell = shells.get(sessionId)
    if (shell) shell.write(data)
  })

  // 调整大小
  ipcMain.on('terminal:resize', (_event, sessionId: string, cols: number, rows: number) => {
    const shell = shells.get(sessionId)
    if (shell) {
      try { shell.resize(cols, rows) } catch { /* 忽略 */ }
    }
  })

  // 关闭终端
  ipcMain.on('terminal:close', (_event, sessionId: string) => {
    const shell = shells.get(sessionId)
    if (shell) {
      shell.kill()
      shells.delete(sessionId)
    }
  })
}

/** 清理所有终端（应用退出时） */
export function cleanupTerminals(): void {
  for (const [, shell] of shells) {
    try { shell.kill() } catch { /* 忽略 */ }
  }
  shells.clear()
}
