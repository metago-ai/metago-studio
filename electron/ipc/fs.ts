/**
 * 文件系统 IPC handlers（Electron 主进程）
 *
 * 使用 Node.js fs 模块，提供完整的文件系统访问。
 */

import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { existsSync, statSync } from 'fs'

// === 本地常量（避免跨目录依赖前端代码） ===

const IGNORE_PATTERNS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.cache',
  '.vscode', '.idea', 'coverage', '.nuxt', 'out', '.turbo',
])

function inferLanguage(fileName: string): string | undefined {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript', mjs: 'javascript',
    css: 'css', scss: 'scss', less: 'less',
    json: 'json', md: 'markdown', html: 'html',
    py: 'python', go: 'go', rs: 'rust', java: 'java',
    c: 'c', cpp: 'cpp', cs: 'csharp', rb: 'ruby',
    php: 'php', swift: 'swift', kt: 'kotlin',
    yml: 'yaml', yaml: 'yaml', toml: 'toml',
    xml: 'xml', svg: 'xml', sh: 'shell', bat: 'bat',
  }
  return ext ? map[ext] : undefined
}

let currentWorkspace: string | null = null

export function registerFSHandlers(): void {
  // 打开文件夹选择对话框
  ipcMain.handle('fs:openFolderDialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    currentWorkspace = result.filePaths[0]
    return { path: currentWorkspace, name: path.basename(currentWorkspace) }
  })

  // 读文件
  ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    const fullPath = resolvePath(filePath)
    return fs.readFile(fullPath, 'utf-8')
  })

  // 写文件
  ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
    const fullPath = resolvePath(filePath)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    return fs.writeFile(fullPath, content, 'utf-8')
  })

  // 创建文件
  ipcMain.handle('fs:createFile', async (_event, filePath: string, content = '') => {
    const fullPath = resolvePath(filePath)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    return fs.writeFile(fullPath, content, 'utf-8')
  })

  // 删除文件
  ipcMain.handle('fs:deleteFile', async (_event, filePath: string) => {
    const fullPath = resolvePath(filePath)
    return fs.unlink(fullPath)
  })

  // 重命名
  ipcMain.handle('fs:renameFile', async (_event, oldPath: string, newName: string) => {
    const fullOldPath = resolvePath(oldPath)
    const dir = path.dirname(fullOldPath)
    const fullNewPath = path.join(dir, newName)
    return fs.rename(fullOldPath, fullNewPath)
  })

  // 判断存在
  ipcMain.handle('fs:exists', async (_event, filePath: string) => {
    const fullPath = resolvePath(filePath)
    return existsSync(fullPath)
  })

  // 列目录
  ipcMain.handle('fs:readDir', async (_event, dirPath: string) => {
    const fullPath = resolvePath(dirPath)
    const entries = await fs.readdir(fullPath, { withFileTypes: true })
    return entries
      .filter(e => !IGNORE_PATTERNS.has(e.name))
      .map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'folder' : 'file',
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  })

  // 创建目录
  ipcMain.handle('fs:createDir', async (_event, dirPath: string) => {
    const fullPath = resolvePath(dirPath)
    return fs.mkdir(fullPath, { recursive: true })
  })

  // 搜索（简化版：递归扫描文本文件）
  ipcMain.handle('fs:search', async (_event, query: string, options: any) => {
    if (!currentWorkspace) return []
    return searchInDir(currentWorkspace, '', query, options, [], 100)
  })

  // 独立检查任意绝对路径是否存在（用于工作区恢复，不依赖 currentWorkspace）
  ipcMain.handle('fs:pathExists', async (_event, absPath: string) => {
    try {
      return existsSync(absPath)
    } catch {
      return false
    }
  })
}

/** 解析相对路径为绝对路径（含路径穿越防护） */
function resolvePath(relativePath: string): string {
  if (!currentWorkspace) throw new Error('工作区未打开')
  let resolved: string
  if (path.isAbsolute(relativePath)) {
    // 绝对路径：必须仍在工作区内
    resolved = path.resolve(relativePath)
  } else {
    resolved = path.resolve(currentWorkspace, relativePath)
  }
  // 安全校验：解析后路径必须在工作区目录内（防止 ../ 路径穿越）
  const workspaceRoot = path.resolve(currentWorkspace)
  const relative = path.relative(workspaceRoot, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`路径越界：禁止访问工作区外的文件（${relativePath}）`)
  }
  return resolved
}

/** 递归搜索 */
async function searchInDir(
  root: string,
  relPath: string,
  query: string,
  options: any,
  results: any[],
  maxResults: number,
): Promise<any[]> {
  if (results.length >= maxResults) return results

  const fullPath = relPath ? path.join(root, relPath) : root
  const entries = await fs.readdir(fullPath, { withFileTypes: true })

  const regex = options?.regex
    ? new RegExp(query, options?.caseSensitive ? 'g' : 'gi')
    : null
  const searchText = options?.caseSensitive ? query : query.toLowerCase()

  for (const entry of entries) {
    if (results.length >= maxResults) return results
    if (IGNORE_PATTERNS.has(entry.name)) continue

    const entryRelPath = relPath ? path.join(relPath, entry.name) : entry.name

    if (entry.isDirectory()) {
      await searchInDir(root, entryRelPath, query, options, results, maxResults)
    } else {
      // 文件名过滤
      if (options?.filePattern) {
        const pattern = new RegExp(options.filePattern.replace(/\./g, '\\.').replace(/\*/g, '.*'))
        if (!pattern.test(entry.name)) continue
      }

      try {
        const content = await fs.readFile(path.join(fullPath, entry.name), 'utf-8')
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          if (results.length >= maxResults) return results
          const line = lines[i]
          let match: RegExpMatchArray | null = null

          if (regex) {
            match = line.match(regex)
          } else {
            const lineLower = options?.caseSensitive ? line : line.toLowerCase()
            const idx = lineLower.indexOf(searchText)
            if (idx >= 0) {
              match = [searchText] as RegExpMatchArray
              ;(match as any).index = idx
            }
          }

          if (match && match.index !== undefined) {
            results.push({
              filePath: entryRelPath,
              fileName: entry.name,
              line: i + 1,
              column: match.index + 1,
              lineText: line.trim().slice(0, 200),
              matchText: match[0],
            })
          }
        }
      } catch { /* 二进制文件，跳过 */ }
    }
  }

  return results
}

/** 获取当前工作区路径 */
export function getCurrentWorkspace(): string | null {
  return currentWorkspace
}
