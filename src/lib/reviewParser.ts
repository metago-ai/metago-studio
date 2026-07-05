/**
 * 审查结果解析器
 *
 * 从 AI 输出的 Markdown 文本中提取结构化问题列表，
 * 用于在审查看板上点击跳转。
 *
 * 支持的 AI 输出格式（在 aiClient.ts 的系统提示词中约定）：
 *   【风险等级】Critical / Major / Minor / Info
 *   【问题定位】文件名:行号区间
 *   【问题描述】具体说明问题
 *   【修复建议】给出可执行的修复代码
 *   【原理说明】为什么这样修复
 */

import type { ReviewIssue, Severity } from '../types'

// ============ 等级关键词映射 ============

const SEVERITY_KEYWORDS: Record<Severity, string[]> = {
  critical: ['critical', '严重', '致命', '高危', '紧急', 'critical 级'],
  major: ['major', '主要', '重要', '中等', 'major 级'],
  minor: ['minor', '次要', '轻微', '小问题', 'minor 级'],
  info: ['info', '建议', '提示', '注意', 'info 级', '信息'],
}

// ============ 主解析函数 ============

/**
 * 从 AI 审查输出中解析结构化问题列表
 *
 * 解析策略：
 * 1. 按【风险等级】分块（或 Markdown 的 ## Critical / ### Major 等标题）
 * 2. 每块提取：等级 / 文件名 / 行号 / 描述 / 建议 / 原理
 */
export function parseReviewIssues(aiOutput: string, defaultFileName?: string): ReviewIssue[] {
  if (!aiOutput || aiOutput.trim().length === 0) return []

  // 切分为问题块
  const blocks = splitIntoBlocks(aiOutput)
  const issues: ReviewIssue[] = []

  for (const block of blocks) {
    const issue = parseBlock(block, defaultFileName)
    if (issue) {
      issues.push(issue)
    }
  }

  return issues
}

// ============ 分块逻辑 ============

/**
 * 将 AI 输出切分为多个问题块
 *
 * 优先按 【风险等级】 标记切分，
 * 其次按 Markdown 标题（## / ###）切分。
 */
function splitIntoBlocks(text: string): string[] {
  // 策略 1：按 【风险等级】 切分
  const severityPattern = /【风险等级】[\s\S]*?(?=【风险等级】|$)/g
  const blocks1 = text.match(severityPattern)
  if (blocks1 && blocks1.length > 0) {
    return blocks1
  }

  // 策略 2：按 Markdown 标题切分（## 或 ### 开头，含等级关键词）
  const headerPattern = /^#{2,3}\s+.*(Critical|Major|Minor|Info|严重|主要|次要|建议)[\s\S]*?(?=^#{2,3}\s|$)/gim
  const blocks2 = text.match(headerPattern)
  if (blocks2 && blocks2.length > 0) {
    return blocks2
  }

  // 策略 3：整体作为一块（仅当包含风险关键词时）
  if (/(Critical|Major|Minor|Info|严重|主要|次要)/i.test(text)) {
    return [text]
  }

  return []
}

// ============ 单块解析 ============

function parseBlock(block: string, defaultFileName?: string): ReviewIssue | null {
  // 解析等级
  const severity = detectSeverity(block)
  if (!severity) return null

  // 解析文件名和行号
  const { fileName, lineRange } = detectLocation(block, defaultFileName)

  // 解析描述
  const description = extractField(block, ['【问题描述】', '**问题描述**', '描述']) || block.slice(0, 200)

  // 解析修复建议
  const suggestion = extractField(block, ['【修复建议】', '**修复建议**', '建议'])

  // 解析原理说明
  const rationale = extractField(block, ['【原理说明】', '**原理说明**', '原理'])

  return {
    id: `issue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    severity,
    fileName,
    lineRange,
    description: description.trim(),
    suggestion: suggestion?.trim(),
    rationale: rationale?.trim(),
  }
}

// ============ 字段提取辅助 ============

/** 检测风险等级 */
function detectSeverity(text: string): Severity | null {
  const lower = text.toLowerCase()
  // 按优先级检测：Critical > Major > Minor > Info
  for (const sev of ['critical', 'major', 'minor', 'info'] as Severity[]) {
    const keywords = SEVERITY_KEYWORDS[sev]
    if (keywords.some(k => lower.includes(k.toLowerCase()))) {
      return sev
    }
  }
  return null
}

/** 从文本中提取文件名和行号 */
function detectLocation(text: string, defaultFileName?: string): {
  fileName?: string
  lineRange?: { start: number; end: number }
} {
  // 匹配 【问题定位】 文件名:行号-行号
  const locField = extractField(text, ['【问题定位】', '**问题定位**', '定位'])
  const source = locField || text

  // 文件名 + 行号：xxx.ts:10-15  或 xxx.ts:10  或 第10-15行
  const fileLinePattern = /([a-zA-Z0-9_\-./]+\.\w+)\s*[:：]\s*(\d+)\s*[-–—~]\s*(\d+)/
  const match1 = source.match(fileLinePattern)
  if (match1) {
    return {
      fileName: match1[1],
      lineRange: { start: parseInt(match1[2], 10), end: parseInt(match1[3], 10) },
    }
  }

  // 单行号：xxx.ts:10
  const fileSinglePattern = /([a-zA-Z0-9_\-./]+\.\w+)\s*[:：]\s*(\d+)/
  const match2 = source.match(fileSinglePattern)
  if (match2) {
    return {
      fileName: match2[1],
      lineRange: { start: parseInt(match2[2], 10), end: parseInt(match2[2], 10) },
    }
  }

  // 中文行号：第10-15行
  const cnLinePattern = /第\s*(\d+)\s*[-–—~]\s*(\d+)\s*行/
  const match3 = source.match(cnLinePattern)
  if (match3) {
    return {
      fileName: defaultFileName,
      lineRange: { start: parseInt(match3[1], 10), end: parseInt(match3[2], 10) },
    }
  }

  // 只有文件名
  const fileOnly = source.match(/([a-zA-Z0-9_\-./]+\.\w+)/)
  if (fileOnly) {
    return { fileName: fileOnly[1] }
  }

  return { fileName: defaultFileName }
}

/** 提取指定字段内容（到下一个【字段】或块尾） */
function extractField(text: string, fieldNames: string[]): string | undefined {
  for (const name of fieldNames) {
    const idx = text.indexOf(name)
    if (idx >= 0) {
      const start = idx + name.length
      // 找到下一个【字段】标记
      const nextField = text.slice(start).search(/【[^】]+】|\*\*[^*]+\*\*/)
      const end = nextField >= 0 ? start + nextField : text.length
      return text.slice(start, end).trim()
    }
  }
  return undefined
}

// ============ 统计辅助 ============

/** 统计各等级问题数量 */
export function countBySeverity(issues: ReviewIssue[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, major: 0, minor: 0, info: 0 }
  for (const issue of issues) {
    counts[issue.severity]++
  }
  return counts
}
