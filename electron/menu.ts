/**
 * Electron 应用菜单
 */

import { Menu, app, shell, BrowserWindow, dialog } from 'electron'

export function buildAppMenu(): Menu {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    {
      label: '文件',
      submenu: [
        {
          label: '打开工作区...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:open-workspace')
          },
        },
        { type: 'separator' },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:save')
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        {
          label: '命令面板',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:command-palette')
          },
        },
        { type: 'separator' },
        {
          label: '切换终端',
          accelerator: 'CmdOrCtrl+`',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:toggle-terminal')
          },
        },
        {
          label: '切换源代码管理',
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:toggle-git')
          },
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' as const }, { role: 'front' as const }] : [{ role: 'close' as const }]),
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: 'MetaGO 官网',
          click: () => shell.openExternal('https://metago.life'),
        },
        {
          label: '文档',
          click: () => shell.openExternal('https://metago.life/docs'),
        },
        { type: 'separator' },
        {
          label: '关于 MetaGO Agent',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: '关于',
              message: 'MetaGO Agent',
              detail: `版本：${app.getVersion()}\n元构超级智能生命体\n\nA1 溯源 | A2 闭环 | A3 元进化\n法律优先于效率`,
            })
          },
        },
      ],
    },
  ]

  return Menu.buildFromTemplate(template)
}
