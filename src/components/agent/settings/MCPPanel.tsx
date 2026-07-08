import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Network, X, Terminal, Globe } from 'lucide-react'
import { Section, Field, inputCls, PrimaryButton, GhostButton, EmptyState, ToggleRow } from './_shared'
import { getMCPServers, saveMCPServer, deleteMCPServer, generateId, type MCPServerConfig } from '../../../lib/settingsStore'

/** MCP Server 管理面板（对标 Trae MCP 配置） */
export function MCPPanel() {
  const [servers, setServers] = useState<MCPServerConfig[]>([])
  const [editing, setEditing] = useState<MCPServerConfig | null>(null)

  useEffect(() => { setServers(getMCPServers()) }, [])
  const refresh = () => setServers(getMCPServers())

  const startCreate = () => {
    setEditing({
      id: generateId('mcp'),
      name: '', type: 'stdio',
      command: [], url: '', env: {},
      enabled: true, autoRun: false,
      createdAt: new Date().toISOString(),
    })
  }

  const handleSave = () => {
    if (!editing) return
    if (!editing.name.trim()) { alert('请填写名称'); return }
    if (editing.type === 'stdio' && (!editing.command || editing.command.length === 0)) { alert('请填写启动命令'); return }
    if (editing.type === 'sse' && !editing.url?.trim()) { alert('请填写 SSE URL'); return }
    saveMCPServer(editing)
    setEditing(null)
    refresh()
  }

  const handleDelete = (id: string) => {
    if (confirm('确认删除此 MCP Server？')) { deleteMCPServer(id); refresh() }
  }

  const toggleEnabled = (server: MCPServerConfig) => {
    saveMCPServer({ ...server, enabled: !server.enabled })
    refresh()
  }

  return (
    <div>
      <Section title="MCP Server" description="添加、编辑、启用/禁用、删除 MCP Server，以及查看日志">
        {servers.length === 0 ? (
          <EmptyState icon={<Network className="w-6 h-6" />} title="暂无 MCP Server" description="添加 stdio 或 SSE 类型的 MCP Server 来扩展智能体能力" />
        ) : (
          <div className="space-y-2">
            {servers.map(s => (
              <div key={s.id} className="p-3 bg-bg-deep/50 border border-border-subtle rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {s.type === 'stdio' ? <Terminal className="w-3 h-3 text-zinc-500" /> : <Globe className="w-3 h-3 text-zinc-500" />}
                      <span className="text-xs font-medium text-zinc-200">{s.name}</span>
                      <span className={`px-1.5 py-0.5 text-[9px] rounded ${s.enabled ? 'bg-accent-emerald/15 text-accent-emerald' : 'bg-zinc-700 text-zinc-500'}`}>
                        {s.enabled ? '已启用' : '已禁用'}
                      </span>
                      {s.autoRun && <span className="px-1.5 py-0.5 text-[9px] rounded bg-blue-500/15 text-blue-400">自动运行</span>}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5 truncate">
                      {s.type === 'stdio' ? (s.command?.join(' ') || '') : (s.url || '')}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => toggleEnabled(s)} className="text-zinc-500 hover:text-accent-emerald p-1" title={s.enabled ? '禁用' : '启用'}>
                      <div className={`w-2 h-2 rounded-full ${s.enabled ? 'bg-accent-emerald' : 'bg-zinc-600'}`} />
                    </button>
                    <button onClick={() => setEditing(s)} className="text-zinc-500 hover:text-accent-emerald p-1"><Edit2 className="w-3 h-3" /></button>
                    <button onClick={() => handleDelete(s.id)} className="text-zinc-500 hover:text-red-400 p-1"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <GhostButton onClick={startCreate}><Plus className="w-3 h-3 inline mr-1" />添加 MCP Server</GhostButton>
      </Section>

      {editing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-bg-deep/80">
          <div className="bg-bg-card border border-border-default rounded-xl shadow-2xl w-full max-w-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-zinc-100">{editing.id.startsWith('mcp-') ? '添加' : '编辑'} MCP Server</h4>
              <button onClick={() => setEditing(null)} className="text-zinc-500"><X className="w-4 h-4" /></button>
            </div>
            <Field label="名称 *">
              <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="如：supabase_local" className={inputCls} />
            </Field>
            <Field label="类型">
              <select value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value as 'stdio' | 'sse' })} className={inputCls}>
                <option value="stdio">Stdio（本地进程）</option>
                <option value="sse">SSE（远程服务）</option>
              </select>
            </Field>
            {editing.type === 'stdio' ? (
              <Field label="启动命令" hint="如：supabase mcp（空格分隔）">
                <input
                  value={(editing.command || []).join(' ')}
                  onChange={e => setEditing({ ...editing, command: e.target.value.split(' ').filter(Boolean) })}
                  placeholder="supabase mcp"
                  className={`${inputCls} font-mono`}
                />
              </Field>
            ) : (
              <Field label="SSE URL" hint="如：https://agent.example.com/mcp">
                <input value={editing.url || ''} onChange={e => setEditing({ ...editing, url: e.target.value })} placeholder="https://..." className={`${inputCls} font-mono`} />
              </Field>
            )}
            <Field label="环境变量（JSON）" hint='如：{"API_KEY": "sk-..."}'>
              <textarea
                value={JSON.stringify(editing.env || {}, null, 2)}
                onChange={e => { try { setEditing({ ...editing, env: JSON.parse(e.target.value) }) } catch { /* 忽略解析错误 */ } }}
                className={`${inputCls} font-mono h-20 resize-none`}
              />
            </Field>
            <ToggleRow label="启用" checked={editing.enabled} onChange={v => setEditing({ ...editing, enabled: v })} />
            <ToggleRow label="自动运行" description="使用智能体时自动运行此 MCP Server" checked={editing.autoRun} onChange={v => setEditing({ ...editing, autoRun: v })} />
            <div className="flex gap-2 justify-end">
              <GhostButton onClick={() => setEditing(null)}>取消</GhostButton>
              <PrimaryButton onClick={handleSave}>保存</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
