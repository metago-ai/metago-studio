import { useState } from 'react'
import { Plus, Trash2, Edit2, Key, Globe } from 'lucide-react'
import {
  loadCustomModels, addCustomModel, removeCustomModel, updateCustomModel, generateCustomModelId,
} from '../../../lib/modelRegistry'
import type { CustomModel, ModelCapability } from '../../../types'
import { Section, Field, inputCls, PrimaryButton, GhostButton } from './_shared'

const ALL_CAPS: ModelCapability[] = ['text', 'image', 'video', 'file', 'code', 'code-review', 'reasoning']

const EMPTY_FORM: Omit<CustomModel, 'id' | 'type'> = {
  name: '', category: 'custom', provider: 'openai-compatible',
  baseUrl: '', apiKey: '', modelId: '', capabilities: ['text'],
}

/** 模型配置面板（对标 Trae 模型配置） */
export function ModelPanel() {
  const [models, setModels] = useState<CustomModel[]>(() => loadCustomModels())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<CustomModel, 'id' | 'type'>>(EMPTY_FORM)

  const refresh = () => setModels(loadCustomModels())

  const handleSave = () => {
    if (!form.name.trim() || !form.baseUrl.trim() || !form.apiKey.trim() || !form.modelId.trim()) {
      alert('请填写所有必填字段')
      return
    }
    if (editingId) updateCustomModel(editingId, form)
    else addCustomModel({ ...form, id: generateCustomModelId(), type: 'custom' })
    setEditingId(null)
    setForm(EMPTY_FORM)
    refresh()
  }

  const handleEdit = (m: CustomModel) => {
    setEditingId(m.id)
    setForm({ name: m.name, category: m.category, provider: m.provider, baseUrl: m.baseUrl, apiKey: m.apiKey, modelId: m.modelId, capabilities: m.capabilities })
  }

  const toggleCap = (cap: ModelCapability) => {
    setForm(f => ({
      ...f,
      capabilities: f.capabilities.includes(cap) ? f.capabilities.filter(c => c !== cap) : [...f.capabilities, cap],
    }))
  }

  return (
    <div>
      <Section title="自定义模型" description="添加 OpenAI/Anthropic 兼容的自定义模型">
        <div className="bg-bg-deep/50 border border-border-subtle rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
            {editingId ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {editingId ? '编辑模型' : '添加自定义模型'}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="显示名称 *">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="如：GPT-4o" className={inputCls} />
            </Field>
            <Field label="模型名 *">
              <input value={form.modelId} onChange={e => setForm(f => ({ ...f, modelId: e.target.value }))} placeholder="如：gpt-4o" className={inputCls} />
            </Field>
          </div>
          <Field label="API 地址 *">
            <div className="relative">
              <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))} placeholder="https://api.openai.com/v1" className={`${inputCls} pl-8`} />
            </div>
          </Field>
          <Field label="API Key *">
            <div className="relative">
              <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input type="password" value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} placeholder="sk-..." className={`${inputCls} pl-8 font-mono`} />
            </div>
          </Field>
          <Field label="API 协议">
            <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value as CustomModel['provider'] }))} className={inputCls}>
              <option value="openai-compatible">OpenAI 兼容</option>
              <option value="anthropic-compatible">Anthropic 兼容</option>
            </select>
          </Field>
          <Field label="能力标签">
            <div className="flex flex-wrap gap-1.5">
              {ALL_CAPS.map(cap => (
                <button
                  key={cap}
                  onClick={() => toggleCap(cap)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                    form.capabilities.includes(cap)
                      ? 'bg-accent-emerald/15 text-accent-emerald border-accent-emerald/30'
                      : 'bg-bg-deep text-zinc-500 border-border-subtle hover:border-border-default'
                  }`}
                >{cap}</button>
              ))}
            </div>
          </Field>
          <div className="flex items-center gap-2 pt-1">
            <PrimaryButton onClick={handleSave}>{editingId ? '保存修改' : '添加模型'}</PrimaryButton>
            {editingId && <GhostButton onClick={() => { setEditingId(null); setForm(EMPTY_FORM) }}>取消</GhostButton>}
          </div>
        </div>
      </Section>

      <Section title="已添加的自定义模型">
        {models.length === 0 ? (
          <div className="text-xs text-zinc-600 py-4 text-center border border-dashed border-border-subtle rounded-lg">暂无自定义模型</div>
        ) : (
          <div className="space-y-2">
            {models.map(m => (
              <div key={m.id} className="flex items-center gap-2 px-3 py-2 bg-bg-deep/50 border border-border-subtle rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-zinc-200 truncate">{m.name}</div>
                  <div className="text-[10px] text-zinc-500 truncate">{m.modelId} · {m.baseUrl}</div>
                </div>
                <button onClick={() => handleEdit(m)} className="text-zinc-500 hover:text-accent-emerald p-1"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => { if (confirm('确认删除？')) { removeCustomModel(m.id); refresh() } }} className="text-zinc-500 hover:text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
