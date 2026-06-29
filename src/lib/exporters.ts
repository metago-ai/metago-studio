/**
 * 高级导出模块（Pro 版 FR-1 / FR-2 / FR-3 验收标准）
 *
 * - 决策锁日志导出 JSONL（PRD FR-1 验收：校验日志可导出 JSONL 格式）
 * - 进化档案导出 JSON / Markdown（已在 evolutionArchive.ts 实现）
 * - 仪表盘报告导出 PDF（通过浏览器打印）
 */

import type { DecisionLockRecord, EvolutionRecord } from '../types'

// ============ 决策锁 JSONL 导出 ============

/** 导出决策锁日志为 JSONL 字符串（每行一条 JSON） */
export function exportDecisionLockToJSONL(records: DecisionLockRecord[]): string {
  return records.map(r => JSON.stringify(r)).join('\n')
}

/** 导出决策锁日志为 Markdown */
export function exportDecisionLockToMarkdown(records: DecisionLockRecord[]): string {
  const lines: string[] = []
  lines.push('# MetaGO 决策锁校验日志')
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
    lines.push(`- **输入摘要**：${r.input.slice(0, 80)}${r.input.length > 80 ? '...' : ''}`)
    lines.push(`- **总耗时**：${r.totalDurationMs}ms`)
    lines.push(`- **最终结果**：${r.passed ? '✅ 通过' : '❌ 阻断'}`)
    if (r.blockedReason) {
      lines.push(`- **阻断原因**：${r.blockedReason}`)
    }
    lines.push('')
    lines.push('### 四道关卡详情')
    lines.push('')
    lines.push('| 关卡 | 名称 | 状态 | 耗时 |')
    lines.push('|------|------|------|------|')
    for (const s of r.stages) {
      lines.push(`| ${s.name} | ${s.fullName} | ${s.passed ? '✅' : '❌'} | ${s.durationMs}ms |`)
    }
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  lines.push('*由 MetaGO Pro 决策锁强制校验系统自动生成*')
  return lines.join('\n')
}

/** 触发 JSONL 文件下载 */
export function downloadJSONL(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/x-ndjson;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 导出并下载决策锁 JSONL */
export function exportAndDownloadLockJSONL(records: DecisionLockRecord[]): void {
  const content = exportDecisionLockToJSONL(records)
  const filename = `metago-decision-lock-${new Date().toISOString().slice(0, 10)}.jsonl`
  downloadJSONL(content, filename)
}

/** 导出并下载决策锁 Markdown */
export function exportAndDownloadLockMarkdown(records: DecisionLockRecord[]): void {
  const content = exportDecisionLockToMarkdown(records)
  const filename = `metago-decision-lock-${new Date().toISOString().slice(0, 10)}.md`
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ============ 仪表盘综合报告导出 ============

export interface DashboardReportData {
  generatedAt: string
  planTier: string
  totalSkills: number
  totalEvolutions: number
  evolutionRecords: EvolutionRecord[]
  decisionLockRecords: DecisionLockRecord[]
  lockStats: {
    total: number
    passed: number
    blocked: number
    passRate: number
    avgDurationMs: number
  }
}

/** 生成仪表盘综合报告（Markdown） */
export function generateDashboardReport(data: DashboardReportData): string {
  const lines: string[] = []
  lines.push('# MetaGO 能力度量仪表盘报告')
  lines.push('')
  lines.push(`> 生成时间：${data.generatedAt}`)
  lines.push(`> 当前档位：${data.planTier}`)
  lines.push(`> 技能总数：${data.totalSkills}`)
  lines.push(`> 进化总数：${data.totalEvolutions}`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 一、决策锁校验统计')
  lines.push('')
  lines.push(`- 总校验次数：${data.lockStats.total}`)
  lines.push(`- 通过次数：${data.lockStats.passed}`)
  lines.push(`- 阻断次数：${data.lockStats.blocked}`)
  lines.push(`- 通过率：${data.lockStats.passRate.toFixed(1)}%`)
  lines.push(`- 平均耗时：${data.lockStats.avgDurationMs}ms`)
  lines.push('')
  lines.push('## 二、元进化档案')
  lines.push('')
  lines.push(`- 进化记录总数：${data.evolutionRecords.length}`)
  lines.push('')
  if (data.evolutionRecords.length > 0) {
    lines.push('### 最近 5 条进化记录')
    lines.push('')
    for (const r of data.evolutionRecords.slice(0, 5)) {
      lines.push(`- **${r.timestamp}** - ${r.trigger}：${r.boundary.slice(0, 60)}`)
    }
    lines.push('')
  }
  lines.push('## 三、决策锁校验日志')
  lines.push('')
  if (data.decisionLockRecords.length > 0) {
    lines.push('### 最近 5 条校验记录')
    lines.push('')
    for (const r of data.decisionLockRecords.slice(0, 5)) {
      lines.push(`- **${r.timestamp}** - ${r.passed ? '✅ 通过' : '❌ 阻断'} - ${r.totalDurationMs}ms`)
      if (r.blockedReason) lines.push(`  - 阻断原因：${r.blockedReason}`)
    }
    lines.push('')
  }
  lines.push('---')
  lines.push('')
  lines.push('*由 MetaGO Studio Pro 能力度量仪表盘自动生成*')
  return lines.join('\n')
}

/** 导出仪表盘报告（Markdown 文件） */
export function exportDashboardReport(data: DashboardReportData): void {
  const content = generateDashboardReport(data)
  const filename = `metago-dashboard-${new Date().toISOString().slice(0, 10)}.md`
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 导出仪表盘为 PDF（通过浏览器打印） */
export function exportDashboardToPDF(): void {
  window.print()
}
