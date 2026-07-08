/**
 * Inline Edit 确认面板（对标 Trae inline edit 流式 UI）
 *
 * AI 调用 inline_edit 工具时，此面板弹出展示 diff（原始 vs 修改后）。
 * 用户 Accept → 实际写入文件；Reject → 取消编辑。
 *
 * 复用 Monaco DiffEditor 展示差异，提供 Accept/Reject 按钮。
 */

import { useEffect, useState } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import { Check, X, FileEdit, Clock } from 'lucide-react'
import { usePendingEditStore } from '../../lib/stores/pendingEditStore'

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  json: 'json', css: 'css', scss: 'scss', less: 'less',
  html: 'html', htm: 'html', md: 'markdown', markdown: 'markdown',
  vue: 'html', svelte: 'html', py: 'python', go: 'go', rs: 'rust',
  java: 'java', c: 'c', cpp: 'cpp', h: 'cpp', hpp: 'cpp',
  sql: 'sql', yaml: 'yaml', yml: 'yaml', xml: 'xml',
  sh: 'shell', bash: 'shell', toml: 'toml',
}

function detectLanguage(filePath: string): string {
  const lower = filePath.toLowerCase()
  if (lower === 'dockerfile') return 'dockerfile'
  const ext = lower.split('.').pop() ?? ''
  return LANG_MAP[ext] ?? 'text'
}

export function InlineEditPanel() {
  const current = usePendingEditStore((s) => s.current)
  const accept = usePendingEditStore((s) => s.accept)
  const reject = usePendingEditStore((s) => s.reject)

  const [language, setLanguage] = useState('typescript')
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (current) {
      setLanguage(detectLanguage(current.filePath))
      setElapsed(0)
      const start = Date.now()
      const timer = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000))
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [current])

  if (!current) return null

  return (
    <div className="h-full flex flex-col bg-bg-card">
      {/* 头部：文件信息 + Accept/Reject 按钮 */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-bg-deep">
        <FileEdit className="w-4 h-4 text-accent-blue flex-shrink-0" />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-medium text-zinc-200 truncate">{current.filePath}</span>
          <span className="text-[10px] text-zinc-500">
            AI 建议编辑 {current.replaceAll ? '（所有匹配）' : '（第一处匹配）'} · 等待确认
          </span>
        </div>

        {/* 等待计时 */}
        <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-zinc-500 bg-bg-hover">
          <Clock className="w-2.5 h-2.5" />
          {elapsed}s
        </div>

        {/* Accept 按钮 */}
        <button
          onClick={accept}
          className="flex items-center gap-1 px-3 py-1 rounded text-[11px] font-medium bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30 hover:bg-accent-emerald/25 transition-colors"
          title="接受编辑（写入文件）"
        >
          <Check className="w-3 h-3" />
          接受
        </button>

        {/* Reject 按钮 */}
        <button
          onClick={reject}
          className="flex items-center gap-1 px-3 py-1 rounded text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
          title="拒绝编辑（取消）"
        >
          <X className="w-3 h-3" />
          拒绝
        </button>
      </div>

      {/* 改动摘要 */}
      <div className="flex-shrink-0 px-3 py-1.5 border-b border-border-subtle bg-bg-deep/30 text-[10px] text-zinc-500 flex items-center gap-4">
        <span>
          <span className="text-red-400">- 删除 {current.oldString.length}</span> 字符
        </span>
        <span>
          <span className="text-accent-emerald">+ 新增 {current.newString.length}</span> 字符
        </span>
        <span className="text-zinc-600">|</span>
        <span>净变化：{current.newString.length - current.oldString.length > 0 ? '+' : ''}{current.newString.length - current.oldString.length} 字符</span>
      </div>

      {/* Monaco DiffEditor 展示差异 */}
      <div className="flex-1 min-h-0">
        <DiffEditor
          height="100%"
          original={current.oldContent}
          modified={current.newContent}
          language={language}
          theme="vs-dark"
          options={{
            readOnly: true,
            renderSideBySide: true,
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
          }}
        />
      </div>

      {/* 底部提示 */}
      <div className="flex-shrink-0 px-3 py-1.5 border-t border-border-subtle bg-bg-deep/50 text-[10px] text-zinc-600 text-center">
        审查差异后点击「接受」写入文件，或「拒绝」取消编辑 · AI 将等待你的决定
      </div>
    </div>
  )
}
