import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, File, Command as CommandIcon, ArrowRight } from 'lucide-react'
import type { FileTreeNode } from '../../lib/fs/fsInterface'

interface Command {
  id: string
  label: string
  icon: React.ReactNode
  action: () => void
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  fileTree: FileTreeNode[]
  onFileOpen: (node: FileTreeNode) => void
  commands: Command[]
}

/** 命令面板（Ctrl+P / Ctrl+Shift+P） */
export function CommandPalette({
  open, onClose, fileTree, onFileOpen, commands,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // 扁平化文件列表
  const allFiles = useCallback((): FileTreeNode[] => {
    const result: FileTreeNode[] = []
    const walk = (nodes: FileTreeNode[]) => {
      for (const n of nodes) {
        if (n.type === 'file') result.push(n)
        if (n.children) walk(n.children)
      }
    }
    walk(fileTree)
    return result
  }, [fileTree])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  if (!open) return null

  // 构建候选项
  const isCommandMode = query.startsWith('>')
  const searchTerm = isCommandMode ? query.slice(1).trim() : query.trim()

  const fileMatches = isCommandMode
    ? []
    : allFiles()
        .filter(f => f.path.toLowerCase().includes(searchTerm.toLowerCase()))
        .slice(0, 10)
        .map(f => ({
          id: `file:${f.path}`,
          label: f.path,
          icon: <File className="w-3.5 h-3.5 text-zinc-500" />,
          action: () => {
            onFileOpen(f)
            onClose()
          },
        }))

  const commandMatches = isCommandMode
    ? commands
        .filter(c => c.label.toLowerCase().includes(searchTerm.toLowerCase()))
        .map(c => ({ ...c, action: () => { c.action(); onClose() } }))
    : []

  const allMatches = [...commandMatches, ...fileMatches]
  const selected = allMatches[Math.min(selectedIndex, allMatches.length - 1)]

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, allMatches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      selected?.action()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-bg-card border border-border-default rounded-lg shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 输入框 */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
          {isCommandMode ? (
            <CommandIcon className="w-4 h-4 text-accent-emerald" />
          ) : (
            <Search className="w-4 h-4 text-zinc-500" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="输入文件名搜索，或输入 > 执行命令..."
            className="flex-1 bg-transparent text-sm text-zinc-200 focus:outline-none placeholder:text-zinc-600"
          />
          <kbd className="text-[9px] text-zinc-600 px-1.5 py-0.5 rounded border border-border-subtle">ESC</kbd>
        </div>

        {/* 候选项 */}
        <div className="max-h-72 overflow-y-auto py-1">
          {allMatches.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-zinc-600">
              无匹配项
            </div>
          )}
          {allMatches.map((item, idx) => (
            <button
              key={item.id}
              onClick={item.action}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left ${
                idx === selectedIndex ? 'bg-accent-emerald/10' : ''
              }`}
            >
              {item.icon}
              <span className={`text-xs ${idx === selectedIndex ? 'text-accent-emerald' : 'text-zinc-300'}`}>
                {item.label}
              </span>
              {idx === selectedIndex && (
                <ArrowRight className="w-3 h-3 text-accent-emerald ml-auto" />
              )}
            </button>
          ))}
        </div>

        {/* 提示 */}
        <div className="px-3 py-1.5 border-t border-border-subtle flex items-center gap-3 text-[9px] text-zinc-600">
          <span><kbd className="px-1 rounded border border-border-subtle">↑↓</kbd> 导航</span>
          <span><kbd className="px-1 rounded border border-border-subtle">↵</kbd> 选择</span>
          <span><kbd className="px-1 rounded border border-border-subtle">&gt;</kbd> 命令模式</span>
        </div>
      </div>
    </div>
  )
}
