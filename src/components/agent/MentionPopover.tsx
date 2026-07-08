import { useState, useEffect, useRef, useCallback } from 'react'
import { Bot, FileCode, Globe, BookOpen, Search } from 'lucide-react'
import { getAgents } from '../../lib/settingsStore'
import { getIndexDocs } from '../../lib/settingsStore'

export interface MentionItem {
  type: 'agent' | 'file' | 'web' | 'doc'
  id: string
  label: string
  description?: string
  insertText: string
}

interface MentionPopoverProps {
  trigger: '@' | '#' | null
  query: string
  position: { top: number; left: number }
  onSelect: (item: MentionItem) => void
  onClose: () => void
}

/** @智能体 / #上下文 提及弹出框（对标 Trae @Builder / #Web / #Doc） */
export function MentionPopover({ trigger, query, position, onSelect, onClose }: MentionPopoverProps) {
  const [items, setItems] = useState<MentionItem[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!trigger) { setItems([]); return }

    const loadItems = async () => {
      let list: MentionItem[] = []
      const q = query.toLowerCase()

      if (trigger === '@') {
        // @智能体
        const agents = getAgents()
        list = agents
          .filter(a => !q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q))
          .map(a => ({
            type: 'agent' as const,
            id: a.id,
            label: a.name,
            description: a.description,
            insertText: `@${a.name}`,
          }))
      } else if (trigger === '#') {
        // #Web / #Doc / #文件
        const docs = getIndexDocs()
        const docItems: MentionItem[] = docs
          .filter(d => !q || d.title.toLowerCase().includes(q))
          .map(d => ({
            type: d.type === 'web' ? 'web' : 'doc',
            id: d.id,
            label: d.title,
            description: d.url || d.path,
            insertText: `#${d.title}`,
          }))
        // 固定选项
        const fixed: MentionItem[] = [
          { type: 'web', id: 'web-new', label: 'Web', description: '引用网页 URL 作为上下文', insertText: '#Web ' },
          { type: 'doc', id: 'doc-new', label: 'Doc', description: '引用已索引的文档', insertText: '#Doc ' },
          { type: 'file', id: 'file-new', label: '文件', description: '引用工作区文件', insertText: '#文件 ' },
        ]
        list = [...fixed, ...docItems]
      }

      setItems(list)
      setActiveIdx(0)
    }

    loadItems()
  }, [trigger, query])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!trigger || items.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSelect(items[activeIdx])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [trigger, items, activeIdx, onSelect, onClose])

  useEffect(() => {
    if (trigger) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [trigger, handleKeyDown])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (trigger) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [trigger, onClose])

  if (!trigger || items.length === 0) return null

  const getIcon = (type: MentionItem['type']) => {
    switch (type) {
      case 'agent': return <Bot className="w-3.5 h-3.5 text-purple-400" />
      case 'web': return <Globe className="w-3.5 h-3.5 text-blue-400" />
      case 'doc': return <BookOpen className="w-3.5 h-3.5 text-accent-emerald" />
      case 'file': return <FileCode className="w-3.5 h-3.5 text-zinc-400" />
    }
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 w-64 max-h-60 overflow-y-auto bg-bg-card border border-border-default rounded-lg shadow-2xl"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-2 py-1 text-[10px] text-zinc-600 border-b border-border-subtle sticky top-0 bg-bg-card">
        {trigger === '@' ? '选择智能体' : '选择上下文'}
      </div>
      {items.map((item, idx) => (
        <button
          key={`${item.type}-${item.id}`}
          onClick={() => onSelect(item)}
          className={`w-full flex items-start gap-2 px-2 py-1.5 text-left transition-colors ${
            idx === activeIdx ? 'bg-accent-emerald/10' : 'hover:bg-bg-hover'
          }`}
        >
          {getIcon(item.type)}
          <div className="flex-1 min-w-0">
            <div className="text-xs text-zinc-200 truncate">{item.label}</div>
            {item.description && <div className="text-[10px] text-zinc-500 truncate">{item.description}</div>}
          </div>
        </button>
      ))}
      {items.length === 0 && (
        <div className="px-2 py-3 text-center text-[10px] text-zinc-600">
          <Search className="w-3 h-3 inline mr-1" />
          无匹配项
        </div>
      )}
    </div>
  )
}

/** 检测输入框中光标位置是否触发了 @ 或 # */
export function detectMentionTrigger(text: string, cursorPos: number): { trigger: '@' | '#' | null; query: string; startPos: number } {
  if (cursorPos === 0) return { trigger: null, query: '', startPos: -1 }
  // 向前查找 @ 或 # 或空格
  let i = cursorPos - 1
  while (i >= 0 && text[i] !== ' ' && text[i] !== '\n' && text[i] !== '@' && text[i] !== '#') {
    i--
  }
  if (i >= 0 && (text[i] === '@' || text[i] === '#')) {
    // 确认 @ 或 # 是在词首（前面是空格或行首）
    if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '\n') {
      const trigger = text[i] as '@' | '#'
      const query = text.slice(i + 1, cursorPos)
      return { trigger, query, startPos: i }
    }
  }
  return { trigger: null, query: '', startPos: -1 }
}
