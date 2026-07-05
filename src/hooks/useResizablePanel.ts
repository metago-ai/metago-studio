/**
 * useResizablePanel - 可拖拽调整尺寸的面板 hook
 *
 * 设计参考 Trae IDE / VS Code 的面板 resize 行为：
 *   - 拖拽手柄动态修改尺寸
 *   - 最小/最大尺寸约束
 *   - 尺寸持久化到 localStorage
 *   - 折叠/展开状态也持久化
 *
 * 使用方式：
 *   const sidebar = useResizablePanel({
 *     key: 'agent-sidebar',
 *     defaultSize: 240,
 *     minSize: 170,
 *     maxSize: 500,
 *     orientation: 'horizontal', // 拖拽方向：horizontal=左右拖（调整宽度），vertical=上下拖（调整高度）
 *     reverse: false,            // true=向左/向上拖增加尺寸（用于右侧/底部面板）
 *   })
 *
 *   <div style={{ width: sidebar.size }}>...</div>
 *   <ResizeHandle {...sidebar.handleProps} />
 */

import { useState, useEffect, useCallback, useRef } from 'react'

export type PanelOrientation = 'horizontal' | 'vertical'

export interface UseResizablePanelOptions {
  /** localStorage 持久化键名 */
  key: string
  /** 默认尺寸（px） */
  defaultSize: number
  /** 最小尺寸（px） */
  minSize: number
  /** 最大尺寸（px） */
  maxSize: number
  /** 拖拽方向：horizontal=左右（宽度），vertical=上下（高度） */
  orientation: PanelOrientation
  /**
   * 是否反向拖拽：
   *   - false（默认）：右/下方向拖 = 增加尺寸（左侧/顶部面板）
   *   - true：左/上方向拖 = 增加尺寸（右侧/底部面板）
   */
  reverse?: boolean
}

export interface ResizablePanelState {
  /** 当前尺寸（px），折叠时为 0 */
  size: number
  /** 折叠前的尺寸（用于展开时恢复） */
  lastExpandedSize: number
  /** 是否已折叠 */
  collapsed: boolean
  /** 是否正在拖拽 */
  isDragging: boolean
  /** 设置尺寸（带约束） */
  setSize: (size: number) => void
  /** 折叠/展开切换 */
  toggleCollapse: () => void
  /** 直接设置折叠状态 */
  setCollapsed: (collapsed: boolean) => void
  /** 传给 ResizeHandle 的 props */
  handleProps: {
    onResizeStart: (e: React.MouseEvent) => void
    orientation: PanelOrientation
    isDragging: boolean
  }
}

interface StoredLayout {
  size: number
  collapsed: boolean
}

function loadStoredLayout(key: string): StoredLayout | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredLayout
    if (typeof parsed.size !== 'number' || typeof parsed.collapsed !== 'boolean') return null
    return parsed
  } catch {
    return null
  }
}

function saveStoredLayout(key: string, layout: StoredLayout): void {
  try {
    localStorage.setItem(key, JSON.stringify(layout))
  } catch {
    // localStorage 不可用时静默失败
  }
}

export function useResizablePanel(options: UseResizablePanelOptions): ResizablePanelState {
  const { key, defaultSize, minSize, maxSize, orientation, reverse = false } = options

  // 初始化：从 localStorage 加载，否则用默认值
  const [state, setState] = useState<{ size: number; collapsed: boolean }>(() => {
    const stored = loadStoredLayout(key)
    if (stored) {
      return {
        size: stored.collapsed ? 0 : stored.size,
        collapsed: stored.collapsed,
      }
    }
    return { size: defaultSize, collapsed: false }
  })

  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ startPos: number; startSize: number } | null>(null)

  // 持久化
  useEffect(() => {
    saveStoredLayout(key, {
      size: state.collapsed ? (state.size > 0 ? state.size : defaultSize) : state.size,
      collapsed: state.collapsed,
    })
  }, [key, state, defaultSize])

  // 设置尺寸（带约束）
  const setSize = useCallback((newSize: number) => {
    const clamped = Math.max(minSize, Math.min(maxSize, newSize))
    setState({ size: clamped, collapsed: false })
  }, [minSize, maxSize])

  // 折叠/展开切换
  const toggleCollapse = useCallback(() => {
    setState(prev => {
      if (prev.collapsed) {
        // 展开：恢复 lastExpandedSize（如果为 0 则用 defaultSize）
        const restore = prev.size > 0 ? prev.size : defaultSize
        return { size: restore, collapsed: false }
      }
      // 折叠：记录当前尺寸（用于下次展开），size 设为 0
      return { size: prev.size, collapsed: true }
    })
  }, [defaultSize])

  // 直接设置折叠状态
  const setCollapsed = useCallback((collapsed: boolean) => {
    setState(prev => {
      if (collapsed) {
        return { size: prev.size, collapsed: true }
      }
      const restore = prev.size > 0 ? prev.size : defaultSize
      return { size: restore, collapsed: false }
    })
  }, [defaultSize])

  // 拖拽开始
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startPos = orientation === 'horizontal' ? e.clientX : e.clientY
    const startSize = state.collapsed ? defaultSize : state.size
    dragStartRef.current = { startPos, startSize }
    setIsDragging(true)

    // 添加全局监听（避免鼠标移出 handle 就停止）
    const onMove = (ev: MouseEvent) => {
      if (!dragStartRef.current) return
      const currentPos = orientation === 'horizontal' ? ev.clientX : ev.clientY
      const delta = currentPos - dragStartRef.current.startPos
      // reverse=true 时，反向拖拽 = 增加尺寸
      const newSize = reverse
        ? dragStartRef.current.startSize - delta
        : dragStartRef.current.startSize + delta
      const clamped = Math.max(minSize, Math.min(maxSize, newSize))
      setState({ size: clamped, collapsed: false })
    }

    const onUp = () => {
      dragStartRef.current = null
      setIsDragging(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    // 拖拽期间禁止文本选中和设置全局光标
    document.body.style.cursor = orientation === 'horizontal' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }, [orientation, reverse, minSize, maxSize, state.size, state.collapsed, defaultSize])

  // 实际渲染尺寸（折叠时为 0）
  const effectiveSize = state.collapsed ? 0 : state.size
  // 折叠前的最后尺寸（展开时恢复用，state.size 始终保留最后值）
  const lastExpandedSize = state.size || defaultSize

  return {
    size: effectiveSize,
    lastExpandedSize,
    collapsed: state.collapsed,
    isDragging,
    setSize,
    toggleCollapse,
    setCollapsed,
    handleProps: {
      onResizeStart,
      orientation,
      isDragging,
    },
  }
}
