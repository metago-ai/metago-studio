import { useState } from 'react'
import { File, Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react'
import type { FileTreeNode } from '../../lib/fs/fsInterface'

interface FileTreeProps {
  nodes: FileTreeNode[]
  activeFileId: string | null
  onSelectFile: (node: FileTreeNode) => void
}

/** 文件资源管理器 */
export function FileTree({ nodes, activeFileId, onSelectFile }: FileTreeProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto py-1">
        {nodes.length === 0 ? (
          <div className="px-3 py-4 text-center text-[10px] text-zinc-600">
            无文件
          </div>
        ) : (
          nodes.map(node => (
            <TreeItem
              key={node.path}
              node={node}
              level={0}
              activeFileId={activeFileId}
              onSelectFile={onSelectFile}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface TreeItemProps {
  node: FileTreeNode
  level: number
  activeFileId: string | null
  onSelectFile: (node: FileTreeNode) => void
}

function TreeItem({ node, level, activeFileId, onSelectFile }: TreeItemProps) {
  const [expanded, setExpanded] = useState(true)
  const isActive = node.type === 'file' && node.path === activeFileId
  const indent = { paddingLeft: `${level * 12 + 12}px` }

  if (node.type === 'folder') {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-1 py-1 text-xs text-zinc-300 hover:bg-bg-hover transition-colors"
          style={indent}
        >
          {expanded
            ? <ChevronDown className="w-3 h-3 flex-shrink-0 text-zinc-500" />
            : <ChevronRight className="w-3 h-3 flex-shrink-0 text-zinc-500" />}
          {expanded
            ? <FolderOpen className="w-3.5 h-3.5 text-accent-amber flex-shrink-0" />
            : <Folder className="w-3.5 h-3.5 text-accent-amber flex-shrink-0" />}
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && node.children?.map(child => (
          <TreeItem
            key={child.path}
            node={child}
            level={level + 1}
            activeFileId={activeFileId}
            onSelectFile={onSelectFile}
          />
        ))}
      </div>
    )
  }

  return (
    <button
      onClick={() => onSelectFile(node)}
      className={`w-full flex items-center gap-1.5 py-1 text-xs transition-colors ${
        isActive
          ? 'bg-accent-emerald/15 text-accent-emerald'
          : 'text-zinc-400 hover:bg-bg-hover hover:text-zinc-200'
      }`}
      style={indent}
    >
      <File className="w-3.5 h-3.5 flex-shrink-0 text-zinc-500" />
      <span className="truncate">{node.name}</span>
    </button>
  )
}
