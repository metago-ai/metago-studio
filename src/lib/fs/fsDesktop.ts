/**
 * 桌面端文件系统实现（Electron IPC + Node fs）
 *
 * 通过 window.electronAPI 与 Electron 主进程通信，
 * 提供完整的文件系统访问能力。
 */

import type {
  FSProvider, WorkspaceMeta, DirEntry, FileTreeNode,
  SearchOptions, FileSearchResult,
} from './fsInterface'
import { inferLanguage } from './fsInterface'

const RECENT_KEY = 'metago_recent_workspaces_desktop_v1'

export class DesktopFSProvider implements FSProvider {
  private currentMeta: WorkspaceMeta | null = null

  // ============ 工作区 ============

  async openWorkspace(): Promise<WorkspaceMeta | null> {
    const result = await (window as any).electronAPI.fs.openFolderDialog()
    if (!result) return null

    const meta: WorkspaceMeta = {
      name: result.name,
      path: result.path,
      lastOpened: Date.now(),
    }

    // 检测项目元数据
    await this.detectProjectMeta(result.path, meta)
    this.currentMeta = meta
    this.addRecentWorkspace(meta)
    return meta
  }

  async restoreWorkspace(): Promise<WorkspaceMeta | null> {
    const recent = this.getRecentWorkspaces()
    if (recent.length === 0) return null
    // 桌面端恢复：检查最近的工作区目录是否仍然存在
    const last = recent[0]
    try {
      const electronAPI = (window as any).electronAPI
      // 使用独立的 pathExists IPC（不依赖 currentWorkspace）
      const exists = await electronAPI?.fs?.pathExists?.(last.path)
      if (exists) {
        this.currentMeta = last
        return last
      }
    } catch { /* 路径无效 */ }
    return null
  }

  getRecentWorkspaces(): WorkspaceMeta[] {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      if (!raw) return []
      return JSON.parse(raw).sort((a: WorkspaceMeta, b: WorkspaceMeta) => b.lastOpened - a.lastOpened).slice(0, 10)
    } catch {
      return []
    }
  }

  addRecentWorkspace(meta: WorkspaceMeta): void {
    const list = this.getRecentWorkspaces().filter(w => w.path !== meta.path)
    list.unshift(meta)
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10)))
    } catch { /* 忽略 */ }
  }

  isReady(): boolean {
    return this.currentMeta !== null
  }

  getCurrentWorkspace(): WorkspaceMeta | null {
    return this.currentMeta
  }

  // ============ 文件读 ============

  async readFile(path: string): Promise<string> {
    return (window as any).electronAPI.fs.readFile(path)
  }

  async exists(path: string): Promise<boolean> {
    try {
      return await (window as any).electronAPI.fs.exists(path)
    } catch {
      return false
    }
  }

  // ============ 文件写 ============

  async writeFile(path: string, content: string): Promise<void> {
    return (window as any).electronAPI.fs.writeFile(path, content)
  }

  async createFile(path: string, content = ''): Promise<void> {
    return (window as any).electronAPI.fs.createFile(path, content)
  }

  async deleteFile(path: string): Promise<void> {
    return (window as any).electronAPI.fs.deleteFile(path)
  }

  async renameFile(oldPath: string, newName: string): Promise<void> {
    return (window as any).electronAPI.fs.renameFile(oldPath, newName)
  }

  // ============ 目录 ============

  async readDir(path: string): Promise<DirEntry[]> {
    return (window as any).electronAPI.fs.readDir(path)
  }

  async readTree(path: string, maxDepth = 1): Promise<FileTreeNode[]> {
    return this.buildTree(path, maxDepth, 0)
  }

  async createDir(path: string): Promise<void> {
    return (window as any).electronAPI.fs.createDir(path)
  }

  // ============ 搜索 ============

  async search(query: string, options: SearchOptions): Promise<FileSearchResult[]> {
    return (window as any).electronAPI.fs.search(query, options)
  }

  // ============ 内部 ============

  private async detectProjectMeta(_rootPath: string, meta: WorkspaceMeta): Promise<void> {
    void _rootPath
    try {
      const pkgContent = await this.readFile('package.json').catch(() => null)
      if (pkgContent) {
        const pkg = JSON.parse(pkgContent)
        const deps = { ...pkg.dependencies, ...pkg.devDependencies }
        if (deps['vite']) meta.projectType = `Vite + ${deps['react'] ? 'React' : deps['vue'] ? 'Vue' : 'JS'}`
        else if (deps['next']) meta.projectType = 'Next.js'
        else meta.projectType = 'Node.js'
        meta.packageManager = deps['pnpm'] ? 'pnpm' : 'npm'
      }
    } catch { /* 忽略 */ }

    try {
      await this.exists('.git')
      meta.hasGit = true
    } catch {
      meta.hasGit = false
    }
  }

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
        if (maxDepth > currentDepth + 1) {
          node.children = await this.buildTree(fullPath, maxDepth, currentDepth + 1)
          node.loaded = true
        }
      }

      nodes.push(node)
    }

    return nodes
  }
}
