/**
 * Web 端文件系统实现（File System Access API）
 *
 * 支持：Chrome/Edge 121+
 * - showDirectoryPicker() 选择文件夹
 * - FileSystemDirectoryHandle / FileSystemFileHandle 操作文件
 * - handle 可序列化存储到 IndexedDB（恢复上次工作区）
 *
 * 限制：
 * - Safari/Firefox 不支持
 * - 需要用户授权（每次刷新需重新授权，除非持久化 handle）
 */

import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import type {
  FSProvider, WorkspaceMeta, DirEntry, FileTreeNode,
  SearchOptions, FileSearchResult,
} from './fsInterface'
import { inferLanguage, IGNORE_PATTERNS } from './fsInterface'

const WORKSPACE_HANDLE_KEY = 'metago_workspace_handle'
const RECENT_WORKSPACES_KEY = 'metago_recent_workspaces_v1'

export class WebFSProvider implements FSProvider {
  private rootHandle: FileSystemDirectoryHandle | null = null
  private currentMeta: WorkspaceMeta | null = null

  // ============ 工作区 ============

  async openWorkspace(): Promise<WorkspaceMeta | null> {
    try {
      const handle = await (window as any).showDirectoryPicker()
      this.rootHandle = handle

      // 持久化 handle 到 IndexedDB（下次可恢复）
      await idbSet(WORKSPACE_HANDLE_KEY, handle)

      // 检测项目类型
      const meta = await this.detectProjectMeta(handle)
      this.currentMeta = meta
      this.addRecentWorkspace(meta)

      return meta
    } catch (e: any) {
      // 用户取消选择
      if (e?.name === 'AbortError') return null
      throw e
    }
  }

  async restoreWorkspace(): Promise<WorkspaceMeta | null> {
    try {
      const handle = await idbGet(WORKSPACE_HANDLE_KEY) as FileSystemDirectoryHandle | undefined
      if (!handle) return null

      // 验证 handle 是否仍然有效（需要用户授权）
      await (handle as any).requestPermission({ mode: 'readwrite' })
      this.rootHandle = handle

      const meta = await this.detectProjectMeta(handle)
      this.currentMeta = meta
      return meta
    } catch {
      // handle 失效或用户拒绝授权
      await idbDel(WORKSPACE_HANDLE_KEY)
      return null
    }
  }

  getRecentWorkspaces(): WorkspaceMeta[] {
    try {
      const raw = localStorage.getItem(RECENT_WORKSPACES_KEY)
      if (!raw) return []
      const list = JSON.parse(raw) as WorkspaceMeta[]
      return list.sort((a, b) => b.lastOpened - a.lastOpened).slice(0, 10)
    } catch {
      return []
    }
  }

  addRecentWorkspace(meta: WorkspaceMeta): void {
    const list = this.getRecentWorkspaces().filter(w => w.path !== meta.path)
    list.unshift(meta)
    try {
      localStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(list.slice(0, 10)))
    } catch { /* 忽略 */ }
  }

  isReady(): boolean {
    return this.rootHandle !== null
  }

  getCurrentWorkspace(): WorkspaceMeta | null {
    return this.currentMeta
  }

  // ============ 文件读 ============

  async readFile(path: string): Promise<string> {
    const fileHandle = await this.getFileHandle(path)
    const file = await fileHandle.getFile()
    return file.text()
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.getFileHandle(path)
      return true
    } catch {
      return false
    }
  }

  // ============ 文件写 ============

  async writeFile(path: string, content: string): Promise<void> {
    const fileHandle = await this.getFileHandle(path, true)
    const writable = await fileHandle.createWritable()
    await writable.write(content)
    await writable.close()
  }

  async createFile(path: string, content = ''): Promise<void> {
    await this.writeFile(path, content)
  }

  async deleteFile(path: string): Promise<void> {
    const { dirHandle, fileName } = await this.getParentDir(path)
    await dirHandle.removeEntry(fileName)
  }

  async renameFile(oldPath: string, newName: string): Promise<void> {
    // File System Access API 不支持直接重命名
    // 策略：读取内容 → 写入新文件 → 删除旧文件
    const content = await this.readFile(oldPath)
    const dirPath = oldPath.substring(0, oldPath.lastIndexOf('/'))
    const newPath = dirPath ? `${dirPath}/${newName}` : newName
    await this.writeFile(newPath, content)
    await this.deleteFile(oldPath)
  }

  // ============ 目录 ============

  async readDir(path: string): Promise<DirEntry[]> {
    const dirHandle = path === '' || path === '.'
      ? this.rootHandle!
      : await this.getDirHandle(path)

    const entries: DirEntry[] = []
    for await (const [name, handle] of (dirHandle as any).entries()) {
      if (IGNORE_PATTERNS.has(name)) continue
      entries.push({
        name,
        type: handle.kind === 'directory' ? 'folder' : 'file',
      })
    }
    // 文件夹优先，然后按名称排序
    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return entries
  }

  async readTree(path: string, maxDepth = 1): Promise<FileTreeNode[]> {
    return this.buildTree(path, maxDepth, 0)
  }

  async createDir(path: string): Promise<void> {
    await this.getDirHandle(path, true)
  }

  // ============ 搜索 ============

  async search(query: string, options: SearchOptions): Promise<FileSearchResult[]> {
    if (!query) return []
    const results: FileSearchResult[] = []
    const maxResults = options.maxResults ?? 100

    // 遍历工作区所有文件
    await this.searchInDir('', query, options, results, maxResults)

    return results.slice(0, maxResults)
  }

  // ============ 内部辅助 ============

  /** 检测项目元数据 */
  private async detectProjectMeta(handle: FileSystemDirectoryHandle): Promise<WorkspaceMeta> {
    const meta: WorkspaceMeta = {
      name: handle.name,
      path: handle.name, // Web 端无绝对路径
      lastOpened: Date.now(),
    }

    try {
      // 检测 package.json
      const pkgHandle = await handle.getFileHandle('package.json').catch(() => null)
      if (pkgHandle) {
        const file = await pkgHandle.getFile()
        const pkg = JSON.parse(await file.text())
        const deps = { ...pkg.dependencies, ...pkg.devDependencies }
        if (deps['vite']) meta.projectType = `Vite + ${deps['react'] ? 'React' : deps['vue'] ? 'Vue' : 'JS'}`
        else if (deps['next']) meta.projectType = 'Next.js'
        else if (deps['express']) meta.projectType = 'Express'
        else meta.projectType = 'Node.js'

        if (deps['pnpm']) meta.packageManager = 'pnpm'
        else meta.packageManager = 'npm'
      }
    } catch { /* 忽略 */ }

    try {
      // 检测 Git
      await handle.getDirectoryHandle('.git')
      meta.hasGit = true
    } catch {
      meta.hasGit = false
    }

    return meta
  }

  /** 根据相对路径获取文件句柄 */
  private async getFileHandle(path: string, create = false): Promise<FileSystemFileHandle> {
    if (!this.rootHandle) throw new Error('工作区未打开')
    const parts = path.split('/').filter(Boolean)
    let dir: FileSystemDirectoryHandle = this.rootHandle

    // 逐层进入目录
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i])
    }

    const fileName = parts[parts.length - 1]
    return dir.getFileHandle(fileName, { create })
  }

  /** 根据相对路径获取目录句柄 */
  private async getDirHandle(path: string, create = false): Promise<FileSystemDirectoryHandle> {
    if (!this.rootHandle) throw new Error('工作区未打开')
    if (!path || path === '.') return this.rootHandle

    const parts = path.split('/').filter(Boolean)
    let dir: FileSystemDirectoryHandle = this.rootHandle

    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create })
    }

    return dir
  }

  /** 获取父目录句柄 + 文件名 */
  private async getParentDir(path: string): Promise<{
    dirHandle: FileSystemDirectoryHandle
    fileName: string
  }> {
    const parts = path.split('/').filter(Boolean)
    const fileName = parts[parts.length - 1]
    const dirPath = parts.slice(0, -1).join('/')
    const dirHandle = await this.getDirHandle(dirPath)
    return { dirHandle, fileName }
  }

  /** 递归构建文件树 */
  private async buildTree(path: string, maxDepth: number, currentDepth: number): Promise<FileTreeNode[]> {
    if (currentDepth >= maxDepth) return []

    const entries = await this.readDir(path)
    const nodes: FileTreeNode[] = []

    for (const entry of entries) {
      const fullPath = path ? `${path}/${entry.name}` : entry.name
      const node: FileTreeNode = {
        path: fullPath,
        name: entry.name,
        type: entry.type,
      }

      if (entry.type === 'file') {
        node.language = inferLanguage(entry.name)
      } else {
        node.loaded = false
        // 懒加载：只有 maxDepth > 1 时才递归
        if (maxDepth > currentDepth + 1) {
          node.children = await this.buildTree(fullPath, maxDepth, currentDepth + 1)
          node.loaded = true
        }
      }

      nodes.push(node)
    }

    return nodes
  }

  /** 递归搜索目录 */
  private async searchInDir(
    dirPath: string,
    query: string,
    options: SearchOptions,
    results: FileSearchResult[],
    maxResults: number,
  ): Promise<void> {
    if (results.length >= maxResults) return

    let entries: DirEntry[]
    try {
      entries = await this.readDir(dirPath)
    } catch { return }

    const regex = options.regex
      ? new RegExp(query, options.caseSensitive ? 'g' : 'gi')
      : null
    const searchText = options.caseSensitive ? query : query.toLowerCase()

    // 文件名过滤
    const fileFilter = options.filePattern
      ? new RegExp(options.filePattern.replace(/\./g, '\\.').replace(/\*/g, '.*'))
      : null

    for (const entry of entries) {
      if (results.length >= maxResults) return

      const fullPath = dirPath ? `${dirPath}/${entry.name}` : entry.name

      if (entry.type === 'folder') {
        await this.searchInDir(fullPath, query, options, results, maxResults)
      } else {
        // 文件名过滤
        if (fileFilter && !fileFilter.test(entry.name)) continue

        // 读取文件内容搜索
        try {
          const content = await this.readFile(fullPath)
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (results.length >= maxResults) return

            const line = lines[i]
            let match: RegExpMatchArray | null = null

            if (regex) {
              match = line.match(regex)
            } else {
              const lineLower = options.caseSensitive ? line : line.toLowerCase()
              const idx = lineLower.indexOf(searchText)
              if (idx >= 0) {
                match = [searchText] as RegExpMatchArray
                ;(match as any).index = idx
              }
            }

            if (match && match.index !== undefined) {
              results.push({
                filePath: fullPath,
                fileName: entry.name,
                line: i + 1,
                column: match.index + 1,
                lineText: line.trim().slice(0, 200),
                matchText: match[0],
              })
            }
          }
        } catch { /* 二进制文件等，跳过 */ }
      }
    }
  }
}
