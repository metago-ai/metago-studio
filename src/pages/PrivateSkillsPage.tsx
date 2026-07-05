import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Plus, FileText, Trash2, Edit3, X, Save, Eye, EyeOff, ShieldCheck, AlertCircle, Crown, Download } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'

/** Free 用户免费配额（先试后买） */
const FREE_SKILL_QUOTA = 3

export function PrivateSkillsPage() {
  const {
    privateSkills,
    tier,
    addPrivateSkillAction,
    updatePrivateSkillAction,
    removePrivateSkillAction,
    decryptViewAction,
  } = useStore()

  const isPro = tier === 'pro' || tier === 'pro_plus' || tier === 'team' || tier === 'enterprise'
  const quota = isPro ? 100 : FREE_SKILL_QUOTA
  const isQuotaFull = privateSkills.length >= quota
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // 解密查看状态
  const [viewingSkill, setViewingSkill] = useState<{ id: string; name: string } | null>(null)
  const [viewPassword, setViewPassword] = useState('')
  const [viewShowPassword, setViewShowPassword] = useState(false)
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null)
  const [viewMessage, setViewMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isDecrypting, setIsDecrypting] = useState(false)

  // 已解密的技能内容缓存（会话级，供卡片"导出 SKILL.md"使用）
  const [decryptedSkills, setDecryptedSkills] = useState<Record<string, string>>({})

  // 表单状态
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [password, setPassword] = useState('')
  const [tags, setTags] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const resetForm = () => {
    setName('')
    setDescription('')
    setContent('')
    setPassword('')
    setTags('')
    setEditingId(null)
  }

  const resetView = () => {
    setViewingSkill(null)
    setViewPassword('')
    setViewShowPassword(false)
    setDecryptedContent(null)
    setViewMessage(null)
    setIsDecrypting(false)
  }

  const handleSave = () => {
    if (!name.trim() || !content.trim() || !password.trim()) {
      setMessage({ type: 'error', text: '请填写名称、内容和加密口令' })
      return
    }
    if (!editingId && privateSkills.length >= quota) {
      setMessage({
        type: 'error',
        text: !isPro
          ? `已达免费配额上限（${quota} 个），升级 Pro 解锁 100 个配额`
          : `已达配额上限（${quota} 个），请删除旧技能后再添加`,
      })
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
    setTimeout(() => {
      setShowAddModal(false)
      resetForm()
      setMessage(null)
    }, 1200)
  }

  const handleEdit = (id: string) => {
    const skill = privateSkills.find(s => s.id === id)
    if (!skill) return
    // 编辑时清空原内容（要求用户重新输入，因为明文已被加密清除）
    setEditingId(id)
    setName(skill.name)
    setDescription(skill.description)
    setContent('')
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

  // 解密查看
  const handleView = (id: string) => {
    const skill = privateSkills.find(s => s.id === id)
    if (!skill) return
    resetView()
    setViewingSkill({ id, name: skill.name })
  }

  const handleDecrypt = async () => {
    if (!viewingSkill || !viewPassword.trim()) {
      setViewMessage({ type: 'error', text: '请输入加密口令' })
      return
    }
    setIsDecrypting(true)
    setViewMessage(null)
    try {
      const result = await decryptViewAction(viewingSkill.id, viewPassword)
      if (result.success && result.content) {
        setDecryptedContent(result.content)
        // 缓存解密内容，供卡片导出使用（会话级）
        setDecryptedSkills(prev => ({ ...prev, [viewingSkill.id]: result.content! }))
        setViewMessage({ type: 'success', text: '解密成功' })
      } else {
        setViewMessage({ type: 'error', text: result.message })
      }
    } catch {
      setViewMessage({ type: 'error', text: '解密失败：口令错误或数据损坏' })
    } finally {
      setIsDecrypting(false)
    }
  }

  // 导出 SKILL.md（需先解密）
  const handleExportSKILLMD = (id: string) => {
    const skill = privateSkills.find(s => s.id === id)
    if (!skill) return
    const content = decryptedSkills[id]
    if (!content) {
      alert('请先解密查看该技能后，再进行导出')
      return
    }
    // 组装标准 SKILL.md（YAML frontmatter + 解密内容）
    const tagsLine = skill.tags.length > 0 ? `[${skill.tags.join(', ')}]` : '[]'
    const skillMD = `---\nname: ${skill.name}\ndescription: ${skill.description || ''}\ntags: ${tagsLine}\n---\n\n${content}`
    const blob = new Blob([skillMD], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${skill.name || 'skill'}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
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
        {isQuotaFull && !isPro ? (
          <Link
            to="/pro"
            className="btn-primary text-sm"
          >
            <Crown className="w-4 h-4" />
            升级解锁更多配额
          </Link>
        ) : (
          <button
            onClick={() => { resetForm(); setShowAddModal(true); setMessage(null) }}
            className="btn-primary text-sm"
            disabled={isQuotaFull}
          >
            <Plus className="w-4 h-4" />
            添加技能
          </button>
        )}
      </motion.div>

      {/* 说明条 — 解释加密机制（回应用户疑问）*/}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="card-base p-3 flex items-start gap-2 text-xs text-zinc-400"
      >
        <ShieldCheck className="w-4 h-4 text-accent-emerald flex-shrink-0 mt-0.5" />
        <div>
          <span className="text-zinc-300 font-medium">加密机制说明：</span>
          保存时使用 AES-GCM 256 + PBKDF2 加密内容，<span className="text-accent-amber">明文会立即从存储中清除</span>。
          查看时必须输入当初设置的口令才能解密。口令不会存储，<span className="text-accent-rose">忘记口令将无法找回内容</span>。
        </div>
      </motion.div>

      {/* 统计 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card-base p-3 text-center">
          <div className="text-2xl font-bold text-accent-emerald">{privateSkills.length}</div>
          <div className="text-xs text-zinc-500">已存储</div>
        </div>
        <div className={`card-base p-3 text-center ${!isPro && isQuotaFull ? 'border-accent-amber/40' : ''}`}>
          <div className={`text-2xl font-bold ${!isPro && isQuotaFull ? 'text-accent-amber' : 'text-accent-teal'}`}>
            {quota - privateSkills.length}
          </div>
          <div className="text-xs text-zinc-500">
            剩余配额{!isPro && <span className="text-accent-amber">（免费 {FREE_SKILL_QUOTA}）</span>}
          </div>
        </div>
        <div className="card-base p-3 text-center">
          <div className="text-2xl font-bold text-accent-amber">AES-GCM</div>
          <div className="text-xs text-zinc-500">加密算法</div>
        </div>
      </div>

      {/* Free 用户配额提示 */}
      {!isPro && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`card-base p-3 flex items-start gap-2 text-xs ${isQuotaFull ? 'border-accent-amber/40' : ''}`}
        >
          <Crown className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isQuotaFull ? 'text-accent-amber' : 'text-zinc-500'}`} />
          <div className="flex-1">
            {isQuotaFull ? (
              <span className="text-zinc-300">
                已用完免费配额（{FREE_SKILL_QUOTA} 个）。
                <Link to="/pro" className="text-accent-emerald hover:underline ml-1">升级 Pro</Link>
                解锁 100 个加密配额。
              </span>
            ) : (
              <span className="text-zinc-400">
                免费版可存储 {FREE_SKILL_QUOTA} 个私有技能，已用 {privateSkills.length}/{FREE_SKILL_QUOTA}。
                <Link to="/pro" className="text-accent-emerald hover:underline ml-1">升级 Pro</Link>
                解锁 100 个配额。
              </span>
            )}
          </div>
        </motion.div>
      )}

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
          {privateSkills.map(skill => {
            const isEncrypted = !!skill.encryptedContent
            return (
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
                      {isEncrypted ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-emerald/10 text-accent-emerald flex items-center gap-0.5">
                          <ShieldCheck className="w-2.5 h-2.5" />
                          已加密
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-amber/10 text-accent-amber">
                          加密中...
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{skill.description || '无描述'}</p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => handleEdit(skill.id)}
                      className="p-1.5 rounded hover:bg-bg-hover text-zinc-400 hover:text-accent-emerald"
                      title="编辑（需重新输入内容和口令）"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleView(skill.id)}
                      className="p-1.5 rounded hover:bg-bg-hover text-zinc-400 hover:text-accent-blue"
                      title="解密查看"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleExportSKILLMD(skill.id)}
                      className="p-1.5 rounded hover:bg-bg-hover text-zinc-400 hover:text-accent-emerald"
                      title="导出 SKILL.md（需先解密）"
                    >
                      <Download className="w-3.5 h-3.5" />
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
              </motion.div>
            )
          })}
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
                  <label className="text-xs text-zinc-500 mb-1 block">
                    SKILL.md 内容 {editingId && '*（重新输入，原内容已加密）'}
                  </label>
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
                  <label className="text-xs text-zinc-500 mb-1 block">
                    加密口令 {editingId && '*（重新输入）'}
                  </label>
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

      {/* 解密查看模态框 */}
      <AnimatePresence>
        {viewingSkill && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-bg-deep/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={resetView}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-bg-card border border-border-default rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-4 border-b border-border-subtle">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-accent-emerald" />
                  解密查看：{viewingSkill.name}
                </h3>
                <button onClick={resetView} className="text-zinc-400 hover:text-zinc-200">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3">
                {/* 输入口令区 */}
                {decryptedContent === null && (
                  <>
                    <div className="text-xs text-zinc-400 p-3 rounded bg-bg-elevated/50 border border-border-subtle flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-accent-amber flex-shrink-0 mt-0.5" />
                      <span>
                        此技能已加密存储。请输入当初设置的口令以解密查看。口令不会存储，仅本次会话使用。
                      </span>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">加密口令 *</label>
                      <div className="relative">
                        <input
                          type={viewShowPassword ? 'text' : 'password'}
                          value={viewPassword}
                          onChange={e => setViewPassword(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleDecrypt() }}
                          placeholder="输入口令以解密"
                          className="input-base pr-10"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setViewShowPassword(!viewShowPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                        >
                          {viewShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {viewMessage && (
                      <div className={`text-xs p-2 rounded ${viewMessage.type === 'success' ? 'bg-accent-emerald/10 text-accent-emerald' : 'bg-accent-rose/10 text-accent-rose'}`}>
                        {viewMessage.text}
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <button onClick={resetView} className="btn-ghost flex-1 text-sm">
                        取消
                      </button>
                      <button
                        onClick={handleDecrypt}
                        disabled={isDecrypting || !viewPassword.trim()}
                        className="btn-primary flex-1 text-sm disabled:opacity-40"
                      >
                        <Eye className="w-4 h-4" />
                        {isDecrypting ? '解密中...' : '解密查看'}
                      </button>
                    </div>
                  </>
                )}

                {/* 解密后的内容 */}
                {decryptedContent !== null && (
                  <>
                    {viewMessage && (
                      <div className="text-xs p-2 rounded bg-accent-emerald/10 text-accent-emerald flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {viewMessage.text} · 关闭后将重新加密
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">解密后的 SKILL.md 内容</label>
                      <pre className="p-3 bg-bg-deep/60 rounded text-xs text-zinc-300 max-h-[400px] overflow-y-auto code-block whitespace-pre-wrap break-all">
                        {decryptedContent}
                      </pre>
                    </div>
                    <div className="flex justify-end pt-2">
                      <button onClick={resetView} className="btn-ghost text-sm">
                        关闭（重新加密）
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

