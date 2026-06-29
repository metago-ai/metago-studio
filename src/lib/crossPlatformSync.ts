/**
 * 跨平台同步（Pro 版 FR-4）
 *
 * 7 大平台 + MCP 的进化档案、技能库、配置统一同步。
 *
 * 同步内容（PRD FR-4）：
 *   - 进化档案（实时，服务器优先）
 *   - 私有技能库（实时，合并无冲突）
 *   - 配置（手动，用户选择）
 *   - 决策锁规则（每日，服务器优先）
 *
 * 本地实现：模拟多平台数据合并，记录同步日志
 * 真实环境：OAuth 2.0 + 云端 CRDT 合并
 */

export type PlatformId = 'trae' | 'claude-code' | 'codex' | 'cursor' | 'codebuddy' | 'qoder' | 'zcode' | 'mcp'

export interface PlatformInfo {
  id: PlatformId
  name: string
  icon: string
  color: string
  lastSyncAt: string | null
  recordCount: number
  status: 'connected' | 'disconnected' | 'syncing' | 'error'
}

export interface SyncLog {
  id: string
  timestamp: string
  platform: PlatformId
  operation: 'pull' | 'push' | 'merge' | 'conflict'
  recordCount: number
  status: 'success' | 'failed' | 'conflict'
  message: string
}

const SYNC_LOG_KEY = 'metago_sync_logs_v1'
const PLATFORMS_KEY = 'metago_platforms_v1'

/** 默认平台列表 */
const DEFAULT_PLATFORMS: PlatformInfo[] = [
  { id: 'trae', name: 'Trae', icon: '🚀', color: 'accent-blue', lastSyncAt: null, recordCount: 0, status: 'connected' },
  { id: 'claude-code', name: 'Claude Code', icon: '🤖', color: 'accent-amber', lastSyncAt: null, recordCount: 0, status: 'disconnected' },
  { id: 'codex', name: 'Codex', icon: '⚡', color: 'accent-emerald', lastSyncAt: null, recordCount: 0, status: 'disconnected' },
  { id: 'cursor', name: 'Cursor', icon: '🖱️', color: 'accent-teal', lastSyncAt: null, recordCount: 0, status: 'disconnected' },
  { id: 'codebuddy', name: 'CodeBuddy', icon: '👥', color: 'accent-rose', lastSyncAt: null, recordCount: 0, status: 'disconnected' },
  { id: 'qoder', name: 'Qoder', icon: '💎', color: 'accent-blue', lastSyncAt: null, recordCount: 0, status: 'disconnected' },
  { id: 'zcode', name: 'ZCode', icon: '🎯', color: 'accent-emerald', lastSyncAt: null, recordCount: 0, status: 'disconnected' },
  { id: 'mcp', name: 'MCP Server', icon: '🔌', color: 'accent-amber', lastSyncAt: null, recordCount: 0, status: 'connected' },
]

// ============ 持久化 ============

export function loadPlatforms(): PlatformInfo[] {
  try {
    const raw = localStorage.getItem(PLATFORMS_KEY)
    if (!raw) return DEFAULT_PLATFORMS
    return JSON.parse(raw) as PlatformInfo[]
  } catch {
    return DEFAULT_PLATFORMS
  }
}

export function savePlatforms(platforms: PlatformInfo[]): void {
  try {
    localStorage.setItem(PLATFORMS_KEY, JSON.stringify(platforms))
  } catch (e) {
    console.error('[sync] 保存平台状态失败', e)
  }
}

export function loadSyncLogs(): SyncLog[] {
  try {
    const raw = localStorage.getItem(SYNC_LOG_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SyncLog[]
  } catch {
    return []
  }
}

function saveSyncLogs(logs: SyncLog[]): void {
  try {
    localStorage.setItem(SYNC_LOG_KEY, JSON.stringify(logs.slice(0, 100))) // 保留最近 100 条
  } catch (e) {
    console.error('[sync] 保存日志失败', e)
  }
}

// ============ 操作 ============

/** 连接平台 */
export function connectPlatform(id: PlatformId): PlatformInfo[] {
  const platforms = loadPlatforms()
  const p = platforms.find(p => p.id === id)
  if (p) {
    p.status = 'connected'
    savePlatforms(platforms)
  }
  return platforms
}

/** 断开平台 */
export function disconnectPlatform(id: PlatformId): PlatformInfo[] {
  const platforms = loadPlatforms()
  const p = platforms.find(p => p.id === id)
  if (p) {
    p.status = 'disconnected'
    savePlatforms(platforms)
  }
  return platforms
}

/**
 * 模拟同步操作（本地实现）
 * 真实环境：OAuth 2.0 + 云端 API
 */
export async function syncWithPlatform(
  id: PlatformId,
  localRecordCount: number
): Promise<{ success: boolean; logs: SyncLog[]; platforms: PlatformInfo[] }> {
  const platforms = loadPlatforms()
  const p = platforms.find(p => p.id === id)
  if (!p) return { success: false, logs: loadSyncLogs(), platforms }
  if (p.status !== 'connected') {
    return { success: false, logs: loadSyncLogs(), platforms }
  }

  p.status = 'syncing'
  savePlatforms(platforms)

  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 600))

  const logs = loadSyncLogs()
  const now = new Date().toISOString()

  // 模拟拉取
  const pulledCount = Math.floor(Math.random() * 5) + 1
  logs.unshift({
    id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now,
    platform: id,
    operation: 'pull',
    recordCount: pulledCount,
    status: 'success',
    message: `从 ${p.name} 拉取 ${pulledCount} 条记录`,
  })

  // 模拟推送
  const pushedCount = localRecordCount
  logs.unshift({
    id: `sync_${Date.now() + 1}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now,
    platform: id,
    operation: 'push',
    recordCount: pushedCount,
    status: 'success',
    message: `向 ${p.name} 推送 ${pushedCount} 条记录`,
  })

  // 5% 概率模拟冲突
  if (Math.random() < 0.05) {
    logs.unshift({
      id: `sync_${Date.now() + 2}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      platform: id,
      operation: 'conflict',
      recordCount: 1,
      status: 'conflict',
      message: `检测到 1 条冲突记录（已按服务器优先策略解决）`,
    })
  }

  p.lastSyncAt = now
  p.recordCount = pulledCount + pushedCount
  p.status = 'connected'
  savePlatforms(platforms)
  saveSyncLogs(logs)

  return { success: true, logs, platforms }
}

/** 同步所有已连接平台 */
export async function syncAllPlatforms(
  localRecordCount: number
): Promise<{ logs: SyncLog[]; platforms: PlatformInfo[] }> {
  const platforms = loadPlatforms()
  const connected = platforms.filter(p => p.status === 'connected')
  let allLogs = loadSyncLogs()
  let currentPlatforms = platforms
  for (const p of connected) {
    const result = await syncWithPlatform(p.id, localRecordCount)
    allLogs = result.logs
    currentPlatforms = result.platforms
  }
  return { logs: allLogs, platforms: currentPlatforms }
}

/** 清空同步日志 */
export function clearSyncLogs(): void {
  localStorage.removeItem(SYNC_LOG_KEY)
}
