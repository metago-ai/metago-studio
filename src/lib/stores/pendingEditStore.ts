/**
 * 待确认编辑 Store（Inline Edit 流式 UI 核心）
 *
 * AI 调用 inline_edit 工具时，不直接写文件，而是把改动暂存到此 store。
 * UI 监听 store 弹出 Diff 确认面板，用户 Accept 才执行实际写入。
 *
 * 核心机制：Promise + Resolver
 * - inline_edit 调用时创建 Promise，把 resolver 存到 pending edit
 * - 用户 Accept → resolver 执行实际写入 + 返回成功
 * - 用户 Reject → resolver 返回拒绝
 */

import { create } from 'zustand'

export interface PendingEdit {
  id: string
  /** 文件路径（相对工作区根目录） */
  filePath: string
  /** 原始内容（编辑前） */
  oldContent: string
  /** 修改后内容（编辑后） */
  newContent: string
  /** 要替换的原始字符串（用于展示） */
  oldString: string
  /** 替换后的新字符串（用于展示） */
  newString: string
  /** 是否替换所有匹配 */
  replaceAll: boolean
  /** 创建时间 */
  createdAt: number
  /** Promise resolver（用户操作后调用） */
  resolver: (result: PendingEditResult) => void
}

export interface PendingEditResult {
  accepted: boolean
  message: string
}

interface PendingEditStoreState {
  /** 当前待确认的编辑（一次只展示一个，简化 UI） */
  current: PendingEdit | null
  /** 历史已处理的编辑（用于审计） */
  history: Array<{ id: string; filePath: string; accepted: boolean; timestamp: number }>
  /** 提交一个待确认编辑，返回 Promise（等待用户操作） */
  submit: (edit: Omit<PendingEdit, 'id' | 'createdAt' | 'resolver'>) => Promise<PendingEditResult>
  /** 用户接受编辑（调用 resolver 并清理） */
  accept: () => void
  /** 用户拒绝编辑（调用 resolver 并清理） */
  reject: () => void
  /** 清空当前（用于异常清理） */
  clear: () => void
}

let _idCounter = 0
function genId(): string {
  _idCounter += 1
  return `edit-${Date.now()}-${_idCounter}`
}

export const usePendingEditStore = create<PendingEditStoreState>((set, get) => ({
  current: null,
  history: [],

  submit: (edit) => {
    return new Promise<PendingEditResult>((resolve) => {
      const pendingEdit: PendingEdit = {
        ...edit,
        id: genId(),
        createdAt: Date.now(),
        resolver: resolve,
      }
      set({ current: pendingEdit })
    })
  },

  accept: () => {
    const { current } = get()
    if (!current) return
    current.resolver({ accepted: true, message: `✅ 用户已接受编辑：${current.filePath}` })
    set((state) => ({
      current: null,
      history: [
        ...state.history.slice(-49),
        { id: current.id, filePath: current.filePath, accepted: true, timestamp: Date.now() },
      ],
    }))
  },

  reject: () => {
    const { current } = get()
    if (!current) return
    current.resolver({ accepted: false, message: `❌ 用户拒绝了编辑：${current.filePath}` })
    set((state) => ({
      current: null,
      history: [
        ...state.history.slice(-49),
        { id: current.id, filePath: current.filePath, accepted: false, timestamp: Date.now() },
      ],
    }))
  },

  clear: () => {
    const { current } = get()
    if (current) {
      current.resolver({ accepted: false, message: '编辑被清理（异常）' })
    }
    set({ current: null })
  },
}))
