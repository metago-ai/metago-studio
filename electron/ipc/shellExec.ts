/**
 * Shell 命令执行 IPC handlers（Electron 主进程）
 *
 * V3 提供两种模式：
 * 1. shell:exec - 一次性执行，等结束后返回完整 stdout/stderr/exitCode（AI 主用）
 * 2. shell:exec:stream - 流式执行，实时推送 stdout/stderr chunk 到渲染进程（长命令可视化）
 *
 * AI Agent 通过 run_command 工具调用 shell:exec 获取结构化结果。
 * 流式模式用于 UI 实时展示命令输出（对标 Trae 终端集成）。
 */

import { ipcMain } from 'electron'
import { exec, spawn } from 'child_process'

export interface ShellExecResult {
  stdout: string
  stderr: string
  exitCode: number | null
  command: string
  cwd: string
  duration: number
}

export function registerShellExecHandlers(): void {
  // 一次性执行（AI 主用）
  ipcMain.handle('shell:exec', async (_event, command: string, cwd?: string): Promise<ShellExecResult> => {
    const start = Date.now()
    const workCwd = cwd || process.cwd()

    return new Promise((resolve) => {
      // 超时 120s（覆盖 npm install / build / deploy 等长命令）
      const child = exec(command, {
        cwd: workCwd,
        maxBuffer: 10 * 1024 * 1024, // 10MB stdout/stderr
        timeout: 120_000,
        env: { ...process.env },
        shell: process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash',
      })

      let stdout = ''
      let stderr = ''

      child.stdout?.on('data', (data) => { stdout += data.toString() })
      child.stderr?.on('data', (data) => { stderr += data.toString() })

      child.on('close', (exitCode) => {
        resolve({
          stdout: stdout.slice(0, 500_000), // 限制 500KB 防止 token 爆炸
          stderr: stderr.slice(0, 200_000),
          exitCode,
          command,
          cwd: workCwd,
          duration: Date.now() - start,
        })
      })

      child.on('error', (err) => {
        resolve({
          stdout,
          stderr: stderr + `\n[执行错误] ${err.message}`,
          exitCode: -1,
          command,
          cwd: workCwd,
          duration: Date.now() - start,
        })
      })
    })
  })

  // V3: 流式执行（UI 实时展示）
  // 返回一个 sessionId，渲染进程通过 onShellStream(sessionId, callback) 订阅输出
  // 完成时返回最终结果
  ipcMain.handle('shell:exec:stream', async (event, command: string, cwd?: string): Promise<ShellExecResult> => {
    const start = Date.now()
    const workCwd = cwd || process.cwd()
    const webContents = event.sender

    return new Promise((resolve) => {
      const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash'
      const shellArgs = process.platform === 'win32'
        ? ['-NoProfile', '-Command', command]
        : ['-c', command]

      const child = spawn(shell, shellArgs, {
        cwd: workCwd,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''

      child.stdout?.on('data', (data) => {
        const text = data.toString()
        stdout += text
        // 实时推送到渲染进程
        webContents.send('shell:stream:data', { stream: 'stdout', data: text })
      })

      child.stderr?.on('data', (data) => {
        const text = data.toString()
        stderr += text
        webContents.send('shell:stream:data', { stream: 'stderr', data: text })
      })

      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM')
        webContents.send('shell:stream:data', { stream: 'stderr', data: '\n[超时 120s，已终止]' })
      }, 120_000)

      child.on('close', (exitCode) => {
        clearTimeout(timeoutId)
        const result: ShellExecResult = {
          stdout: stdout.slice(0, 500_000),
          stderr: stderr.slice(0, 200_000),
          exitCode,
          command,
          cwd: workCwd,
          duration: Date.now() - start,
        }
        webContents.send('shell:stream:done', result)
        resolve(result)
      })

      child.on('error', (err) => {
        clearTimeout(timeoutId)
        const result: ShellExecResult = {
          stdout,
          stderr: stderr + `\n[执行错误] ${err.message}`,
          exitCode: -1,
          command,
          cwd: workCwd,
          duration: Date.now() - start,
        }
        webContents.send('shell:stream:done', result)
        resolve(result)
      })
    })
  })
}
