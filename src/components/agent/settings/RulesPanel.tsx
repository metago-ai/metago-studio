import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, FileText, X } from 'lucide-react'
import { Section, Field, inputCls, PrimaryButton, GhostButton, EmptyState } from './_shared'
import {
  loadRulesFromWorkspace, saveRulesToWorkspace, generateId,
  type RulesConfig, type PathRule,
} from '../../../lib/settingsStore'

/** 规则与记忆面板（对标 Trae Rules 设置） */
export function RulesPanel() {
  const [rules, setRules] = useState<RulesConfig>({ userRules: '', projectRules: '', pathRules: [] })
  const [loaded, setLoaded] = useState(false)
  const [editingPathRule, setEditingPathRule] = useState<PathRule | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    loadRulesFromWorkspace().then(r => {
      setRules(r)
      setLoaded(true)
    })
  }, [])

  const saveAll = async () => {
    try {
      await saveRulesToWorkspace(rules)
      setDirty(false)
    } catch (e) {
      alert('保存失败：' + (e as Error).message + '\n\n请先打开工作区（文件夹）后再编辑项目规则')
    }
  }

  const updateUserRules = (v: string) => { setRules(r => ({ ...r, userRules: v })); setDirty(true) }
  const updateProjectRules = (v: string) => { setRules(r => ({ ...r, projectRules: v })); setDirty(true) }

  const addPathRule = () => {
    setEditingPathRule({ id: generateId('rule'), paths: [], content: '', description: '' })
  }

  const savePathRule = () => {
    if (!editingPathRule) return
    setRules(r => {
      const idx = r.pathRules.findIndex(p => p.id === editingPathRule.id)
      const next = [...r.pathRules]
      if (idx >= 0) next[idx] = editingPathRule
      else next.push(editingPathRule)
      return { ...r, pathRules: next }
    })
    setEditingPathRule(null)
    setDirty(true)
  }

  const deletePathRule = (id: string) => {
    setRules(r => ({ ...r, pathRules: r.pathRules.filter(p => p.id !== id) }))
    setDirty(true)
  }

  if (!loaded) return <div className="text-xs text-zinc-500">加载中...</div>

  return (
    <div>
      {dirty && (
        <div className="mb-4 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between">
          <span className="text-[10px] text-amber-400">有未保存的修改</span>
          <PrimaryButton onClick={saveAll}>保存</PrimaryButton>
        </div>
      )}

      <Section title="个人规则" description="定义通用习惯，一次配置全项目生效（保存到 .metago/user_rules.md）">
        <textarea
          value={rules.userRules}
          onChange={e => updateUserRules(e.target.value)}
          placeholder={`# 个人规则示例
- 所有注释用中文
- React 组件必须用函数式写法
- 使用 TypeScript 代替 JavaScript`}
          className={`${inputCls} font-mono h-40 resize-none`}
        />
      </Section>

      <Section title="项目规则" description="针对当前项目的技术栈约束（保存到 .metago/project_rules.md）">
        <textarea
          value={rules.projectRules}
          onChange={e => updateProjectRules(e.target.value)}
          placeholder={`# 项目规则示例
## 技术栈
- 强制使用 Vue3 + TypeScript
- 状态管理使用 Pinia

## 架构规范
- 分层结构：api / components / store / utils
- 所有 API 请求必须包含错误处理`}
          className={`${inputCls} font-mono h-40 resize-none`}
        />
      </Section>

      <Section title="按路径生效的规则" description="只在 AI 处理匹配路径的文件时触发（减少无关噪音）">
        {rules.pathRules.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-6 h-6" />}
            title="暂无路径规则"
            description="点击下方按钮创建按路径生效的规则"
          />
        ) : (
          <div className="space-y-2">
            {rules.pathRules.map(rule => (
              <div key={rule.id} className="p-3 bg-bg-deep/50 border border-border-subtle rounded-lg">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-zinc-200">{rule.description || '未命名规则'}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      {rule.paths.map(p => (
                        <code key={p} className="mr-1 px-1 bg-bg-hover rounded">{p}</code>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setEditingPathRule(rule)} className="text-zinc-500 hover:text-accent-emerald p-1">
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button onClick={() => deletePathRule(rule.id)} className="text-zinc-500 hover:text-red-400 p-1">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <pre className="text-[10px] text-zinc-500 mt-1 max-h-20 overflow-y-auto whitespace-pre-wrap">{rule.content}</pre>
              </div>
            ))}
          </div>
        )}
        <GhostButton onClick={addPathRule}>
          <Plus className="w-3 h-3 inline mr-1" />创建路径规则
        </GhostButton>
      </Section>

      {/* 路径规则编辑弹窗 */}
      {editingPathRule && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-bg-deep/80">
          <div className="bg-bg-card border border-border-default rounded-xl shadow-2xl w-full max-w-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-zinc-100">编辑路径规则</h4>
              <button onClick={() => setEditingPathRule(null)} className="text-zinc-500"><X className="w-4 h-4" /></button>
            </div>
            <Field label="描述">
              <input
                value={editingPathRule.description || ''}
                onChange={e => setEditingPathRule({ ...editingPathRule, description: e.target.value })}
                placeholder="如：API 约定"
                className={inputCls}
              />
            </Field>
            <Field label="路径匹配（逗号分隔）" hint="支持 glob，如 src/server/api/**/*.ts">
              <input
                value={editingPathRule.paths.join(', ')}
                onChange={e => setEditingPathRule({
                  ...editingPathRule,
                  paths: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                })}
                className={inputCls}
              />
            </Field>
            <Field label="规则内容（Markdown）">
              <textarea
                value={editingPathRule.content}
                onChange={e => setEditingPathRule({ ...editingPathRule, content: e.target.value })}
                placeholder={`# API 约定
- 所有 handler 必须做输入校验
- 错误返回统一结构 { data, error }`}
                className={`${inputCls} font-mono h-32 resize-none`}
              />
            </Field>
            <div className="flex gap-2 justify-end">
              <GhostButton onClick={() => setEditingPathRule(null)}>取消</GhostButton>
              <PrimaryButton onClick={savePathRule}>保存规则</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4">
        <PrimaryButton onClick={saveAll}>保存所有规则</PrimaryButton>
      </div>
    </div>
  )
}
