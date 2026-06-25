import { useEffect, useState } from 'react'
import { X, Copy, Check, Download, FileJson, FileText } from 'lucide-react'
import type { PreviewType } from '../types'
import { copyToClipboard, downloadFile } from '../utils/generators'

interface PreviewModalProps {
  open: boolean
  type: PreviewType | null
  content: string
  filename: string
  onClose: () => void
}

const TITLE_MAP: Record<PreviewType, string> = {
  'package.json': 'package.json 预览',
  'README.md': 'README.md 预览',
  'kit-config.json': 'Kit 配置预览',
}

export function PreviewModal({ open, type, content, filename, onClose }: PreviewModalProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  useEffect(() => {
    setCopied(false)
  }, [open, type])

  if (!open || !type) return null

  const handleCopy = async () => {
    const ok = await copyToClipboard(content)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownload = () => {
    const mime = type === 'README.md' ? 'text/markdown' : 'application/json'
    downloadFile(filename, content, mime)
  }

  const isJson = type !== 'README.md'
  const lineCount = content.split('\n').length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={TITLE_MAP[type]}
    >
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative w-full max-w-3xl max-h-[85vh] card-base flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center gap-2 min-w-0">
            {isJson ? (
              <FileJson className="w-4 h-4 text-accent-emerald flex-shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-accent-emerald flex-shrink-0" />
            )}
            <span className="text-sm font-medium text-zinc-100 truncate">{TITLE_MAP[type]}</span>
            <span className="text-xs text-zinc-500 font-mono truncate hidden sm:inline">{filename}</span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-100 transition-colors p-1 rounded hover:bg-bg-hover"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-4 py-3 bg-bg-deep/60">
          <pre className="code-block text-zinc-200">{content}</pre>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle">
          <span className="text-xs text-zinc-500">
            {content.length} 字符 · {lineCount} 行
          </span>
          <div className="flex gap-2">
            <button onClick={handleCopy} className="btn-secondary">
              {copied ? (
                <Check className="w-4 h-4 text-accent-emerald" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copied ? '已复制' : '复制内容'}
            </button>
            <button onClick={handleDownload} className="btn-primary">
              <Download className="w-4 h-4" />
              下载文件
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
