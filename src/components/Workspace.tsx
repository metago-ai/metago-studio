import { useState } from 'react'
import {
  GripVertical,
  X,
  ArrowUp,
  ArrowDown,
  Layers,
  HardDrive,
  Trash2,
} from 'lucide-react'
import type { Skill } from '../types'
import { CATEGORY_LABELS, formatBytes, getTotalSize } from '../utils/generators'

interface WorkspaceProps {
  selectedSkills: Skill[]
  onMove: (index: number, direction: 'up' | 'down') => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onRemove: (id: string) => void
  onClear: () => void
}

export function Workspace({
  selectedSkills,
  onMove,
  onReorder,
  onRemove,
  onClear,
}: WorkspaceProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  return (
    <div className="card-base flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border-subtle flex items-center gap-2">
        <Layers className="w-4 h-4 text-accent-teal" />
        <h2 className="text-sm font-semibold text-zinc-100">工作区</h2>
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent-emerald/15 text-accent-emerald text-[10px] font-semibold">
          {selectedSkills.length}
        </span>
        {selectedSkills.length > 0 && (
          <button
            onClick={onClear}
            className="ml-auto inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-accent-rose transition-colors px-2 py-1 rounded hover:bg-bg-hover"
            aria-label="清空工作区"
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden sm:inline">清空</span>
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3">
        {selectedSkills.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-14 h-14 rounded-2xl bg-bg-elevated border border-border-subtle flex items-center justify-center mb-3">
              <Layers className="w-6 h-6 text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-300 font-medium">从左侧选择技能开始组合</p>
            <p className="text-xs text-zinc-600 mt-1.5 max-w-[220px]">
              勾选技能后会显示在此处，可拖拽排序或使用上下箭头调整顺序
            </p>
          </div>
        ) : (
          <ol className="space-y-2">
            {selectedSkills.map((skill, index) => (
              <li
                key={skill.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => { e.preventDefault(); setOverIndex(index) }}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== index) onReorder(dragIndex, index)
                  setDragIndex(null); setOverIndex(null)
                }}
                onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
                className={`group relative bg-bg-elevated/50 hover:bg-bg-elevated border rounded-lg p-3 transition-all animate-slide-up cursor-grab active:cursor-grabbing ${
                  dragIndex === index
                    ? 'opacity-40 border-accent-teal'
                    : overIndex === index && dragIndex !== null
                      ? 'border-accent-teal ring-1 ring-accent-teal/30'
                      : 'border-border-subtle hover:border-border-default'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <GripVertical className="w-3.5 h-3.5 text-zinc-500 group-hover:text-accent-teal transition-colors" />
                    <span className="text-xs font-mono font-semibold text-accent-emerald w-5 h-5 rounded bg-accent-emerald/10 flex items-center justify-center">
                      {index + 1}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-zinc-100">
                        {skill.title}
                      </span>
                      <span
                        className={`badge ${
                          skill.category === 'core'
                            ? 'bg-zinc-700/60 text-zinc-300'
                            : 'bg-accent-amber/15 text-accent-amber'
                        }`}
                      >
                        {CATEGORY_LABELS[skill.category]}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono mt-0.5 truncate">
                      {skill.id}
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">{skill.description}</div>
                  </div>

                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={() => onMove(index, 'up')}
                      disabled={index === 0}
                      className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-accent-emerald hover:bg-bg-hover disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                      aria-label="上移"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onMove(index, 'down')}
                      disabled={index === selectedSkills.length - 1}
                      className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-accent-emerald hover:bg-bg-hover disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                      aria-label="下移"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onRemove(skill.id)}
                      className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-accent-rose hover:bg-bg-hover transition-colors"
                      aria-label="移除"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Footer */}
      {selectedSkills.length > 0 && (
        <div className="p-3 border-t border-border-subtle flex items-center justify-between text-xs">
          <span className="text-zinc-500">共 {selectedSkills.length} 个技能</span>
          <span className="flex items-center gap-1 text-zinc-400">
            <HardDrive className="w-3 h-3" />
            预估 {formatBytes(getTotalSize(selectedSkills))}
          </span>
        </div>
      )}
    </div>
  )
}
