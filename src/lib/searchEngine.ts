/**
 * 博查联网搜索引擎封装
 *
 * 通过 CloudBase 云函数 aiProxy 代理调用博查 Web Search API，
 * API Key 由云端持有，浏览器永不接触。
 */

import { callFunction } from './cloudFunctions'
import type { SearchResult } from '../types'

export interface BochaSearchResponse {
  results: SearchResult[]
  total: number
}

/**
 * 执行联网搜索
 *
 * 调用链路：浏览器 → CloudBase aiProxy 云函数 → 博查 API
 * 云函数根据 action='webSearch' 路由到博查。
 */
export async function webSearch(query: string, count = 8): Promise<SearchResult[]> {
  const res = await callFunction<BochaSearchResponse>('aiProxy', {
    action: 'webSearch',
    query,
    count,
  })

  if (res.code !== 0 || !res.data) {
    console.warn('[searchEngine] 搜索失败:', res.message)
    return []
  }

  return res.data.results ?? []
}

/**
 * 将搜索结果格式化为注入 prompt 的文本
 */
export function formatSearchResultsForPrompt(results: SearchResult[]): string {
  if (results.length === 0) return ''

  const lines = ['以下是相关的网络搜索结果，请基于这些信息回答用户问题：\n']
  results.forEach((r, i) => {
    lines.push(`[${i + 1}] ${r.title}`)
    lines.push(`    来源：${r.url}`)
    if (r.snippet) {
      lines.push(`    摘要：${r.snippet}`)
    }
    lines.push('')
  })

  return lines.join('\n')
}
