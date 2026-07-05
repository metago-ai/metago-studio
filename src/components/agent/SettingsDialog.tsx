import { useState } from 'react'
import { X, Plus, Trash2, Key, Globe, Edit2 } from 'lucide-react'
import {
  loadCustomModels,
  addCustomModel,
  removeCustomModel,
  updateCustomModel,
  generateCustomModelId,
} from '../../lib/modelRegistry'
import type { CustomModel, ModelCapability } from '../../types'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

const ALL_CAPS: ModelCapability[] = ['text', 'image', 'video', 'file', 'code', 'code-review', 'reasoning']

const EMPTY_FORM: Omit<CustomModel, 'id' | 'type'> = {
  name: '',
  category: 'custom',
  provider: 'openai-compatible',
  baseUrl: '',
  apiKey: '',
  modelId: '',
  capabilities: ['text'],
}

/** 模型管理设置弹窗 */
export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const [models, setModels] = useState<CustomModel[]>(() => loadCustomModels())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<CustomModel, 'id' | 'type'>>(EMPTY_FORM)

  if (!open) return null

  const refresh = () => setModels(loadCustomModels())

  const handleSave = () => {
    if (!form.name.trim() || !form.baseUrl.trim() || !form.apiKey.trim() || !form.modelId.trim()) {
      alert('请填写所有必填字段')
      return
    }
    if (editingId) {
      updateCustomModel(editingId, form)
    } else {
      addCustomModel({ ...form, id: generateCustomModelId(), type: 'custom' })
    }
    setEditingId(null)
    setForm(EMPTY_FORM)
    refresh()
  }

  const handleEdit = (m: CustomModel) => {
    setEditingId(m.id)
    setForm({
      name: m.name,
      category: m.category,
      provider: m.provider,
      baseUrl: m.baseUrl,
      apiKey: m.apiKey,
      modelId: m.modelId,
      capabilities: m.capabilities,
    })
  }

  const handleDelete = (id: string) => {
    if (confirm('确认删除此模型？')) {
      removeCustomModel(id)
      refresh()
    }
  }

  const toggleCap = (cap: ModelCapability) => {
    setForm(f => ({
      ...f,
      capabilities: f.capabilities.includes(cap)
        ? f.capabilities.filter(c => c !== cap)
        : [...f.capabilities, cap],
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-deep/80 backdrop-blur-sm">
      <div className="bg-bg-card border border-border-default rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle">
          <h3 className="text-sm font-semibold text-zinc-100">模型管理</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 添加/编辑表单 */}
          <div className="bg-bg-deep/50 border border-border-subtle rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
              {editingId ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {editingId ? '编辑模型' : '添加自定义模型'}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="显示名称 *">
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="如：GPT-4o"
                  className={inputCls}
                />
              </Field>
              <Field label="模型名 *">
                <input
                  value={form.modelId}
                  onChange={e => setForm(f => ({ ...f, modelId: e.target.value }))}
                  placeholder="如：gpt-4o"
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="API 地址 *">
              <div className="relative">
                <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  value={form.baseUrl}
                  onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
                  placeholder="https://api.openai.com/v1"
                  className={`${inputCls} pl-8`}
                />
              </div>
            </Field>

            <Field label="API Key *">
              <div className="relative">
                <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                  placeholder="sk-..."
                  className={`${inputCls} pl-8 font-mono`}
                />
              </div>
            </Field>

            <Field label="API 协议">
              <select
                value={form.provider}
                onChange={e => setForm(f => ({ ...f, provider: e.target.value as CustomModel['provider'] }))}
                className={inputCls}
              >
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
                  >
                    {cap}
                  </button>
                ))}
              </div>
            </Field>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleSave}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30 hover:bg-accent-emerald/25"
              >
                {editingId ? '保存修改' : '添加模型'}
              </button>
              {editingId && (
                <button
                  onClick={() => { setEditingId(null); setForm(EMPTY_FORM) }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:bg-bg-hover"
                >
                  取消
                </button>
              )}
            </div>
          </div>

          {/* 已有模型列表 */}
          <div className="space-y-2">
            <div className="text-[10px] text-zinc-600 uppercase tracking-wider">已添加的自定义模型</div>
            {models.length === 0 ? (
              <div className="text-xs text-zinc-600 py-4 text-center border border-dashed border-border-subtle rounded-lg">
                暂无自定义模型
              </div>
            ) : (
              models.map(m => (
                <div key={m.id} className="flex items-center gap-2 px-3 py-2 bg-bg-deep/50 border border-border-subtle rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-zinc-200 truncate">{m.name}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{m.modelId} · {m.baseUrl}</div>
                  </div>
                  <button
                    onClick={() => handleEdit(m)}
                    className="text-zinc-500 hover:text-accent-emerald p-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="text-zinc-500 hover:text-red-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex-shrink-0 px-5 py-3 border-t border-border-subtle flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-bg-hover text-zinc-200 hover:bg-border-subtle"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls = "w-full px-2.5 py-1.5 bg-bg-deep border border-border-subtle rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent-emerald/50"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] text-zinc-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
