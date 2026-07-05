import { X, Circle } from 'lucide-react'

interface OpenTab {
  path: string
  name: string
  language?: string
  dirty?: boolean
}

interface FileTabsProps {
  tabs: OpenTab[]
  activePath: string | null
  onTabClick: (path: string) => void
  onTabClose: (path: string) => void
}

/** 多文件标签页（对标 VS Code Tabs） */
export function FileTabs({ tabs, activePath, onTabClick, onTabClose }: FileTabsProps) {
  if (tabs.length === 0) return null

  return (
    <div className="flex items-center border-b border-border-subtle bg-bg-deep/70 overflow-x-auto scrollbar-thin">
      {tabs.map(tab => {
        const isActive = tab.path === activePath
        return (
          <div
            key={tab.path}
            onClick={() => onTabClick(tab.path)}
            className={`group flex items-center gap-1 px-3 py-1.5 border-r border-border-subtle cursor-pointer transition-colors flex-shrink-0 ${
              isActive
                ? 'bg-bg-card text-zinc-100 border-t-2 border-t-accent-emerald'
                : 'text-zinc-400 hover:bg-bg-hover'
            }`}
          >
            <span className="text-xs">{tab.name}</span>
            {tab.dirty && (
              <Circle className="w-2 h-2 fill-current text-zinc-400 group-hover:hidden" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onTabClose(tab.path)
              }}
              className={`p-0.5 rounded hover:bg-bg-hover ${
                isActive ? 'text-zinc-300' : 'text-zinc-600'
              } ${tab.dirty ? 'hidden group-hover:block' : ''}`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export type { OpenTab }
