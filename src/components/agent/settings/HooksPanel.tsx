import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Webhook, X } from 'lucide-react'
import { Section, Field, inputCls, selectCls, PrimaryButton, GhostButton, EmptyState, ToggleRow } from './_shared'
import { getHooks, saveHook, deleteHook, generateId, type HookConfig, type HookEvent } from '../../../lib/settingsStore'

const EVENT_LABELS: Record<HookEvent, string> = {
  on_save: '保存文件时',
  on_commit: 'Git 提交时',
  on_project_open: '打开项目时',
  on_file_create: '创建文件时',
  on_file_delete: '删除文件时',
}

/** HOOKS 钩子配置面板（对标 Trae HOOKS） */
export function HooksPanel() {
  const [hooks, setHooks] = useState<HookConfig[]>([])
  const [editing, setEditing] = useState<HookConfig | null>(null)

  useEffect(() => { setHooks(getHooks()) }, [])
  const refresh = () => setHooks(getHooks())

  const startCreate = () => {
    setEditing({
      id: generateId('hook'),
      event: 'on_save',
      action: 'run_command',
      command: '', aiPrompt: '', pattern: '',
      enabled: true,
    })
  }

  const handleSave = () => {
    if (!editing) return
    if (editing.action === 'run_command' && !editing.command?.trim()) { alert('请填写命令'); return }
    if (editing.action === 'ai_analyze' && !editing.aiPrompt?.trim()) { alert('请填写 AI 提示词'); return }
    saveHook(editing)
    setEditing(null)
    refresh()
  }

  const handleDelete = (id: string) => {
    if (confirm('确认删除此钩子？')) { deleteHook(id); refresh() }
  }

  return (
    <div>
      <Section title="事件钩子" description="在特定事件发生时自动执行命令、触发 AI 分析或发送通知">
        {hooks.length === 0 ? (
          <EmptyState icon={<Webhook className="w-6 h-6" />} title="暂无钩子" description="创建钩子来在文件保存、提交等事件时自动执行操作" />
        ) : (
          <div className="space-y-2">
            {hooks.map(h => (
              <div key={h.id} className="p-3 bg-bg-deep/50 border border-border-subtle rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Webhook className="w-3 h-3 text-purple-400" />
                      <span className="text-xs font-medium text-zinc-200">{EVENT_LABELS[h.event]}</span>
                      <span className={`px-1.5 py-0.5 text-[9px] rounded ${h.enabled ? 'bg-accent-emerald/15 text-accent-emerald' : 'bg-zinc-700 text-zinc-500'}`}>
                        {h.enabled ? '启用' : '禁用'}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      {h.action === 'run_command' && <span>执行命令：<code className="px-1 bg-bg-hover rounded">{h.command}</code></span>}
                      {h.action === 'ai_analyze' && <span>AI 分析：{h.aiPrompt?.slice(0, 40)}...</span>}
                      {h.action === 'notify' && <span>发送通知</span>}
                    </div>
                    {h.pattern && <div className="text-[10px] text-zinc-600 mt-0.5">匹配：<code className="px-1 bg-bg-hover rounded">{h.pattern}</code></div>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setEditing(h)} className="text-zinc-500 hover:text-accent-emerald p-1"><Edit2 className="w-3 h-3" /></button>
                    <button onClick={() => handleDelete(h.id)} className="text-zinc-500 hover:text-red-400 p-1"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <GhostButton onClick={startCreate}><Plus className="w-3 h-3 inline mr-1" />创建钩子</GhostButton>
      </Section>

      {editing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-bg-deep/80">
          <div className="bg-bg-card border border-border-default rounded-xl shadow-2xl w-full max-w-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-zinc-100">{editing.id.startsWith('hook-') ? '创建' : '编辑'}钩子</h4>
              <button onClick={() => setEditing(null)} className="text-zinc-500"><X className="w-4 h-4" /></button>
            </div>
            <Field label="触发事件">
              <select value={editing.event} onChange={e => setEditing({ ...editing, event: e.target.value as HookEvent })} className={selectCls}>
                {Object.entries(EVENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="文件匹配模式（可选）" hint="glob 模式，如 *.ts、src/**/*。留空匹配所有文件">
              <input value={editing.pattern || ''} onChange={e => setEditing({ ...editing, pattern: e.target.value })} placeholder="*.ts" className={`${inputCls} font-mono`} />
            </Field>
            <Field label="执行动作">
              <select value={editing.action} onChange={e => setEditing({ ...editing, action: e.target.value as HookConfig['action'] })} className={selectCls}>
                <option value="run_command">运行命令</option>
                <option value="ai_analyze">AI 分析</option>
                <option value="notify">发送通知</option>
              </select>
            </Field>
            {editing.action === 'run_command' && (
              <Field label="命令" hint="将在项目根目录执行">
                <input value={editing.command || ''} onChange={e => setEditing({ ...editing, command: e.target.value })} placeholder="npm test" className={`${inputCls} font-mono`} />
              </Field>
            )}
            {editing.action === 'ai_analyze' && (
              <Field label="AI 提示词" hint="AI 将分析触发的文件内容">
                <textarea value={editing.aiPrompt || ''} onChange={e => setEditing({ ...editing, aiPrompt: e.target.value })} placeholder="请分析此文件的安全漏洞和性能问题" className={`${inputCls} h-20 resize-none`} />
              </Field>
            )}
            <ToggleRow label="启用" checked={editing.enabled} onChange={v => setEditing({ ...editing, enabled: v })} />
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
