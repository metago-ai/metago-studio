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

// ============ 通用 PDF 导出（iframe + print） ============

/** 转义 HTML 特殊字符 */
function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 将类 Markdown 文本转为基础 HTML（支持表格、段落、换行） */
function markdownToBasicHTML(content: string): string {
  const escaped = escapeHTML(content)
  const lines = escaped.split('\n')
  const html: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    // 检测 Markdown 表格行：以 | 开头并以 | 结尾
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const rows: string[][] = []
      while (
        i < lines.length &&
        lines[i].trim().startsWith('|') &&
        lines[i].trim().endsWith('|')
      ) {
        const cells = lines[i].split('|').slice(1, -1).map(c => c.trim())
        // 跳过分隔行 |---|---|
        if (!cells.every(c => /^[-:]+$/.test(c))) {
          rows.push(cells)
        }
        i++
      }
      const [header, ...body] = rows
      html.push('<table>')
      if (header) {
        html.push(
          '<thead><tr>' +
            header.map(c => `<th>${c}</th>`).join('') +
            '</tr></thead>',
        )
      }
      if (body.length) {
        html.push('<tbody>')
        for (const r of body) {
          html.push('<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>')
        }
        html.push('</tbody>')
      }
      html.push('</table>')
    } else {
      // 普通段落（空行渲染为占位）
      html.push(`<p>${line || '&nbsp;'}</p>`)
      i++
    }
  }
  return html.join('\n')
}

/**
 * 导出为 PDF（使用浏览器原生 print API，生成可打印的 PDF）
 * 创建一个隐藏的 iframe，写入 HTML 内容，调用 print()
 */
export function exportToPDF(
  title: string,
  sections: { heading: string; content: string }[],
): void {
  // 创建隐藏 iframe
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc) {
    if (iframe.parentNode) document.body.removeChild(iframe)
    return
  }

  // 构建各 section 的 HTML
  const sectionsHTML = sections
    .map(s => {
      return `
      <section>
        <h2>${escapeHTML(s.heading)}</h2>
        <div>${markdownToBasicHTML(s.content)}</div>
      </section>`
    })
    .join('\n')

  doc.open()
  doc.write(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(title)}</title>
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif;
      color: #1a1a1a;
      line-height: 1.6;
      font-size: 12pt;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    h1 {
      font-size: 22pt;
      color: #0f766e;
      border-bottom: 2px solid #0f766e;
      padding-bottom: 8px;
      margin-bottom: 16px;
    }
    h2 {
      font-size: 15pt;
      color: #134e4a;
      margin-top: 24px;
      margin-bottom: 8px;
      border-left: 4px solid #14b8a6;
      padding-left: 8px;
    }
    p {
      margin: 4px 0;
    }
    section {
      page-break-inside: avoid;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
      font-size: 11pt;
    }
    th, td {
      border: 1px solid #d4d4d4;
      padding: 6px 10px;
      text-align: left;
    }
    th {
      background: #f0fdfa;
      font-weight: 600;
    }
    tr:nth-child(even) td {
      background: #fafafa;
    }
    .footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #d4d4d4;
      font-size: 9pt;
      color: #737373;
      text-align: center;
    }
  </style>
</head>
<body>
  <h1>${escapeHTML(title)}</h1>
  ${sectionsHTML}
  <div class="footer">
    由 MetaGO Studio Pro 生成 · ${new Date().toLocaleString('zh-CN')}
  </div>
</body>
</html>`)
  doc.close()

  // 等待内容渲染后调用打印（兜底：onload + setTimeout 双保险）
  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch (e) {
      console.error('[exportToPDF] print failed:', e)
    }
    setTimeout(() => {
      if (iframe.parentNode) document.body.removeChild(iframe)
    }, 1000)
  }

  iframe.onload = triggerPrint
  setTimeout(triggerPrint, 300)
}
