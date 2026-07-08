/**
 * V3 维度9: 主动性 Agent Hook
 *
 * 对标 Trae 的主动性行为：
 * - 文件保存后自动检查诊断（TypeScript/Lint 错误）
 * - 发现新错误时主动提示用户
 * - 后台 AI 分析代码质量（限频，可选）
 *
 * 设计原则：
 * - 不打扰用户：只提示新增的错误，不重复提示已知的
 * - 限频防抖：同一文件 30 秒内不重复分析
 * - 用户可关闭：通过 enabled 参数控制
 * - 静默失败：AI 分析失败不影响主流程
 */

import { useState, useCallback, useRef } from 'react'
import { getDiagnosticManager } from '../lib/diagnostics'
import { sendSimpleChat } from '../lib/aiClient'

export interface ProactiveSuggestion {
  id: string
  type: 'error' | 'warning' | 'optimization'
  filePath: string
  fileName: string
  message: string
  detail?: string
  timestamp: number
}

const ANALYZE_DEBOUNCE_MS = 30_000 // 同一文件 30 秒内不重复分析
const MAX_SUGGESTIONS = 5 // 最多保留 5 条提示
const AI_ANALYSIS_THRESHOLD = 200 // 文件内容超过 200 字符才触发 AI 分析

export function useProactiveAgent(opts: {
  workspacePath?: string
  enabled?: boolean
}) {
  const [suggestions, setSuggestions] = useState<ProactiveSuggestion[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const lastAnalyzedRef = useRef<Map<string, number>>(new Map())
  const knownErrorSignaturesRef = useRef<Set<string>>(new Set())

  const notifyFileSaved = useCallback(async (filePath: string, content: string) => {
    if (opts.enabled === false || !filePath) return

    // 防抖：同一文件 30 秒内不重复分析
    const now = Date.now()
    const lastTime = lastAnalyzedRef.current.get(filePath) ?? 0
    if (now - lastTime < ANALYZE_DEBOUNCE_MS) return
    lastAnalyzedRef.current.set(filePath, now)

    const fileName = filePath.split(/[/\\]/).pop() ?? filePath
    setAnalyzing(true)

    try {
      // 1. 本地诊断检查（即时，不消耗配额）
      const diagManager = getDiagnosticManager()
      const diags = diagManager.getDiagnostics(filePath)
      const errors = diags.filter(d => d.severity === 'error')
      const warnings = diags.filter(d => d.severity === 'warning')

      // 只提示新错误（签名不重复）
      const newErrors = errors.filter(e => {
        const sig = `${filePath}:${e.line ?? '?'}:${e.message}`
        if (knownErrorSignaturesRef.current.has(sig)) return false
        knownErrorSignaturesRef.current.add(sig)
        return true
      })

      if (newErrors.length > 0) {
        setSuggestions(prev => [
          ...prev.slice(-(MAX_SUGGESTIONS - 1)),
          {
            id: `err-${now}`,
            type: 'error',
            filePath,
            fileName,
            message: `${newErrors.length} 个新错误`,
            detail: newErrors.slice(0, 3).map(e => `第 ${e.line ?? '?'} 行：${e.message}`).join('\n'),
            timestamp: now,
          },
        ])
      } else if (warnings.length > 0 && errors.length === 0) {
        // 只有警告、无错误时，提示优化建议
        const newWarnings = warnings.filter(w => {
          const sig = `${filePath}:warn:${w.line ?? '?'}:${w.message}`
          if (knownErrorSignaturesRef.current.has(sig)) return false
          knownErrorSignaturesRef.current.add(sig)
          return true
        })
        if (newWarnings.length > 0) {
          setSuggestions(prev => [
            ...prev.slice(-(MAX_SUGGESTIONS - 1)),
            {
              id: `warn-${now}`,
              type: 'warning',
              filePath,
              fileName,
              message: `${newWarnings.length} 个警告`,
              detail: newWarnings.slice(0, 2).map(w => `第 ${w.line ?? '?'} 行：${w.message}`).join('\n'),
              timestamp: now,
            },
          ])
        }
      }

      // 2. 后台 AI 分析（限频，仅对较大文件）
      if (content.length > AI_ANALYSIS_THRESHOLD && content.includes('function ')) {
        try {
          const aiSuggestion = await sendSimpleChat(
            [
              {
                role: 'system',
                content: '你是 MetaGO Agent 的主动分析模块。用户刚保存了文件，请快速检查代码质量，只指出最关键的 1 条问题（如果有）。如果没有问题，只回复"OK"两个字。回复要简洁，不超过 100 字。',
              },
              {
                role: 'user',
                content: `文件：${fileName}\n\n${content.slice(0, 2000)}`,
              },
            ],
            'deepseek-v4-pro',
          )

          if (aiSuggestion && aiSuggestion.trim() !== 'OK' && aiSuggestion.length > 10) {
            setSuggestions(prev => [
              ...prev.slice(-(MAX_SUGGESTIONS - 1)),
              {
                id: `ai-${now}`,
                type: 'optimization',
                filePath,
                fileName,
                message: aiSuggestion.slice(0, 200),
                timestamp: now,
              },
            ])
          }
        } catch {
          // AI 分析失败静默忽略
        }
      }
    } catch (e) {
      console.warn('[useProactiveAgent] 分析失败', e)
    } finally {
      setAnalyzing(false)
    }
  }, [opts.enabled])

  const dismissSuggestion = useCallback((id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id))
  }, [])

  const clearAll = useCallback(() => setSuggestions([]), [])

  return {
    suggestions,
    analyzing,
    notifyFileSaved,
    dismissSuggestion,
    clearAll,
  }
}
