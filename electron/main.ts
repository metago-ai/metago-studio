/**
 * Electron 主进程
 *
 * MetaGO Agent 桌面端入口。
 * 加载 Vite dev server（开发）或打包后的 index.html（生产）。
 * 注册所有 IPC handlers。
 */

import { app, BrowserWindow, Menu, shell } from 'electron'
import * as path from 'path'
import { registerFSHandlers } from './ipc/fs'
import { registerTerminalHandlers } from './ipc/terminal'
import { registerGitHandlers } from './ipc/git'
import { registerShellExecHandlers } from './ipc/shellExec'
import { buildAppMenu } from './menu'
import { initAutoUpdater } from './updater'
import { cleanupTerminals } from './ipc/terminal'

// 性能优化：启用硬件加速（GPU 渲染）
// 注：只有当检测到 GPU 崩溃时才禁用（通过 env 变量 METAGO_DISABLE_GPU=1）
if (process.env.METAGO_DISABLE_GPU === '1') {
  app.disableHardwareAcceleration()
}
// 启用 V8 代码缓存，加速后续启动
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096')
// 禁用拼写检查（减少开销）
app.commandLine.appendSwitch('disable-features', 'SpellCheck')

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#0a0a0a',
    title: 'MetaGO Agent',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // file:// 协议下 ES Module 需要 webSecurity: false 才能加载
      webSecurity: false,
      allowRunningInsecureContent: true,
      // 性能优化
      backgroundThrottling: false,  // 后台标签页不节流
      spellcheck: false,            // 禁用拼写检查
      // 启用 V8 缓存
      additionalArguments: ['--enable-features=V8VmFuture'],
    },
    icon: path.join(__dirname, '../metago-logo.png'),
  })

  // 开发模式：加载 Vite dev server
  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    mainWindow.loadURL(devUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    // 生产模式：加载打包文件
    // __dirname = dist/electron/，Vite 输出在 dist/，所以是 ../index.html
    mainWindow.loadFile(path.join(__dirname, '../index.html'))
  }

  // 加载错误日志（生产诊断用）
  mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
    console.error('[MetaGO] 加载失败:', errorCode, errorDescription, validatedURL)
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // 外部链接用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 单实例锁
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    Menu.setApplicationMenu(buildAppMenu())
    createWindow()

    // 初始化自动更新（创建窗口后）
    if (mainWindow) {
      initAutoUpdater(mainWindow)
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 注册 IPC handlers（在 app ready 后）
app.whenReady().then(() => {
  registerFSHandlers()
    registerTerminalHandlers()
    registerGitHandlers()
    registerShellExecHandlers()
})

// 退出前清理所有终端子进程，避免进程泄漏
app.on('before-quit', () => {
  cleanupTerminals()
})
