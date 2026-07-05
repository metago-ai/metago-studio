import { useState, useEffect } from 'react'
import { History, Trash2, Search, MessageSquare, Clock } from 'lucide-react'
import { getSessionStore, type ChatSession } from '../../lib/sessionStore'

interface SessionHistoryProps {
  onRestore?: (session: ChatSession) => void
}

/** 会话历史管理面板 */
export function SessionHistory({ onRestore }: SessionHistoryProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const store = getSessionStore()
    const unsub = store.subscribe(s => setSessions(s))
    setSessions(store.getAll())
    return unsub
  }, [])

  const filtered = filter ? sessions.filter(s =>
    s.title.toLowerCase().includes(filter.toLowerCase()) ||
    s.summary?.toLowerCase().includes(filter.toLowerCase())
  ) : sessions

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex-shrink-0 px-2 py-1.5 border-b border-border-subtle bg-bg-deep/50">
        <div className="flex items-center gap-1.5 mb-1">
          <History className="w-3.5 h-3.5 text-accent-blue" />
          <span className="text-[10px] font-medium text-zinc-300">会话历史</span>
          <span className="text-[9px] text-zinc-600">{sessions.length}</span>
          {sessions.length > 0 && (
            <button
              onClick={() => {
                if (confirm('确定清空所有会话历史？')) getSessionStore().clearAll()
              }}
              className="ml-auto p-0.5 text-zinc-500 hover:text-red-400"
              title="清空"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-bg-deep border border-border-subtle">
          <Search className="w-3 h-3 text-zinc-500" />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="搜索会话..."
            className="flex-1 bg-transparent text-[10px] text-zinc-300 focus:outline-none"
          />
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-4 text-[10px] text-zinc-600">
            {sessions.length === 0 ? '暂无历史会话' : '无匹配结果'}
          </div>
        ) : (
          filtered.map(session => (
            <div
              key={session.id}
              className="px-2 py-1.5 border-b border-border-subtle/30 hover:bg-bg-hover group"
            >
              <button
                onClick={() => onRestore?.(session)}
                className="w-full text-left"
              >
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                  <span className="text-[10px] text-zinc-200 truncate flex-1">
                    {session.title}
                  </span>
                </div>
                {session.summary && (
                  <div className="text-[9px] text-zinc-600 mt-0.5 line-clamp-2">
                    {session.summary}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1 text-[8px] text-zinc-700">
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-2 h-2" />
                    {new Date(session.updatedAt).toLocaleString('zh-CN', {
                      month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <span>{session.messageCount} 条消息</span>
                  {session.workspace && (
                    <span className="truncate">{session.workspace}</span>
                  )}
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  getSessionStore().delete(session.id)
                }}
                className="absolute right-2 opacity-0 group-hover:opacity-100 p-0.5 text-zinc-600 hover:text-red-400"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
