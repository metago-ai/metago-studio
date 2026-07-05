/**
 * 智能联网判断规则引擎
 *
 * 根据用户消息内容自动判断是否需要触发联网搜索，
 * 模拟"资深 AI 助手"的直觉：什么时候该搜、什么时候不搜。
 */

import type { SearchDecision } from '../types'

// ============ 规则定义 ============

/** 时效性关键词：暗示需要最新信息 */
const FRESHNESS_PATTERNS = [
  /最新|最近|今天|昨天|本周|本月|今年|当前|现在|实时/,
  /\b202[4-9]\b/,
  /\bnow\b|\bcurrent\b|\blatest\b|\brecent\b/i,
]

/** 事实核查关键词：暗示需要查证外部事实 */
const FACT_CHECK_PATTERNS = [
  /CVE|漏洞|版本|发行|发布|更新|变更|breaking/i,
  /价格|多少钱|费用|收费|订阅|计费/,
  /文档|官网|手册|指南|教程/,
  /新闻|公告|声明|声明/,
]

/** 用户明确要求搜索 */
const EXPLICIT_SEARCH_PATTERNS = [
  /搜索|搜一下|查一下|帮我查|查询|检索|联网|上网|网上/,
  /\bsearch\b|\blook\s*up\b|\bfind\s*out\b|\bgoogle\b/i,
]

/** 代码审查中的高危模式（触发 CVE 搜索） */
const VULNERABILITY_PATTERNS = [
  { pattern: /\beval\s*\(/, query: 'JavaScript eval security risk CVE' },
  { pattern: /SELECT\s+.*\+.*['"]?\s*\+\s*/, query: 'SQL injection prevention' },
  { pattern: /innerHTML\s*=/, query: 'innerHTML XSS vulnerability prevention' },
  { pattern: /document\.write/, query: 'document.write XSS risk' },
  { pattern: /crypto\.createCipher\b(?!iv)/, query: 'Node.js createCipher deprecated CVE' },
  { pattern: /md5\s*\(|sha1\s*\(/, query: 'MD5 SHA1 collision attack vulnerability' },
]

/** 不需要搜索的场景：纯代码/创意/设计类 */
const NO_SEARCH_PATTERNS = [
  /^写一段|生成|实现|帮我写|重构|优化这段|解释这段/,
  /^翻译|改写|润色/,
]

// ============ 实体识别（简化版） ============

/** 识别 npm 包名（用于判断是否在问外部库信息） */
function detectPackageNames(text: string): string[] {
  const patterns = [
    /(?:npm\s+包|库|package|module|framework)\s*[:：]?\s*([a-z][a-z0-9@/-]+)/gi,
    /\b(?:express|react|vue|angular|next|nuxt|vite|webpack|typescript|nodejs|lodash|moment|axios|fastify|koa)\b/gi,
  ]
  const found = new Set<string>()
  for (const p of patterns) {
    const matches = text.matchAll(p)
    for (const m of matches) {
      found.add(m[1] || m[0])
    }
  }
  return [...found]
}

// ============ 主判断函数 ============

/**
 * 判断是否需要联网搜索
 *
 * @param userMessage 用户消息
 * @param codeContext 可选：关联的代码上下文
 * @param forceMode 强制模式：always/never 覆盖自动判断
 */
export function decideSearch(
  userMessage: string,
  codeContext?: string,
  forceMode: 'auto' | 'always' | 'never' = 'auto',
): SearchDecision {
  // 强制模式优先
  if (forceMode === 'always') {
    return {
      shouldSearch: true,
      query: extractSearchQuery(userMessage),
      reason: '用户强制开启联网',
    }
  }
  if (forceMode === 'never') {
    return { shouldSearch: false, reason: '用户强制关闭联网' }
  }

  const text = userMessage.toLowerCase()

  // 1. 检查不需要搜索的场景
  for (const pattern of NO_SEARCH_PATTERNS) {
    if (pattern.test(userMessage)) {
      // 但如果同时有时效性词，仍然要搜
      const hasFreshness = FRESHNESS_PATTERNS.some(p => p.test(text))
      if (!hasFreshness) {
        return { shouldSearch: false, reason: '纯代码生成/编辑任务，无需联网' }
      }
    }
  }

  // 2. 明确搜索请求
  for (const pattern of EXPLICIT_SEARCH_PATTERNS) {
    if (pattern.test(userMessage)) {
      return {
        shouldSearch: true,
        query: extractSearchQuery(userMessage),
        reason: '用户明确要求搜索',
      }
    }
  }

  // 3. 时效性关键词
  for (const pattern of FRESHNESS_PATTERNS) {
    if (pattern.test(text)) {
      return {
        shouldSearch: true,
        query: extractSearchQuery(userMessage),
        reason: '检测到时效性需求',
      }
    }
  }

  // 4. 事实核查关键词
  for (const pattern of FACT_CHECK_PATTERNS) {
    if (pattern.test(text)) {
      return {
        shouldSearch: true,
        query: extractSearchQuery(userMessage),
        reason: '检测到事实核查需求',
      }
    }
  }

  // 5. 代码审查场景：高危模式触发 CVE 搜索
  if (codeContext) {
    for (const { pattern, query } of VULNERABILITY_PATTERNS) {
      if (pattern.test(codeContext)) {
        return {
          shouldSearch: true,
          query,
          reason: `代码审查检测到高危模式：${pattern.source}`,
        }
      }
    }
  }

  // 6. 包名 + 外部信息查询
  const packages = detectPackageNames(userMessage)
  if (packages.length > 0 && /版本|文档|怎么用|用法|API|接口|示例/.test(userMessage)) {
    return {
      shouldSearch: true,
      query: `${packages[0]} latest version documentation`,
      reason: `查询外部包信息：${packages[0]}`,
    }
  }

  return { shouldSearch: false, reason: '无需联网，模型自身知识足够' }
}

/** 从用户消息中提取搜索查询词 */
function extractSearchQuery(message: string): string {
  // 移除代码块（避免把代码当搜索词）
  const cleaned = message
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/^[#\-*]\s+/gm, ' ')
    .trim()

  // 如果消息很短（<200字），直接用原文
  if (cleaned.length < 200) {
    return cleaned.slice(0, 200)
  }

  // 否则取前 3 句话
  const sentences = cleaned.split(/[。.!！?？\n]/).filter(s => s.trim().length > 5)
  return sentences.slice(0, 3).join(' ').slice(0, 200)
}
