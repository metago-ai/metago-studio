/**
 * Electron preload 脚本
 *
 * 通过 contextBridge 暴露安全的 IPC 接口给渲染进程。
 * 渲染进程通过 window.electronAPI 访问。
 */

import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // === 平台标识 ===
  platform: process.platform,
  isElectron: true,

  // === 文件系统 ===
  fs: {
    openFolderDialog: () => ipcRenderer.invoke('fs:openFolderDialog'),
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
    createFile: (filePath: string, content?: string) => ipcRenderer.invoke('fs:createFile', filePath, content),
    deleteFile: (filePath: string) => ipcRenderer.invoke('fs:deleteFile', filePath),
    renameFile: (oldPath: string, newName: string) => ipcRenderer.invoke('fs:renameFile', oldPath, newName),
    exists: (filePath: string) => ipcRenderer.invoke('fs:exists', filePath),
    readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
    createDir: (dirPath: string) => ipcRenderer.invoke('fs:createDir', dirPath),
    search: (query: string, options: any) => ipcRenderer.invoke('fs:search', query, options),
    // 独立检查任意绝对路径是否存在（用于工作区恢复）
    pathExists: (absPath: string) => ipcRenderer.invoke('fs:pathExists', absPath),
  },

  // === 终端（node-pty） ===
  terminal: {
    create: (cwd: string) => ipcRenderer.invoke('terminal:create', cwd),
    sendInput: (sessionId: string, data: string) => ipcRenderer.send('terminal:input', sessionId, data),
    resize: (sessionId: string, cols: number, rows: number) => ipcRenderer.send('terminal:resize', sessionId, cols, rows),
    close: (sessionId: string) => ipcRenderer.send('terminal:close', sessionId),
    onOutput: (callback: (sessionId: string, data: string) => void) => {
      const handler = (_event: any, sessionId: string, data: string) => callback(sessionId, data)
      ipcRenderer.on('terminal:output', handler)
      return () => ipcRenderer.removeListener('terminal:output', handler)
    },
  },

  // === Git ===
  git: {
    status: (rootPath: string) => ipcRenderer.invoke('git:status', rootPath),
    stage: (rootPath: string, filePath: string) => ipcRenderer.invoke('git:stage', rootPath, filePath),
    unstage: (rootPath: string, filePath: string) => ipcRenderer.invoke('git:unstage', rootPath, filePath),
    commit: (rootPath: string, message: string) => ipcRenderer.invoke('git:commit', rootPath, message),
    log: (rootPath: string, depth: number) => ipcRenderer.invoke('git:log', rootPath, depth),
    diff: (rootPath: string, filePath: string) => ipcRenderer.invoke('git:diff', rootPath, filePath),
  },

  // === 系统 ===
  system: {
    openExternal: (url: string) => ipcRenderer.invoke('system:openExternal', url),
    getAppVersion: () => ipcRenderer.invoke('system:getAppVersion'),
  },

  // === 自动更新 ===
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    onStatus: (callback: (status: any) => void) => {
      ipcRenderer.on('updater:status', (_e, data) => callback(data))
    },
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)

// 类型声明（供渲染进程使用）
export type ElectronAPI = typeof api
