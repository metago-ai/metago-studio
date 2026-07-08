import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Sparkles, X } from 'lucide-react'
import { Section, Field, inputCls, PrimaryButton, GhostButton, EmptyState } from './_shared'
import { getCustomSkills, saveCustomSkill, deleteCustomSkill, generateId, type CustomSkill } from '../../../lib/settingsStore'

/** 技能与命令管理面板（对标 Trae 技能配置） */
export function SkillsPanel() {
  const [skills, setSkills] = useState<CustomSkill[]>([])
  const [editing, setEditing] = useState<CustomSkill | null>(null)

  useEffect(() => { setSkills(getCustomSkills()) }, [])
  const refresh = () => setSkills(getCustomSkills())

  const startCreate = () => {
    setEditing({
      id: generateId('skill'),
      name: '', description: '', content: '',
      trigger: '', category: '自定义',
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
    })
  }

  const handleSave = () => {
    if (!editing) return
    if (!editing.name.trim() || !editing.content.trim()) { alert('请填写名称和技能内容'); return }
    saveCustomSkill(editing)
    setEditing(null)
    refresh()
  }

  const handleDelete = (id: string) => {
    if (confirm('确认删除此技能？')) { deleteCustomSkill(id); refresh() }
  }

  return (
    <div>
      <Section title="自定义技能" description="创建、编辑和导入技能。技能是一段可被 AI 在特定场景下调用的指令模板">
        {skills.length === 0 ? (
          <EmptyState icon={<Sparkles className="w-6 h-6" />} title="暂无自定义技能" description="创建技能来定义 AI 在特定场景下的行为" />
        ) : (
          <div className="space-y-2">
            {skills.map(s => (
              <div key={s.id} className="p-3 bg-bg-deep/50 border border-border-subtle rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span className="text-xs font-medium text-zinc-200">{s.name}</span>
                      <span className="px-1.5 py-0.5 text-[9px] rounded bg-purple-500/15 text-purple-400">{s.category}</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{s.description}</div>
                    {s.trigger && <div className="text-[10px] text-zinc-600 mt-1">触发：<code className="px-1 bg-bg-hover rounded">{s.trigger}</code></div>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setEditing(s)} className="text-zinc-500 hover:text-accent-emerald p-1"><Edit2 className="w-3 h-3" /></button>
                    <button onClick={() => handleDelete(s.id)} className="text-zinc-500 hover:text-red-400 p-1"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <GhostButton onClick={startCreate}><Plus className="w-3 h-3 inline mr-1" />创建技能</GhostButton>
      </Section>

      {editing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-bg-deep/80">
          <div className="bg-bg-card border border-border-default rounded-xl shadow-2xl w-full max-w-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-zinc-100">{editing.id.startsWith('skill-') ? '创建' : '编辑'}技能</h4>
              <button onClick={() => setEditing(null)} className="text-zinc-500"><X className="w-4 h-4" /></button>
            </div>
            <Field label="名称 *">
              <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="如：代码审查" className={inputCls} />
            </Field>
            <Field label="描述">
              <input value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} placeholder="一句话描述技能用途" className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="分类">
                <input value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })} placeholder="如：代码质量" className={inputCls} />
              </Field>
              <Field label="触发词" hint="可选，用户输入此词时触发">
                <input value={editing.trigger} onChange={e => setEditing({ ...editing, trigger: e.target.value })} placeholder="/review" className={inputCls} />
              </Field>
            </div>
            <Field label="技能内容（Markdown）" hint="技能的完整指令，AI 触发时注入">
              <textarea
                value={editing.content}
                onChange={e => setEditing({ ...editing, content: e.target.value })}
                placeholder={`# 代码审查技能\n请按以下步骤审查代码：\n1. 检查逻辑正确性\n2. 检查安全漏洞\n3. 检查性能问题`}
                className={`${inputCls} font-mono h-40 resize-none`}
              />
            </Field>
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
