/**
 * ResizeHandle - 面板之间的可拖拽分隔条
 *
 * 设计参考 Trae IDE / VS Code：
 *   - 默认透明（不抢视觉）
 *   - Hover 时显示蓝色细线
 *   - 拖拽中显示更明显的蓝色
 *   - 光标随方向变化（col-resize / row-resize）
 *
 * 视觉规格：
 *   - 宽度：4px（足够容易点击，又不太抢空间）
 *   - Hover：从透明过渡到 accent-blue/40
 *   - Active：accent-blue/80
 *
 * 用法：
 *   <ResizeHandle orientation="horizontal" onResizeStart={...} />
 */

import type { MouseEvent } from 'react'

export interface ResizeHandleProps {
  /** 拖拽方向：horizontal=竖条（左右拖），vertical=横条（上下拖） */
  orientation: 'horizontal' | 'vertical'
  /** 拖拽开始回调（由 useResizablePanel 提供） */
  onResizeStart: (e: MouseEvent) => void
  /** 是否正在拖拽（用于视觉强化） */
  isDragging?: boolean
}

export function ResizeHandle({ orientation, onResizeStart, isDragging = false }: ResizeHandleProps) {
  const isHorizontal = orientation === 'horizontal'

  return (
    <div
      onMouseDown={onResizeStart}
      onDoubleClick={(e) => e.stopPropagation()}
      className={`relative flex-shrink-0 group transition-colors ${
        isHorizontal
          ? 'w-1 cursor-col-resize hover:bg-accent-blue/40'
          : 'h-1 cursor-row-resize hover:bg-accent-blue/40'
      } ${isDragging ? 'bg-accent-blue/80' : 'bg-transparent'}`}
      // 增加 hit area（让 4px 区域更容易点击）
      style={{
        // 让 hover 区域稍微扩大
        padding: isHorizontal ? '0 2px' : '2px 0',
        margin: isHorizontal ? '0 -2px' : '-2px 0',
      }}
    >
      {/* 内部实际可见的指示线 */}
      <div
        className={`absolute pointer-events-none transition-opacity ${
          isHorizontal ? 'left-1/2 top-0 bottom-0 w-px -translate-x-1/2' : 'top-1/2 left-0 right-0 h-px -translate-y-1/2'
        } ${isDragging ? 'opacity-100 bg-accent-blue' : 'opacity-0 group-hover:opacity-100 bg-accent-blue/60'}`}
      />
    </div>
  )
}
