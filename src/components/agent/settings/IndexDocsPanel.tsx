import { useState, useEffect } from 'react'
import { Plus, Trash2, BookOpen, Globe, FileText, X } from 'lucide-react'
import { Section, Field, inputCls, PrimaryButton, GhostButton, EmptyState } from './_shared'
import { getIndexDocs, saveIndexDoc, deleteIndexDoc, generateId, type IndexDocEntry } from '../../../lib/settingsStore'

/** 索引与文档面板（对标 Trae #Web / #Doc） */
export function IndexDocsPanel() {
  const [docs, setDocs] = useState<IndexDocEntry[]>([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<Partial<IndexDocEntry>>({ type: 'web', title: '' })

  useEffect(() => { setDocs(getIndexDocs()) }, [])
  const refresh = () => setDocs(getIndexDocs())

  const handleAdd = () => {
    if (!form.title?.trim()) { alert('请填写标题'); return }
    if (form.type === 'web' && !form.url?.trim()) { alert('请填写 URL'); return }
    const doc: IndexDocEntry = {
      id: generateId('doc'),
      type: form.type as 'web' | 'doc' | 'file',
      url: form.url, path: form.path,
      title: form.title,
      content: form.content,
      indexedAt: new Date().toISOString(),
    }
    saveIndexDoc(doc)
    setAdding(false)
    setForm({ type: 'web', title: '' })
    refresh()
  }

  const handleDelete = (id: string) => {
    if (confirm('确认删除此索引？')) { deleteIndexDoc(id); refresh() }
  }

  return (
    <div>
      <Section title="索引与文档" description="为 AI 对话注入网页、文档等外部上下文。对话中可用 #Web、#Doc 引用">
        {docs.length === 0 ? (
          <EmptyState icon={<BookOpen className="w-6 h-6" />} title="暂无索引文档" description="添加网页或文档，AI 对话时可引用作为上下文" />
        ) : (
          <div className="space-y-2">
            {docs.map(d => (
              <div key={d.id} className="flex items-center gap-2 p-3 bg-bg-deep/50 border border-border-subtle rounded-lg">
                {d.type === 'web' ? <Globe className="w-3 h-3 text-blue-400" /> : <FileText className="w-3 h-3 text-zinc-400" />}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-zinc-200 truncate">{d.title}</div>
                  <div className="text-[10px] text-zinc-500 truncate">{d.url || d.path}</div>
                </div>
                <button onClick={() => handleDelete(d.id)} className="text-zinc-500 hover:text-red-400 p-1"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}
        <GhostButton onClick={() => setAdding(true)}><Plus className="w-3 h-3 inline mr-1" />添加索引</GhostButton>
      </Section>

      <Section title="使用方式" description="在 AI 对话输入框中输入 # 可引用已索引的文档">
        <div className="text-[10px] text-zinc-500 space-y-1 p-3 bg-bg-deep/50 rounded-lg border border-border-subtle">
          <div><code className="text-accent-emerald">#Web</code> — 引用网页 URL 作为上下文</div>
          <div><code className="text-accent-emerald">#Doc</code> — 引用已索引的文档</div>
          <div><code className="text-accent-emerald">@</code> — 引用文件或智能体</div>
        </div>
      </Section>

      {adding && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-bg-deep/80">
          <div className="bg-bg-card border border-border-default rounded-xl shadow-2xl w-full max-w-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-zinc-100">添加索引文档</h4>
              <button onClick={() => setAdding(false)} className="text-zinc-500"><X className="w-4 h-4" /></button>
            </div>
            <Field label="类型">
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'web' | 'doc' | 'file' })} className={inputCls}>
                <option value="web">网页（#Web）</option>
                <option value="doc">文档（#Doc）</option>
                <option value="file">本地文件</option>
              </select>
            </Field>
            <Field label="标题 *">
              <input value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="如：React 官方文档" className={inputCls} />
            </Field>
            {form.type === 'web' && (
              <Field label="URL *">
                <input value={form.url || ''} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://react.dev" className={`${inputCls} font-mono`} />
              </Field>
            )}
            {form.type !== 'web' && (
              <Field label="文件路径 *">
                <input value={form.path || ''} onChange={e => setForm({ ...form, path: e.target.value })} placeholder="/docs/api.md" className={`${inputCls} font-mono`} />
              </Field>
            )}
            <Field label="内容（可选）" hint="可手动粘贴文档内容，或留空由系统自动抓取">
              <textarea value={form.content || ''} onChange={e => setForm({ ...form, content: e.target.value })} className={`${inputCls} h-24 resize-none`} />
            </Field>
            <div className="flex gap-2 justify-end">
              <GhostButton onClick={() => setAdding(false)}>取消</GhostButton>
              <PrimaryButton onClick={handleAdd}>添加</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
