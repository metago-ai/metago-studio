import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase, Plus, X, Users, CheckCircle2, Circle, Clock,
  TrendingUp, Trash2, Edit3, AlertTriangle, Cpu, User,
} from 'lucide-react'
import {
  listFdeProjects, createFdeProject, updateFdeProject, deleteFdeProject,
  type FdeProject, type FdeTeamMember, type FdeStage,
} from '../lib/cloudFunctions'

const TEAM_ROLES: Array<{ value: FdeTeamMember['role']; label: string; icon: typeof User }> = [
  { value: 'tech_lead', label: '技术负责人', icon: User },
  { value: 'ai_engineer', label: 'AI 工程师', icon: Cpu },
  { value: 'domain_expert', label: '领域专家', icon: User },
  { value: 'ai_agent', label: 'AI Agent', icon: Cpu },
  { value: 'pm', label: '项目经理', icon: User },
]

const STATUS_LABELS: Record<FdeProject['status'], { label: string; color: string }> = {
  active: { label: '进行中', color: 'text-accent-emerald' },
  completed: { label: '已完成', color: 'text-blue-400' },
  paused: { label: '已暂停', color: 'text-yellow-400' },
  cancelled: { label: '已取消', color: 'text-red-400' },
}

const STAGE_STATUS_ICONS = {
  completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  in_progress: <Clock className="w-4 h-4 text-yellow-400" />,
  pending: <Circle className="w-4 h-4 text-zinc-600" />,
}

function formatDate(ts: string | null | undefined): string {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch {
    return '—'
  }
}

function ProjectCard({ project, onClick }: { project: FdeProject; onClick: () => void }) {
  const statusInfo = STATUS_LABELS[project.status] || STATUS_LABELS.active
  const completedStages = project.stages?.filter(s => s.status === 'completed').length || 0
  const totalStages = project.stages?.length || 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onClick={onClick}
      className="card-base p-5 cursor-pointer hover:border-border-default transition-colors group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-zinc-100 truncate group-hover:text-accent-emerald transition-colors">
            {project.projectName}
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">{project.client}</p>
        </div>
        <span className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
      </div>

      <div className="flex items-center gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-600">进度</span>
            <span className="text-xs text-zinc-400">{project.progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${project.progress}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-accent-emerald rounded-full"
            />
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <Users className="w-3.5 h-3.5" />
          {project.team?.length || 0}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {project.stages?.map((stage, idx) => (
          <div
            key={idx}
            className={`flex-1 h-1 rounded-full ${
              stage.status === 'completed' ? 'bg-accent-emerald' :
              stage.status === 'in_progress' ? 'bg-yellow-400' : 'bg-zinc-800'
            }`}
            title={`${stage.name}: ${stage.status}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between mt-3 text-xs text-zinc-600">
        <span>{completedStages}/{totalStages} 阶段完成</span>
        <span>{formatDate(project.createdAt)}</span>
      </div>
    </motion.div>
  )
}

function TeamMemberEditor({
  team,
  onChange,
}: {
  team: FdeTeamMember[]
  onChange: (team: FdeTeamMember[]) => void
}) {
  const [newMember, setNewMember] = useState<FdeTeamMember>({ role: 'tech_lead', name: '' })

  const addMember = () => {
    if (!newMember.name.trim()) return
    onChange([...team, { ...newMember, name: newMember.name.trim() }])
    setNewMember({ role: 'tech_lead', name: '' })
  }

  const removeMember = (idx: number) => {
    onChange(team.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select
          value={newMember.role}
          onChange={e => setNewMember({ ...newMember, role: e.target.value as FdeTeamMember['role'] })}
          className="px-3 py-1.5 rounded-lg bg-bg-elevated border border-border-subtle text-sm text-zinc-200 focus:outline-none focus:border-accent-emerald"
        >
          {TEAM_ROLES.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={newMember.name}
          onChange={e => setNewMember({ ...newMember, name: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && addMember()}
          placeholder="成员名称"
          className="flex-1 px-3 py-1.5 rounded-lg bg-bg-elevated border border-border-subtle text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent-emerald"
        />
        <button
          onClick={addMember}
          className="px-3 py-1.5 rounded-lg bg-accent-emerald/15 text-accent-emerald text-sm border border-accent-emerald/30 hover:bg-accent-emerald/25 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-2">
        {team.map((member, idx) => {
          const roleInfo = TEAM_ROLES.find(r => r.value === member.role)
          const Icon = roleInfo?.icon || User
          return (
            <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg bg-bg-elevated border border-border-subtle">
              <Icon className="w-4 h-4 text-accent-emerald flex-shrink-0" />
              <span className="text-sm text-zinc-200 flex-1">{member.name}</span>
              <span className="text-xs text-zinc-500">{roleInfo?.label || member.role}</span>
              {member.uid && <span className="text-xs text-zinc-600 font-mono">{member.uid.slice(0, 8)}</span>}
              <button
                onClick={() => removeMember(idx)}
                className="text-zinc-600 hover:text-red-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
        {team.length === 0 && (
          <div className="flex items-center gap-2 py-4 text-sm text-zinc-600 justify-center">
            <AlertTriangle className="w-4 h-4" />
            尚未配置团队成员
          </div>
        )}
      </div>
    </div>
  )
}

function StageEditor({
  stages,
  onChange,
}: {
  stages: FdeStage[]
  onChange: (stages: FdeStage[]) => void
}) {
  const cycleStatus = (idx: number) => {
    const newStages = [...stages]
    const current = newStages[idx]
    const nextStatus: FdeStage['status'] =
      current.status === 'pending' ? 'in_progress' :
      current.status === 'in_progress' ? 'completed' : 'pending'
    newStages[idx] = {
      ...current,
      status: nextStatus,
      startDate: nextStatus !== 'pending' ? (current.startDate || new Date().toISOString()) : null,
      endDate: nextStatus === 'completed' ? new Date().toISOString() : null,
    }
    onChange(newStages)
  }

  return (
    <div className="space-y-2">
      {stages.map((stage, idx) => (
        <div
          key={idx}
          className="flex items-center gap-3 p-3 rounded-lg bg-bg-elevated border border-border-subtle cursor-pointer hover:border-border-default transition-colors"
          onClick={() => cycleStatus(idx)}
        >
          {STAGE_STATUS_ICONS[stage.status]}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-zinc-200">{stage.name}</div>
            <div className="text-xs text-zinc-600">
              {stage.startDate ? `开始：${formatDate(stage.startDate)}` : '未开始'}
              {stage.endDate && ` · 完成：${formatDate(stage.endDate)}`}
            </div>
          </div>
          <span className={`text-xs ${
            stage.status === 'completed' ? 'text-green-500' :
            stage.status === 'in_progress' ? 'text-yellow-400' : 'text-zinc-600'
          }`}>
            {stage.status === 'completed' ? '已完成' : stage.status === 'in_progress' ? '进行中' : '待开始'}
          </span>
        </div>
      ))}
    </div>
  )
}

function ProjectDetail({
  project,
  onClose,
  onUpdate,
  onDelete,
}: {
  project: FdeProject
  onClose: () => void
  onUpdate: (updates: Partial<FdeProject>) => Promise<boolean>
  onDelete: () => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    projectName: project.projectName,
    client: project.client,
    clientContact: project.clientContact,
    description: project.description,
    budget: project.budget,
    team: project.team || [],
    stages: project.stages || [],
    status: project.status,
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const ok = await onUpdate(formData)
    setSaving(false)
    if (ok) setEditing(false)
  }

  const handleDelete = async () => {
    if (!confirm(`确认删除项目「${project.projectName}」？此操作不可撤销。`)) return
    await onDelete()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-bg-base border border-border-default rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-border-subtle bg-bg-base">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-accent-emerald" />
            {editing ? '编辑项目' : project.projectName}
          </h2>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-accent-emerald/15 text-accent-emerald text-sm border border-accent-emerald/30 hover:bg-accent-emerald/25 transition-colors disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 border border-border-subtle hover:border-border-default transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  编辑
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  删除
                </button>
              </>
            )}
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">项目名称</label>
              {editing ? (
                <input
                  type="text"
                  value={formData.projectName}
                  onChange={e => setFormData({ ...formData, projectName: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg bg-bg-elevated border border-border-subtle text-sm text-zinc-200 focus:outline-none focus:border-accent-emerald"
                />
              ) : (
                <div className="text-sm text-zinc-200">{project.projectName}</div>
              )}
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">客户</label>
              {editing ? (
                <input
                  type="text"
                  value={formData.client}
                  onChange={e => setFormData({ ...formData, client: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg bg-bg-elevated border border-border-subtle text-sm text-zinc-200 focus:outline-none focus:border-accent-emerald"
                />
              ) : (
                <div className="text-sm text-zinc-200">{project.client}</div>
              )}
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">客户联系方式</label>
              {editing ? (
                <input
                  type="text"
                  value={formData.clientContact}
                  onChange={e => setFormData({ ...formData, clientContact: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg bg-bg-elevated border border-border-subtle text-sm text-zinc-200 focus:outline-none focus:border-accent-emerald"
                />
              ) : (
                <div className="text-sm text-zinc-200">{project.clientContact || '—'}</div>
              )}
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">预算（元）</label>
              {editing ? (
                <input
                  type="number"
                  value={formData.budget}
                  onChange={e => setFormData({ ...formData, budget: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 rounded-lg bg-bg-elevated border border-border-subtle text-sm text-zinc-200 focus:outline-none focus:border-accent-emerald"
                />
              ) : (
                <div className="text-sm text-zinc-200">
                  {project.budget > 0 ? `¥${project.budget.toLocaleString()}` : '—'}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-500 mb-1 block">项目描述</label>
            {editing ? (
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-1.5 rounded-lg bg-bg-elevated border border-border-subtle text-sm text-zinc-200 focus:outline-none focus:border-accent-emerald resize-none"
              />
            ) : (
              <div className="text-sm text-zinc-300 whitespace-pre-wrap">{project.description || '—'}</div>
            )}
          </div>

          {/* 进度总览 */}
          {!editing && (
            <div className="card-base p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-accent-emerald" />
                  项目进度
                </span>
                <span className="text-lg font-bold text-accent-emerald">{project.progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${project.progress}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-accent-emerald rounded-full"
                />
              </div>
            </div>
          )}

          {/* 团队成员 */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-accent-emerald" />
              团队配置（3人+AI）
            </h3>
            {editing ? (
              <TeamMemberEditor
                team={formData.team}
                onChange={team => setFormData({ ...formData, team })}
              />
            ) : (
              <div className="space-y-2">
                {project.team?.map((member, idx) => {
                  const roleInfo = TEAM_ROLES.find(r => r.value === member.role)
                  const Icon = roleInfo?.icon || User
                  return (
                    <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg bg-bg-elevated border border-border-subtle">
                      <Icon className="w-4 h-4 text-accent-emerald flex-shrink-0" />
                      <span className="text-sm text-zinc-200 flex-1">{member.name}</span>
                      <span className="text-xs text-zinc-500">{roleInfo?.label || member.role}</span>
                    </div>
                  )
                })}
                {(!project.team || project.team.length === 0) && (
                  <div className="flex items-center gap-2 py-4 text-sm text-zinc-600 justify-center">
                    <AlertTriangle className="w-4 h-4" />
                    尚未配置团队成员
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 阶段管理 */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent-emerald" />
              部署阶段（点击切换状态）
            </h3>
            {editing ? (
              <StageEditor
                stages={formData.stages}
                onChange={stages => setFormData({ ...formData, stages })}
              />
            ) : (
              <div className="space-y-2">
                {project.stages?.map((stage, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-bg-elevated border border-border-subtle">
                    {STAGE_STATUS_ICONS[stage.status]}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-zinc-200">{stage.name}</div>
                      <div className="text-xs text-zinc-600">
                        {stage.startDate ? `开始：${formatDate(stage.startDate)}` : '未开始'}
                        {stage.endDate && ` · 完成：${formatDate(stage.endDate)}`}
                      </div>
                    </div>
                    <span className={`text-xs ${
                      stage.status === 'completed' ? 'text-green-500' :
                      stage.status === 'in_progress' ? 'text-yellow-400' : 'text-zinc-600'
                    }`}>
                      {stage.status === 'completed' ? '已完成' : stage.status === 'in_progress' ? '进行中' : '待开始'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function CreateProjectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (params: {
    projectName: string
    client: string
    clientContact?: string
    description?: string
    budget?: number
    team?: FdeTeamMember[]
  }) => Promise<boolean>
}) {
  const [form, setForm] = useState({
    projectName: '',
    client: '',
    clientContact: '',
    description: '',
    budget: 0,
  })
  const [team, setTeam] = useState<FdeTeamMember[]>([])
  const [creating, setCreating] = useState(false)

  const handleSubmit = async () => {
    if (!form.projectName.trim() || !form.client.trim()) return
    setCreating(true)
    await onCreate({
      ...form,
      projectName: form.projectName.trim(),
      client: form.client.trim(),
      team,
    })
    setCreating(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-bg-base border border-border-default rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-border-subtle bg-bg-base">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Plus className="w-5 h-5 text-accent-emerald" />
            创建 FDE 项目
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">项目名称 *</label>
              <input
                type="text"
                value={form.projectName}
                onChange={e => setForm({ ...form, projectName: e.target.value })}
                placeholder="例：客户A智能客服系统"
                className="w-full px-3 py-1.5 rounded-lg bg-bg-elevated border border-border-subtle text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent-emerald"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">客户 *</label>
              <input
                type="text"
                value={form.client}
                onChange={e => setForm({ ...form, client: e.target.value })}
                placeholder="例：客户A"
                className="w-full px-3 py-1.5 rounded-lg bg-bg-elevated border border-border-subtle text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent-emerald"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">客户联系方式</label>
              <input
                type="text"
                value={form.clientContact}
                onChange={e => setForm({ ...form, clientContact: e.target.value })}
                placeholder="例：张经理 138xxxx"
                className="w-full px-3 py-1.5 rounded-lg bg-bg-elevated border border-border-subtle text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent-emerald"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">预算（元）</label>
              <input
                type="number"
                value={form.budget}
                onChange={e => setForm({ ...form, budget: Number(e.target.value) })}
                placeholder="0"
                className="w-full px-3 py-1.5 rounded-lg bg-bg-elevated border border-border-subtle text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent-emerald"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">项目描述</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="项目背景、目标、交付物..."
              className="w-full px-3 py-1.5 rounded-lg bg-bg-elevated border border-border-subtle text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent-emerald resize-none"
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-accent-emerald" />
              团队配置（3人+AI）
            </h3>
            <TeamMemberEditor team={team} onChange={setTeam} />
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 p-5 border-t border-border-subtle bg-bg-base">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={creating || !form.projectName.trim() || !form.client.trim()}
            className="px-4 py-1.5 rounded-lg bg-accent-emerald/15 text-accent-emerald text-sm border border-accent-emerald/30 hover:bg-accent-emerald/25 transition-colors disabled:opacity-50"
          >
            {creating ? '创建中...' : '创建项目'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function FdePage() {
  const [projects, setProjects] = useState<FdeProject[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedProject, setSelectedProject] = useState<FdeProject | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')

  const loadProjects = useCallback(async () => {
    setLoading(true)
    const data = await listFdeProjects(filterStatus || undefined)
    setProjects(data)
    setLoading(false)
  }, [filterStatus])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const handleCreate = async (params: {
    projectName: string
    client: string
    clientContact?: string
    description?: string
    budget?: number
    team?: FdeTeamMember[]
  }) => {
    const result = await createFdeProject(params)
    if (result.success) {
      setShowCreate(false)
      await loadProjects()
    } else {
      alert(result.message)
    }
    return result.success
  }

  const handleUpdate = async (updates: Partial<FdeProject>) => {
    if (!selectedProject) return false
    const result = await updateFdeProject(selectedProject._id, updates)
    if (result.success) {
      const updated = { ...selectedProject, ...updates }
      setSelectedProject(updated)
      await loadProjects()
    } else {
      alert(result.message)
    }
    return result.success
  }

  const handleDelete = async () => {
    if (!selectedProject) return false
    const result = await deleteFdeProject(selectedProject._id)
    if (result.success) {
      setSelectedProject(null)
      await loadProjects()
    } else {
      alert(result.message)
    }
    return result.success
  }

  const activeCount = projects.filter(p => p.status === 'active').length
  const completedCount = projects.filter(p => p.status === 'completed').length
  const avgProgress = projects.length > 0
    ? Math.round(projects.reduce((sum, p) => sum + (p.progress || 0), 0) / projects.length)
    : 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 头部 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-accent-emerald" />
            FDE 服务工作台
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            前沿部署工程 · 3人+AI团队嵌入客户现场交付生产级智能软件
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-emerald/15 text-accent-emerald text-sm border border-accent-emerald/30 hover:bg-accent-emerald/25 transition-colors"
        >
          <Plus className="w-4 h-4" />
          创建项目
        </button>
      </motion.div>

      {/* 统计卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="w-4 h-4 text-accent-emerald" />
            <span className="text-xs text-zinc-500">总项目数</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">{projects.length}</div>
        </div>
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-zinc-500">进行中</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">{activeCount}</div>
        </div>
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-xs text-zinc-500">已完成</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">{completedCount}</div>
        </div>
        <div className="card-base p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-zinc-500">平均进度</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">{avgProgress}%</div>
        </div>
      </motion.div>

      {/* 筛选 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-2"
      >
        {['', 'active', 'completed', 'paused', 'cancelled'].map(status => {
          const label = status === '' ? '全部' : STATUS_LABELS[status as FdeProject['status']]?.label || status
          const isActive = filterStatus === status
          return (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              {label}
            </button>
          )
        })}
      </motion.div>

      {/* 项目列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-accent-emerald rounded-full animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card-base p-12 text-center"
        >
          <Briefcase className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-400 mb-2">暂无 FDE 项目</p>
          <p className="text-xs text-zinc-600 mb-4">创建第一个项目，开始 FDE 服务模式</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-emerald/15 text-accent-emerald text-sm border border-accent-emerald/30 hover:bg-accent-emerald/25 transition-colors"
          >
            <Plus className="w-4 h-4" />
            创建项目
          </button>
        </motion.div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <AnimatePresence>
            {projects.map(project => (
              <ProjectCard
                key={project._id}
                project={project}
                onClick={() => setSelectedProject(project)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* 创建弹窗 */}
      <AnimatePresence>
        {showCreate && (
          <CreateProjectModal
            onClose={() => setShowCreate(false)}
            onCreate={handleCreate}
          />
        )}
      </AnimatePresence>

      {/* 详情弹窗 */}
      <AnimatePresence>
        {selectedProject && (
          <ProjectDetail
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
