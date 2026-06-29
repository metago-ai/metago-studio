import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Plus, FileText, Trash2, Edit3, X, Save, Eye, EyeOff } from 'lucide-react'
import { useStore } from '../store/useStore'

export function PrivateSkillsPage() {
  const { privateSkills, features, addPrivateSkillAction, updatePrivateSkillAction, removePrivateSkillAction } = useStore()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)

  // 表单状态
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [password, setPassword] = useState('')
  const [tags, setTags] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const isLocked = !features.privateSkillLibrary

  const resetForm = () => {
    setName('')
    setDescription('')
    setContent('')
    setPassword('')
    setTags('')
    setEditingId(null)
  }

  const handleSave = () => {
    if (!name.trim() || !content.trim() || !password.trim()) {
      setMessage({ type: 'error', text: '请填写名称、内容和加密口令' })
      return
    }
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)
    if (editingId) {
      const result = updatePrivateSkillAction(editingId, content, password)
      setMessage({ type: result.success ? 'success' : 'error', text: result.message })
    } else {
      const result = addPrivateSkillAction(name, description, content, password, tagList)
      setMessage({ type: result.success ? 'success' : 'error', text: result.message })
    }
    if (message?.type === 'success' || true) {
      setTimeout(() => {
        setShowAddModal(false)
        resetForm()
        setMessage(null)
      }, 1200)
    }
  }

  const handleEdit = (id: string) => {
    const skill = privateSkills.find(s => s.id === id)
    if (!skill) return
    setEditingId(id)
    setName(skill.name)
    setDescription(skill.description)
    setContent(skill.content)
    setTags(skill.tags.join(', '))
    setPassword('')
    setShowAddModal(true)
    setMessage(null)
  }

  const handleDelete = (id: string) => {
    if (confirm('确定删除此私有技能？此操作不可撤销。')) {
      removePrivateSkillAction(id)
    }
  }

  // Pro 未激活时显示锁定状态
  if (isLocked) {
    return (
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card-base p-12 text-center"
        >
          <Lock className="w-12 h-12 text-accent-amber mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">Pro 功能</h2>
          <p className="text-sm text-zinc-400 mb-6">
            私有技能库需要 Pro 授权。
            <br />
            端到端加密（零知识架构），服务器无法解密您的私有技能。
          </p>
          <a href="#/pro" className="btn-primary inline-flex">
            升级到 Pro
          </a>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* 头部 */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5 text-accent-emerald" />
          <div>
            <h1 className="text-xl font-bold text-zinc-100">私有技能库</h1>
            <p className="text-xs text-zinc-500">端到端加密 · 零知识架构 · 服务器无法解密</p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setShowAddModal(true); setMessage(null) }}
          className="btn-primary text-sm"
        >
          <Plus className="w-4 h-4" />
          添加技能
        </button>
      </motion.div>

      {/* 统计 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card-base p-3 text-center">
          <div className="text-2xl font-bold text-accent-emerald">{privateSkills.length}</div>
          <div className="text-xs text-zinc-500">已存储</div>
        </div>
        <div className="card-base p-3 text-center">
          <div className="text-2xl font-bold text-accent-teal">{100 - privateSkills.length}</div>
          <div className="text-xs text-zinc-500">剩余配额</div>
        </div>
        <div className="card-base p-3 text-center">
          <div className="text-2xl font-bold text-accent-amber">AES-GCM</div>
          <div className="text-xs text-zinc-500">加密算法</div>
        </div>
      </div>

      {/* 技能列表 */}
      {privateSkills.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card-base p-12 text-center"
        >
          <FileText className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-400 mb-1">还没有私有技能</p>
          <p className="text-xs text-zinc-500">添加您的第一个私有技能，例如"团队代码风格"或"个人写作模板"</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {privateSkills.map(skill => (
            <motion.div
              key={skill.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-base p-4 hover:border-accent-emerald/40 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-accent-emerald flex-shrink-0" />
                    <h3 className="text-sm font-medium text-zinc-100 truncate">{skill.name}</h3>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{skill.description || '无描述'}</p>
                </div>
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={() => handleEdit(skill.id)}
                    className="p-1.5 rounded hover:bg-bg-hover text-zinc-400 hover:text-accent-emerald"
                    title="编辑"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewingId(viewingId === skill.id ? null : skill.id)}
                    className="p-1.5 rounded hover:bg-bg-hover text-zinc-400 hover:text-accent-blue"
                    title="查看"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(skill.id)}
                    className="p-1.5 rounded hover:bg-bg-hover text-zinc-400 hover:text-accent-rose"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {skill.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {skill.tags.map(tag => (
                    <span key={tag} className="px-1.5 py-0.5 rounded bg-bg-elevated text-[10px] text-zinc-400">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-3 pt-2 border-t border-border-subtle text-[10px] text-zinc-500">
                <span>v{skill.version} · {skill.history.length} 版本</span>
                <span>{skill.updatedAt.slice(0, 10)}</span>
              </div>

              {/* 查看内容 */}
              <AnimatePresence>
                {viewingId === skill.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <pre className="mt-2 p-2 bg-bg-deep/60 rounded text-[11px] text-zinc-400 max-h-48 overflow-y-auto code-block">
                      {skill.content}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* 添加/编辑模态框 */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-bg-deep/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowAddModal(false); resetForm(); setMessage(null) }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-bg-card border border-border-default rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-4 border-b border-border-subtle">
                <h3 className="text-sm font-semibold text-zinc-100">
                  {editingId ? '编辑私有技能' : '添加私有技能'}
                </h3>
                <button
                  onClick={() => { setShowAddModal(false); resetForm(); setMessage(null) }}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">技能名称 *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="例如：团队 TypeScript 代码风格"
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">描述</label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="简短描述这个技能的用途"
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">SKILL.md 内容 *</label>
                  <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder={`---\nname: my-skill\nversion: 1\n---\n\n# 技能标题\n\n技能内容...`}
                    rows={8}
                    className="input-base font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">标签（逗号分隔）</label>
                  <input
                    type="text"
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                    placeholder="代码, 风格, 团队"
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">加密口令 *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="用于端到端加密的口令（请牢记，无法找回）"
                      className="input-base pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    使用 AES-GCM 256 + PBKDF2 派生密钥加密。口令不会存储，忘记口令将无法解密。
                  </p>
                </div>
                {message && (
                  <div className={`text-xs p-2 rounded ${message.type === 'success' ? 'bg-accent-emerald/10 text-accent-emerald' : 'bg-accent-rose/10 text-accent-rose'}`}>
                    {message.text}
                  </div>
                )}
              </div>
              <div className="flex gap-2 p-4 border-t border-border-subtle">
                <button
                  onClick={() => { setShowAddModal(false); resetForm(); setMessage(null) }}
                  className="btn-ghost flex-1 text-sm"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="btn-primary flex-1 text-sm"
                >
                  <Save className="w-4 h-4" />
                  {editingId ? '更新' : '加密并保存'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
