import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Bot, X } from 'lucide-react'
import { Section, Field, inputCls, PrimaryButton, GhostButton, EmptyState } from './_shared'
import { getAgents, saveAgent, deleteAgent, generateId, type CustomAgent } from '../../../lib/settingsStore'
import { AGENT_TOOLS } from '../../../lib/agent/systemPrompt'
import { MCP_TOOLS } from '../../../lib/mcpRegistry'

/** 智能体管理面板（对标 Trae 智能体配置） */
export function AgentsPanel() {
  const [agents, setAgents] = useState<CustomAgent[]>([])
  const [editing, setEditing] = useState<CustomAgent | null>(null)

  useEffect(() => { setAgents(getAgents()) }, [])

  const refresh = () => setAgents(getAgents())

  const startCreate = () => {
    setEditing({
      id: generateId('agent'),
      name: '', description: '', icon: 'Bot',
      systemPrompt: '', enabledTools: [], enabledMCP: [],
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  const handleSave = () => {
    if (!editing) return
    if (!editing.name.trim() || !editing.systemPrompt.trim()) {
      alert('请填写名称和系统提示词')
      return
    }
    saveAgent(editing)
    setEditing(null)
    refresh()
  }

  const handleDelete = (id: string) => {
    if (confirm('确认删除此智能体？')) {
      deleteAgent(id)
      refresh()
    }
  }

  const toggleTool = (toolName: string) => {
    if (!editing) return
    setEditing({
      ...editing,
      enabledTools: editing.enabledTools.includes(toolName)
        ? editing.enabledTools.filter(t => t !== toolName)
        : [...editing.enabledTools, toolName],
    })
  }

  const toggleMCP = (toolName: string) => {
    if (!editing) return
    setEditing({
      ...editing,
      enabledMCP: editing.enabledMCP.includes(toolName)
        ? editing.enabledMCP.filter(t => t !== toolName)
        : [...editing.enabledMCP, toolName],
    })
  }

  return (
    <div>
      <Section title="智能体列表" description="创建、编辑和分享智能体。每个智能体有独立的提示词和工具集">
        {agents.length === 0 ? (
          <EmptyState icon={<Bot className="w-6 h-6" />} title="暂无智能体" description="点击下方按钮创建自定义智能体" />
        ) : (
          <div className="space-y-2">
            {agents.map(agent => (
              <div key={agent.id} className="p-3 bg-bg-deep/50 border border-border-subtle rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-zinc-200">{agent.name}</span>
                      {agent.isBuiltIn && <span className="px-1.5 py-0.5 text-[9px] rounded bg-blue-500/15 text-blue-400">内置</span>}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{agent.description}</div>
                    <div className="text-[10px] text-zinc-600 mt-1">
                      {agent.enabledTools.includes('*') ? '所有工具' : `${agent.enabledTools.length} 个工具`}
                      {' · '}
                      {agent.enabledMCP.includes('*') ? '所有 MCP' : `${agent.enabledMCP.length} 个 MCP`}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {!agent.isBuiltIn && (
                      <>
                        <button onClick={() => setEditing(agent)} className="text-zinc-500 hover:text-accent-emerald p-1"><Edit2 className="w-3 h-3" /></button>
                        <button onClick={() => handleDelete(agent.id)} className="text-zinc-500 hover:text-red-400 p-1"><Trash2 className="w-3 h-3" /></button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <GhostButton onClick={startCreate}><Plus className="w-3 h-3 inline mr-1" />创建智能体</GhostButton>
      </Section>

      {editing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-bg-deep/80">
          <div className="bg-bg-card border border-border-default rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle">
              <h4 className="text-sm font-semibold text-zinc-100">{editing.isBuiltIn ? '查看智能体' : '编辑智能体'}</h4>
              <button onClick={() => setEditing(null)} className="text-zinc-500"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <Field label="名称 *">
                <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="如：前端开发助手" className={inputCls} disabled={editing.isBuiltIn} />
              </Field>
              <Field label="描述">
                <input value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} placeholder="一句话描述智能体的用途" className={inputCls} disabled={editing.isBuiltIn} />
              </Field>
              <Field label="系统提示词 *" hint="定义智能体的行为、能力和限制">
                <textarea
                  value={editing.systemPrompt}
                  onChange={e => setEditing({ ...editing, systemPrompt: e.target.value })}
                  placeholder="你是一个专业的前端开发助手，擅长 React/Vue/TypeScript..."
                  className={`${inputCls} font-mono h-40 resize-none`}
                  disabled={editing.isBuiltIn}
                />
              </Field>
              <Field label="启用的工程工具" hint="选择此智能体可调用的工程工具">
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 border border-border-subtle rounded-lg">
                  {AGENT_TOOLS.map(t => (
                    <button
                      key={t.name}
                      onClick={() => !editing.isBuiltIn && toggleTool(t.name)}
                      disabled={editing.isBuiltIn}
                      className={`px-2 py-0.5 rounded text-[10px] border ${
                        editing.enabledTools.includes(t.name) || editing.enabledTools.includes('*')
                          ? 'bg-accent-emerald/15 text-accent-emerald border-accent-emerald/30'
                          : 'bg-bg-deep text-zinc-500 border-border-subtle'
                      } ${editing.isBuiltIn ? 'cursor-not-allowed opacity-60' : ''}`}
                      title={t.description}
                    >{t.name}</button>
                  ))}
                </div>
              </Field>
              <Field label="启用的 MCP 工具" hint="选择此智能体可调用的元构思维工具">
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 border border-border-subtle rounded-lg">
                  {MCP_TOOLS.map(t => (
                    <button
                      key={t.name}
                      onClick={() => !editing.isBuiltIn && toggleMCP(t.name)}
                      disabled={editing.isBuiltIn}
                      className={`px-2 py-0.5 rounded text-[10px] border ${
                        editing.enabledMCP.includes(t.name) || editing.enabledMCP.includes('*')
                          ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                          : 'bg-bg-deep text-zinc-500 border-border-subtle'
                      } ${editing.isBuiltIn ? 'cursor-not-allowed opacity-60' : ''}`}
                      title={t.description}
                    >{t.name}</button>
                  ))}
                </div>
              </Field>
            </div>
            <div className="flex-shrink-0 px-5 py-3 border-t border-border-subtle flex justify-end gap-2">
              <GhostButton onClick={() => setEditing(null)}>取消</GhostButton>
              {!editing.isBuiltIn && <PrimaryButton onClick={handleSave}>保存</PrimaryButton>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
