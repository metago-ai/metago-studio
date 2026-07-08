/**
 * 任务管理 Store
 *
 * AI Agent 通过 task_create/task_update/task_list 工具管理复杂多步骤任务。
 * 对接 TodoPanel 组件实时展示任务进度。
 */

import { create } from 'zustand'

export type TaskStatus = 'pending' | 'in_progress' | 'completed'

export interface AgentTask {
  id: string
  subject: string
  description?: string
  status: TaskStatus
  createdAt: number
  updatedAt: number
}

interface TaskStoreState {
  tasks: AgentTask[]
  isRunning: boolean

  createTask: (subject: string, description?: string) => string
  updateTask: (id: string, status: TaskStatus) => void
  listTasks: () => AgentTask[]
  clearTasks: () => void
  setRunning: (running: boolean) => void
}

let _idCounter = 0
function genId(): string {
  _idCounter += 1
  return `task-${Date.now()}-${_idCounter}`
}

export const useTaskStore = create<TaskStoreState>((set, get) => ({
  tasks: [],
  isRunning: false,

  createTask: (subject, description) => {
    const id = genId()
    const now = Date.now()
    const task: AgentTask = {
      id,
      subject,
      description,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }
    set((state) => ({ tasks: [...state.tasks, task] }))
    return id
  },

  updateTask: (id, status) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, status, updatedAt: Date.now() } : t
      ),
    }))
  },

  listTasks: () => get().tasks,

  clearTasks: () => set({ tasks: [] }),

  setRunning: (running) => set({ isRunning: running }),
}))
