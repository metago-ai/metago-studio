/**
 * 元进化档案管理（Pro 版 FR-2）
 *
 * 自动记录 AI 每次能力边界突破，形成个人进化档案。
 * - 本地持久化（localStorage）
 * - 支持导出 JSON / Markdown
 * - 支持按时间/平台/能力维度筛选
 *
 * 隐私：档案仅用户可见（PRD FR-2 验收标准）
 */

import type { EvolutionRecord, EvolutionStats, AbilityDimension } from '../types'

const STORAGE_KEY = 'metago_evolution_records_v1'
const CAPABILITY_KEY = 'metago_capability_dimensions_v1'

/** 默认 10 维能力评分（新用户从零开始，随实际使用自动提升） */
const DEFAULT_DIMENSIONS: AbilityDimension[] = [
  { dimension: '代码', score: 0, fullMark: 100 },
  { dimension: '架构', score: 0, fullMark: 100 },
  { dimension: '审查', score: 0, fullMark: 100 },
  { dimension: '设计', score: 0, fullMark: 100 },
  { dimension: '文档', score: 0, fullMark: 100 },
  { dimension: '测试', score: 0, fullMark: 100 },
  { dimension: '合规', score: 0, fullMark: 100 },
  { dimension: '安全', score: 0, fullMark: 100 },
  { dimension: '创意', score: 0, fullMark: 100 },
  { dimension: '沟通', score: 0, fullMark: 100 },
]

// ============ 持久化 ============

/** 从 localStorage 读取进化记录 */
export function loadRecords(): EvolutionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as EvolutionRecord[]
  } catch {
    return []
  }
}

/** 保存进化记录到 localStorage */
export function saveRecords(records: EvolutionRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch (e) {
    console.error('[evolutionArchive] 保存失败', e)
  }
}

/** 读取能力维度评分（始终返回可变副本） */
export function loadDimensions(): AbilityDimension[] {
  try {
    const raw = localStorage.getItem(CAPABILITY_KEY)
    if (!raw) return DEFAULT_DIMENSIONS.map(d => ({ ...d }))
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_DIMENSIONS.map(d => ({ ...d }))
    return parsed.map(d => ({ ...d })) as AbilityDimension[]
  } catch {
    return DEFAULT_DIMENSIONS.map(d => ({ ...d }))
  }
}

/** 保存能力维度评分 */
export function saveDimensions(dims: AbilityDimension[]): void {
  try {
    localStorage.setItem(CAPABILITY_KEY, JSON.stringify(dims))
  } catch (e) {
    console.error('[evolutionArchive] 保存维度失败', e)
  }
}

// ============ CRUD ============

/** 添加进化记录 */
export function addRecord(record: EvolutionRecord): EvolutionRecord[] {
  const records = loadRecords()
  records.unshift(record) // 新记录置顶
  // 上限 1000 条，防止 localStorage 溢出
  const trimmed = records.slice(0, 1000)
  saveRecords(trimmed)
  // 自动提升对应能力维度
  boostDimension(record.trigger)
  return trimmed
}

/** 删除进化记录 */
export function removeRecord(id: string): EvolutionRecord[] {
  const records = loadRecords().filter(r => r.id !== id)
  saveRecords(records)
  return records
}

/** 清空所有进化记录 */
export function clearRecords(): void {
  localStorage.removeItem(STORAGE_KEY)
}

// ============ 能力维度提升 ============

const TRIGGER_TO_DIMENSION: Record<string, string> = {
  'BPF': '代码',
  'Rust': '代码',
  'TypeScript': '代码',
  'GDPR': '合规',
  '合规': '合规',
  'WASM': '代码',
  'K8s': '架构',
  '架构': '架构',
  'GraphQL': '架构',
  'PostgreSQL': '架构',
  'OAuth': '安全',
  '安全': '安全',
  '测试': '测试',
  '文档': '文档',
  '设计': '设计',
  '创意': '创意',
  '沟通': '沟通',
}

/** 根据进化触发器提升对应能力维度 */
function boostDimension(trigger: string): void {
  const dims = loadDimensions()
  // 模糊匹配触发器
  const matchedDim = Object.entries(TRIGGER_TO_DIMENSION).find(([key]) =>
    trigger.toLowerCase().includes(key.toLowerCase())
  )
  if (matchedDim) {
    const dimName = matchedDim[1]
    const dim = dims.find(d => d.dimension === dimName)
    if (dim && dim.score < 100) {
      dim.score = Math.min(100, dim.score + 2) // 每次进化 +2 分
      saveDimensions(dims)
    }
  }
}

// ============ 统计计算 ============

/** 计算进化统计（用于仪表盘） */
export function calculateStats(records: EvolutionRecord[]): EvolutionStats {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const last7Days = records.filter(r => now - new Date(r.timestamp).getTime() <= 7 * day).length
  const last30Days = records.filter(r => now - new Date(r.timestamp).getTime() <= 30 * day).length
  const last90Days = records.filter(r => now - new Date(r.timestamp).getTime() <= 90 * day).length
  const last365Days = records.filter(r => now - new Date(r.timestamp).getTime() <= 365 * day).length

  const verified = records.filter(r => r.verified).length
  const successRate = records.length > 0 ? (verified / records.length) * 100 : 0

  const avgDuration = records.length > 0
    ? records.reduce((sum, r) => sum + r.durationMs, 0) / records.length
    : 0

  // 7 天日计数
  const dailyCounts: { date: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now - i * day)
    const dateStr = date.toISOString().slice(0, 10)
    const count = records.filter(r => r.timestamp.slice(0, 10) === dateStr).length
    dailyCounts.push({ date: dateStr, count })
  }

  return {
    totalEvolutions: records.length,
    last7Days,
    last30Days,
    last90Days,
    last365Days,
    successRate,
    averageDurationMs: Math.round(avgDuration),
    dimensions: loadDimensions(),
    dailyCounts,
  }
}

// ============ 导出 ============

/** 导出为 JSON 字符串 */
export function exportToJSON(records: EvolutionRecord[]): string {
  return JSON.stringify({
    exported_at: new Date().toISOString(),
    version: '1.0',
    total: records.length,
    records,
  }, null, 2)
}

/** 导出为 Markdown 字符串 */
export function exportToMarkdown(records: EvolutionRecord[]): string {
  const lines: string[] = []
  lines.push('# MetaGO 元进化档案')
  lines.push('')
  lines.push(`> 导出时间：${new Date().toISOString()}`)
  lines.push(`> 记录总数：${records.length}`)
  lines.push(`> 导出工具：MetaGO Studio Pro`)
  lines.push('')
  lines.push('---')
  lines.push('')

  for (const r of records) {
    lines.push(`## ${r.id}`)
    lines.push('')
    lines.push(`- **时间**：${r.timestamp}`)
    lines.push(`- **触发器**：${r.trigger}`)
    lines.push(`- **能力边界**：${r.boundary}`)
    lines.push(`- **差距分析**：${r.gap}`)
    lines.push(`- **自生成能力**：${r.generated}`)
    lines.push(`- **验证状态**：${r.verified ? '✅ 通过' : '❌ 未通过'}`)
    lines.push(`- **递归固化**：${r.recursed ? '✅ 已固化' : '❌ 未固化'}`)
    lines.push(`- **耗时**：${r.durationMs}ms`)
    lines.push(`- **深度**：Level ${r.depth}`)
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('*由 MetaGO Pro 元进化档案系统自动生成*')

  return lines.join('\n')
}

/** 触发文件下载 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 导出并下载 JSON 文件 */
export function exportAndDownloadJSON(records: EvolutionRecord[]): void {
  const content = exportToJSON(records)
  const filename = `metago-evolution-${new Date().toISOString().slice(0, 10)}.json`
  downloadFile(content, filename, 'application/json;charset=utf-8')
}

/** 导出并下载 Markdown 文件 */
export function exportAndDownloadMarkdown(records: EvolutionRecord[]): void {
  const content = exportToMarkdown(records)
  const filename = `metago-evolution-${new Date().toISOString().slice(0, 10)}.md`
  downloadFile(content, filename, 'text/markdown;charset=utf-8')
}
