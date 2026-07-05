import { useState, useEffect } from 'react'
import { Wrench, ChevronDown, ChevronRight, Activity, Trash2, FileCode, GitBranch, BrainCircuit } from 'lucide-react'
import { AGENT_TOOLS, type AgentToolMeta } from '../../lib/agent/systemPrompt'
import { getMCPLogStore, type MCPLogEntry } from '../../lib/mcpRegistry'

const CATEGORY_ICON: Record<string, typeof FileCode> = {
  '文件系统': FileCode,
  'Git': GitBranch,
  'MCP 智能工具': BrainCircuit,
}

const CATEGORY_ORDER = ['文件系统', 'Git', 'MCP 智能工具']

/** 按分类分组 */
function groupByCategory(tools: AgentToolMeta[]): Record<string, AgentToolMeta[]> {
  return tools.reduce<Record<string, AgentToolMeta[]>>((acc, tool) => {
    (acc[tool.category] ??= []).push(tool)
    return acc
  }, {})
}

/**
 * MCP/工具面板
 *
 * 展示 AI 可真实调用的工具（文件系统 + Git + 39 个 MCP 智能工具）
 * + 实时调用日志（AI 对话时自动调用，用户无需手动操作）
 *
 * 所有工具都通过 OpenAI function call 协议被 AI 主动调用：
 * - 文件系统/Git 工具 → 直接执行文件/版本操作
 * - MCP 智能工具 → 返回思维协议，AI 在下一轮推理中应用
 */
export function MCPPanel() {
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(['文件系统']))
  const [showLogs, setShowLogs] = useState(false)
  const [logs, setLogs] = useState<MCPLogEntry[]>([])
  const [filter, setFilter] = useState('')

  const grouped = groupByCategory(AGENT_TOOLS)

  useEffect(() => {
    const store = getMCPLogStore()
    const unsub = store.subscribe(l => setLogs([...l]))
    setLogs(store.getAll())
    return unsub
  }, [])

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => {
      const n = new Set(prev)
      if (n.has(cat)) n.delete(cat)
      else n.add(cat)
      return n
    })
  }

  const filteredTools = filter
    ? AGENT_TOOLS.filter(t =>
        t.name.toLowerCase().includes(filter.toLowerCase()) ||
        t.description.toLowerCase().includes(filter.toLowerCase()))
    : AGENT_TOOLS

  const filteredGrouped = filter ? groupByCategory(filteredTools) : grouped

  // 所有工具都可调用（修复：MCP 智能工具也是真实可调用的 function call 工具）
  const callableCount = AGENT_TOOLS.length

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex-shrink-0 px-2 py-1.5 border-b border-border-subtle bg-bg-deep/50">
        <div className="flex items-center gap-1.5 mb-1">
          <Wrench className="w-3.5 h-3.5 text-accent-emerald" />
          <span className="text-[10px] font-medium text-zinc-300">工具 & 调用日志</span>
          <span className="text-[9px] text-zinc-600">{callableCount} 可调用</span>
          <button
            onClick={() => setShowLogs(!showLogs)}
            className={`ml-auto px-1.5 py-0.5 text-[9px] rounded flex items-center gap-1 ${
              showLogs ? 'bg-accent-blue/10 text-accent-blue' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Activity className="w-2.5 h-2.5" />
            日志 {logs.length > 0 && `(${logs.length})`}
          </button>
        </div>
        <div className="text-[9px] text-zinc-600 mb-1.5 px-1 leading-relaxed">
          💡 AI 对话时自动调用这些工具，无需手动点击。<br/>
          所有工具都通过 function call 协议真实调用。
        </div>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="筛选工具..."
          className="w-full px-2 py-0.5 text-[10px] rounded bg-bg-deep border border-border-subtle text-zinc-300 focus:outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {showLogs ? (
          /* 调用日志（实时） */
          <div className="p-1">
            {logs.length === 0 ? (
              <div className="text-center py-8 px-2">
                <Activity className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
                <div className="text-[10px] text-zinc-600 leading-relaxed">
                  暂无调用日志<br/>
                  <span className="text-zinc-700">向 AI 提问后，工具调用会实时显示在此</span>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => getMCPLogStore().clear()}
                  className="flex items-center gap-1 px-2 py-1 text-[9px] text-zinc-500 hover:text-red-400"
                >
                  <Trash2 className="w-2.5 h-2.5" /> 清空日志
                </button>
                {logs.map(log => (
                  <div key={log.id} className="px-2 py-1.5 border-b border-border-subtle/30 hover:bg-bg-hover">
                    <div className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${log.error ? 'bg-red-400' : 'bg-accent-emerald'}`} />
                      <span className="text-[10px] text-zinc-300 font-mono">{log.toolName}</span>
                      {log.duration != null && (
                        <span className="text-[9px] text-zinc-600 ml-auto">{log.duration}ms</span>
                      )}
                    </div>
                    <div className="text-[9px] text-zinc-600 mt-0.5">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                    {log.params && Object.keys(log.params).length > 0 && (
                      <div className="text-[9px] text-zinc-500 mt-0.5 font-mono truncate">
                        {JSON.stringify(log.params)}
                      </div>
                    )}
                    {log.error ? (
                      <div className="text-[9px] text-red-400 mt-0.5">{log.error}</div>
                    ) : log.result ? (
                      <div className="text-[9px] text-zinc-600 mt-0.5 truncate font-mono">
                        {String(log.result).slice(0, 80)}
                      </div>
                    ) : null}
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          /* 工具列表 */
          CATEGORY_ORDER.map(cat => {
            const tools = filteredGrouped[cat]
            if (!tools || tools.length === 0) return null
            const Icon = CATEGORY_ICON[cat] ?? Wrench
            return (
              <div key={cat} className="border-b border-border-subtle/30">
                <button
                  onClick={() => toggleCat(cat)}
                  className="w-full flex items-center gap-1 px-2 py-1 hover:bg-bg-hover"
                >
                  {expandedCats.has(cat) || filter
                    ? <ChevronDown className="w-3 h-3 text-zinc-500" />
                    : <ChevronRight className="w-3 h-3 text-zinc-500" />}
                  <Icon className={`w-3 h-3 ${cat === '文件系统' ? 'text-accent-blue' : cat === 'Git' ? 'text-accent-amber' : 'text-accent-violet'}`} />
                  <span className="text-[10px] font-medium text-zinc-400">{cat}</span>
                  <span className="text-[9px] text-zinc-600">({tools.length})</span>
                </button>
                {(expandedCats.has(cat) || filter) && tools.map(tool => (
                  <div
                    key={tool.name}
                    className="px-3 py-1 hover:bg-bg-hover group"
                    title={tool.description}
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-zinc-300 font-mono truncate group-hover:text-accent-emerald">
                        {tool.name}
                      </span>
                      <span className="text-[8px] px-1 rounded bg-accent-emerald/10 text-accent-emerald flex-shrink-0">
                        可调用
                      </span>
                    </div>
                    <div className="text-[9px] text-zinc-600 truncate">
                      {tool.description}
                    </div>
                  </div>
                ))}
              </div>
            )
          })
        )}
      </div>

      {/* 底部统计 */}
      <div className="flex-shrink-0 px-2 py-1 border-t border-border-subtle bg-bg-deep/50 text-[9px] text-zinc-600">
        {showLogs
          ? `${logs.length} 条调用记录`
          : `${callableCount} 个工具全部可调用`}
      </div>
    </div>
  )
}
