/**
 * 自动更新模块
 *
 * 使用 electron-updater 实现版本检查 + 增量更新
 * 更新源：GitHub Releases 或自建静态服务器
 */

import { autoUpdater } from 'electron-updater'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import log from 'electron-log'

// 配置日志
log.transports.file.level = 'info'
autoUpdater.logger = log
autoUpdater.autoDownload = false  // 手动触发下载
autoUpdater.autoInstallOnAppQuit = false  // 手动触发安装

let mainWindow: BrowserWindow | null = null

export function initAutoUpdater(window: BrowserWindow): void {
  mainWindow = window

  // 检查更新
  autoUpdater.on('checking-for-update', () => {
    log.info('[updater] 正在检查更新...')
    sendStatus('checking')
  })

  // 有新版本可用
  autoUpdater.on('update-available', (info) => {
    log.info('[updater] 发现新版本:', info.version)
    sendStatus('available', { version: info.version, releaseDate: info.releaseDate })

    // 询问用户是否下载
    dialog.showMessageBox(window, {
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 ${info.version}`,
      detail: '是否立即下载更新？',
      buttons: ['立即下载', '稍后提醒'],
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.downloadUpdate()
      }
    })
  })

  // 当前已是最新版本
  autoUpdater.on('update-not-available', (info) => {
    log.info('[updater] 当前已是最新版本:', info.version)
    sendStatus('not-available')
  })

  // 下载进度
  autoUpdater.on('download-progress', (progress) => {
    log.info(`[updater] 下载进度: ${progress.percent.toFixed(1)}%`)
    sendStatus('downloading', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    })
    // 任务栏进度条（Windows/macOS 任务栏显示下载进度）
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(progress.percent / 100)
    }
  })

  // 下载完成
  autoUpdater.on('update-downloaded', (info) => {
    log.info('[updater] 更新下载完成:', info.version)
    sendStatus('downloaded', { version: info.version })
    // 重置任务栏进度条
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(-1)
    }

    // 询问用户是否立即安装
    dialog.showMessageBox(window, {
      type: 'info',
      title: '更新就绪',
      message: '更新已下载完成',
      detail: '是否立即退出并安装？未保存的工作请先保存。',
      buttons: ['立即安装', '稍后'],
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        setImmediate(() => autoUpdater.quitAndInstall())
      }
    })
  })

  // 错误（弹窗通知用户，避免"点击更新后无反应"）
  autoUpdater.on('error', (err) => {
    log.error('[updater] 更新错误:', err)
    sendStatus('error', { message: err.message })
    // 重置任务栏进度条
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(-1)
    }
    // 弹窗通知用户（关键修复：之前只记日志，用户看不到错误）
    dialog.showErrorBox(
      '更新失败',
      `更新过程中发生错误：\n\n${err.message}\n\n请检查网络连接后重试，或访问 https://metago.life/download 手动下载。`
    )
  })

  // IPC handlers
  ipcMain.handle('updater:check', async () => {
    try {
      await autoUpdater.checkForUpdates()
      return { code: 0 }
    } catch (e) {
      return { code: 1, message: (e as Error).message }
    }
  })

  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { code: 0 }
    } catch (e) {
      return { code: 1, message: (e as Error).message }
    }
  })

  ipcMain.handle('updater:install', async () => {
    autoUpdater.quitAndInstall()
    return { code: 0 }
  })

  // 启动后 5 秒自动检查（静默，不打扰）
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 5000)
}

function sendStatus(status: string, data?: Record<string, unknown>): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status', { status, ...data })
  }
}
