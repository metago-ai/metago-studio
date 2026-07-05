/**
 * 文件系统抽象层 —— 统一接口定义
 *
 * Web 端通过 File System Access API 实现（Chrome/Edge 121+）
 * 桌面端（Electron）通过 IPC + Node fs 实现
 *
 * 运行时自动选择实现：检测 window.electronAPI 是否存在
 */

// ============ 类型定义 ============

/** 工作区元数据 */
export interface WorkspaceMeta {
  /** 工作区名称（通常是文件夹名） */
  name: string
  /** 工作区路径（桌面端为绝对路径，Web 端为文件夹名） */
  path: string
  /** 最后打开时间 */
  lastOpened: number
  /** 项目类型检测结果 */
  projectType?: string
  /** 是否有 Git 仓库 */
  hasGit?: boolean
  /** 包管理器 */
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'unknown'
}

/** 目录条目 */
export interface DirEntry {
  name: string
  type: 'file' | 'folder'
  size?: number
  modified?: number
}

/** 文件树节点（用于 UI 渲染） */
export interface FileTreeNode {
  path: string         // 相对路径 "src/lib/aiClient.ts"
  name: string         // 显示名
  type: 'file' | 'folder'
  language?: string    // 文件扩展名推断的语言
  children?: FileTreeNode[]
  loaded?: boolean     // 文件夹是否已加载子项（懒加载）
}

/** 搜索选项 */
export interface SearchOptions {
  /** 正则模式（为空则按纯文本） */
  regex?: boolean
  /** 区分大小写 */
  caseSensitive?: boolean
  /** 文件名 glob 过滤（如 "*.ts"） */
  filePattern?: string
  /** 最多返回结果数 */
  maxResults?: number
}

/** 搜索结果项 */
export interface FileSearchResult {
  filePath: string
  fileName: string
  line: number
  column: number
  /** 匹配行的文本 */
  lineText: string
  /** 匹配的子串（用于高亮） */
  matchText: string
}

// ============ 统一接口 ============

export interface FSProvider {
  // --- 工作区 ---
  /** 打开工作区（弹出文件夹选择对话框） */
  openWorkspace(): Promise<WorkspaceMeta | null>
  /** 恢复上次的工作区（Web 端从 IndexedDB 恢复 handle） */
  restoreWorkspace(): Promise<WorkspaceMeta | null>
  /** 获取最近工作区列表 */
  getRecentWorkspaces(): WorkspaceMeta[]
  /** 添加到最近工作区 */
  addRecentWorkspace(meta: WorkspaceMeta): void
  /** 当前工作区是否已就绪 */
  isReady(): boolean
  /** 当前工作区元数据 */
  getCurrentWorkspace(): WorkspaceMeta | null

  // --- 文件读 ---
  readFile(path: string): Promise<string>
  /** 判断文件是否存在 */
  exists(path: string): Promise<boolean>

  // --- 文件写 ---
  writeFile(path: string, content: string): Promise<void>
  createFile(path: string, content?: string): Promise<void>
  deleteFile(path: string): Promise<void>
  renameFile(oldPath: string, newName: string): Promise<void>

  // --- 目录 ---
  readDir(path: string): Promise<DirEntry[]>
  /** 读取目录并返回文件树（懒加载：只读取一层） */
  readTree(path: string, maxDepth?: number): Promise<FileTreeNode[]>
  createDir(path: string): Promise<void>

  // --- 搜索 ---
  search(query: string, options: SearchOptions): Promise<FileSearchResult[]>
}

// ============ 运行时实现选择 ============

let _provider: FSProvider | null = null

/**
 * 获取当前文件系统提供者
 *
 * 自动检测运行环境：
 * - window.electronAPI 存在 → 桌面端实现
 * - 'showDirectoryPicker' in window → Web 端实现（Chrome/Edge）
 * - 都不满足 → 抛出错误
 */
export async function getFS(): Promise<FSProvider> {
  if (_provider) return _provider

  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    // 桌面端（Electron）—— Phase 4 实现
    const { DesktopFSProvider } = await import('./fsDesktop')
    _provider = new DesktopFSProvider()!
  } else if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
    // Web 端（File System Access API）
    const { WebFSProvider } = await import('./fsWeb')
    _provider = new WebFSProvider()!
  } else {
    throw new Error('当前浏览器不支持文件系统访问。请使用 Chrome/Edge 121+ 或下载桌面端。')
  }

  return _provider
}

/** 判断是否支持文件系统 */
export function isFSSupported(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean((window as any).electronAPI) || 'showDirectoryPicker' in window
}

/** 判断是否为桌面端 */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).electronAPI)
}

// ============ 语言推断辅助 ============

const EXT_LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  json: 'json',
  css: 'css', scss: 'scss', less: 'less',
  html: 'html', htm: 'html',
  md: 'markdown', markdown: 'markdown',
  vue: 'html', svelte: 'html',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c', cpp: 'cpp', h: 'cpp', hpp: 'cpp',
  sql: 'sql',
  yaml: 'yaml', yml: 'yaml',
  xml: 'xml',
  sh: 'shell', bash: 'shell',
  toml: 'toml',
  dockerfile: 'dockerfile',
}

export function inferLanguage(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower === 'dockerfile') return 'dockerfile'
  const ext = lower.split('.').pop() ?? ''
  return EXT_LANG_MAP[ext] ?? 'text'
}

/** 是否应该忽略的目录/文件（提升性能） */
export const IGNORE_PATTERNS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  '.cache', '.turbo', 'coverage', '.nyc_output',
  '__pycache__', '.pytest_cache', '.mypy_cache',
  '.DS_Store', 'Thumbs.db',
  '.env', '.env.local', '.env.production',
])
