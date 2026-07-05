/**
 * 会话历史管理
 *
 * 将每次对话会话持久化到 localStorage（或 IndexedDB），
 * 支持搜索、恢复、删除。
 */

import type { ChatMessage } from '../types'

// ============ 类型 ============

export interface ChatSession {
  id: string
  title: string           // 会话标题（首条用户消息前 30 字）
  messages: ChatMessage[]
  workspace?: string      // 关联工作区
  createdAt: string
  updatedAt: string
  messageCount: number
  summary?: string        // AI 摘要（会话结束后生成）
}

// ============ 存储 ============

const STORAGE_KEY = 'metago_chat_sessions_v1'
const MAX_SESSIONS = 50

class SessionStore {
  private sessions: ChatSession[] = []
  private loaded = false
  private listeners = new Set<(sessions: ChatSession[]) => void>()

  private load(): void {
    if (this.loaded) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        this.sessions = JSON.parse(raw)
      }
    } catch { /* 忽略 */ }
    this.loaded = true
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.sessions.slice(0, MAX_SESSIONS)))
    } catch { /* 容量限制，忽略 */ }
  }

  /** 获取所有会话 */
  getAll(): ChatSession[] {
    this.load()
    return [...this.sessions].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }

  /** 创建新会话 */
  create(title: string, workspace?: string): ChatSession {
    this.load()
    const session: ChatSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: title.slice(0, 50),
      messages: [],
      workspace,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0,
    }
    this.sessions.unshift(session)
    if (this.sessions.length > MAX_SESSIONS) {
      this.sessions = this.sessions.slice(0, MAX_SESSIONS)
    }
    this.save()
    this.notify()
    return session
  }

  /** 更新会话消息 */
  updateMessages(id: string, messages: ChatMessage[]): void {
    this.load()
    const session = this.sessions.find(s => s.id === id)
    if (!session) return
    session.messages = messages
    session.messageCount = messages.length
    session.updatedAt = new Date().toISOString()
    // 更新标题（首条用户消息）
    const firstUserMsg = messages.find(m => m.role === 'user')
    if (firstUserMsg && session.title === '新会话') {
      session.title = firstUserMsg.content.slice(0, 50)
    }
    this.save()
    this.notify()
  }

  /** 设置摘要 */
  setSummary(id: string, summary: string): void {
    this.load()
    const session = this.sessions.find(s => s.id === id)
    if (!session) return
    session.summary = summary
    this.save()
    this.notify()
  }

  /** 删除会话 */
  delete(id: string): void {
    this.load()
    this.sessions = this.sessions.filter(s => s.id !== id)
    this.save()
    this.notify()
  }

  /** 清空所有 */
  clearAll(): void {
    this.sessions = []
    this.save()
    this.notify()
  }

  /** 搜索 */
  search(query: string): ChatSession[] {
    this.load()
    const lower = query.toLowerCase()
    return this.sessions.filter(s =>
      s.title.toLowerCase().includes(lower) ||
      s.summary?.toLowerCase().includes(lower) ||
      s.messages.some(m => m.content.toLowerCase().includes(lower))
    )
  }

  /** 订阅变更 */
  subscribe(listener: (sessions: ChatSession[]) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    const snapshot = this.getAll()
    this.listeners.forEach(l => l(snapshot))
  }
}

// ============ 单例 ============

let _instance: SessionStore | null = null

export function getSessionStore(): SessionStore {
  if (!_instance) {
    _instance = new SessionStore()
  }
  return _instance
}
