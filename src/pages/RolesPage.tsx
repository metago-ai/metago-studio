import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Bot, Cpu, Package, Megaphone, Workflow, TrendingUp,
  Scale, Handshake, Headphones,
  Check, ArrowRight, Sparkles, Briefcase,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import {
  DIGITAL_EMPLOYEE_ROLES,
  getRoleById,
  type DigitalEmployeeRole,
} from '../lib/roleConfig'
import { SKILLS } from '../data/skills'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Bot,
  Cpu,
  Package,
  Megaphone,
  Workflow,
  TrendingUp,
  Scale,
  Handshake,
  Headphones,
}

const COLOR_MAP: Record<string, { text: string; bg: string; border: string; gradient: string }> = {
  'accent-blue': {
    text: 'text-accent-blue',
    bg: 'bg-accent-blue/10',
    border: 'border-accent-blue/30',
    gradient: 'from-accent-blue/20 via-bg-card to-bg-card',
  },
  'accent-emerald': {
    text: 'text-accent-emerald',
    bg: 'bg-accent-emerald/10',
    border: 'border-accent-emerald/30',
    gradient: 'from-accent-emerald/20 via-bg-card to-bg-card',
  },
  'accent-teal': {
    text: 'text-accent-teal',
    bg: 'bg-accent-teal/10',
    border: 'border-accent-teal/30',
    gradient: 'from-accent-teal/20 via-bg-card to-bg-card',
  },
  'accent-rose': {
    text: 'text-accent-rose',
    bg: 'bg-accent-rose/10',
    border: 'border-accent-rose/30',
    gradient: 'from-accent-rose/20 via-bg-card to-bg-card',
  },
  'accent-amber': {
    text: 'text-accent-amber',
    bg: 'bg-accent-amber/10',
    border: 'border-accent-amber/30',
    gradient: 'from-accent-amber/20 via-bg-card to-bg-card',
  },
}

function getColorClasses(color: string) {
  return COLOR_MAP[color] ?? COLOR_MAP['accent-blue']
}

export function RolesPage() {
  const navigate = useNavigate()
  const { currentRoleId, setCurrentRole } = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const currentRole = getRoleById(currentRoleId)
  const selectedRole = selectedId ? getRoleById(selectedId) : null

  const handleSelectRole = (roleId: string) => {
    setSelectedId(roleId)
  }

  const handleActivateRole = (roleId: string) => {
    setCurrentRole(roleId)
    setSelectedId(null)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 头部 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-accent-blue" />
            AI 数字员工
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            8 大岗位数字员工 · 选择角色后影响 Agent 工作台的 AI 思考方式
          </p>
        </div>
        <button
          onClick={() => navigate('/agent')}
          className="btn-primary text-xs"
        >
          <Bot className="w-3.5 h-3.5" />
          前往 Agent 工作台
        </button>
      </motion.div>

      {/* 当前激活角色 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={`rounded-2xl border p-5 bg-gradient-to-br ${getColorClasses(currentRole.color).gradient} relative overflow-hidden`}
      >
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-accent-emerald/10 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold text-accent-emerald uppercase tracking-wider flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              当前激活
            </span>
          </div>
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-xl ${getColorClasses(currentRole.color).bg} ${getColorClasses(currentRole.color).border} border flex items-center justify-center flex-shrink-0`}>
              {(() => {
                const Icon = ICON_MAP[currentRole.icon] ?? Bot
                return <Icon className={`w-7 h-7 ${getColorClasses(currentRole.color).text}`} />
              })()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-zinc-100">{currentRole.name}</h2>
                <span className="text-sm text-zinc-400">{currentRole.fullName}</span>
              </div>
              <p className={`text-sm ${getColorClasses(currentRole.color).text} mt-0.5`}>{currentRole.tagline}</p>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{currentRole.description}</p>
              {currentRole.recommendedSkills.length > 0 && (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-zinc-500 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    推荐技能：
                  </span>
                  {currentRole.recommendedSkills.map(sid => {
                    const skill = SKILLS.find(s => s.id === sid)
                    return skill ? (
                      <span key={sid} className="text-xs px-2 py-0.5 rounded bg-bg-elevated/60 text-zinc-300">
                        {skill.title}
                      </span>
                    ) : null
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* 角色网格 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {DIGITAL_EMPLOYEE_ROLES.filter(r => r.id !== 'general').map((role, idx) => {
          const isCurrent = role.id === currentRoleId
          const colorClasses = getColorClasses(role.color)
          const Icon = ICON_MAP[role.icon] ?? Bot
          return (
            <motion.div
              key={role.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + idx * 0.03 }}
              className={`rounded-xl border p-4 transition-all cursor-pointer relative overflow-hidden group ${
                isCurrent
                  ? `${colorClasses.border} ${colorClasses.bg} ring-1 ring-${role.color}/40`
                  : 'border-border-subtle bg-bg-card hover:border-border-default hover:bg-bg-hover'
              }`}
              onClick={() => handleSelectRole(role.id)}
            >
              {isCurrent && (
                <div className="absolute top-2 right-2">
                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-accent-emerald/20 text-accent-emerald font-semibold">
                    <Check className="w-2.5 h-2.5" />
                    已激活
                  </span>
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg ${colorClasses.bg} ${colorClasses.border} border flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${colorClasses.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-bold text-zinc-100">{role.name}</h3>
                  </div>
                  <p className="text-xs text-zinc-500">{role.fullName}</p>
                  <p className={`text-xs ${colorClasses.text} mt-1`}>{role.tagline}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 flex-wrap">
                {role.scenarios.slice(0, 4).map(s => (
                  <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated/50 text-zinc-400">
                    {s}
                  </span>
                ))}
                {role.scenarios.length > 4 && (
                  <span className="text-[10px] text-zinc-500">+{role.scenarios.length - 4}</span>
                )}
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      {/* 角色详情模态框 */}
      <AnimatePresence>
        {selectedRole && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-bg-deep/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedId(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-bg-card border border-border-default rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
            >
              <RoleDetail
                role={selectedRole}
                isCurrent={selectedRole.id === currentRoleId}
                onActivate={() => handleActivateRole(selectedRole.id)}
                onClose={() => setSelectedId(null)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function RoleDetail({
  role,
  isCurrent,
  onActivate,
  onClose,
}: {
  role: DigitalEmployeeRole
  isCurrent: boolean
  onActivate: () => void
  onClose: () => void
}) {
  const colorClasses = getColorClasses(role.color)
  const Icon = ICON_MAP[role.icon] ?? Bot
  return (
    <div>
      {/* 头部 */}
      <div className={`p-5 bg-gradient-to-br ${colorClasses.gradient} border-b border-border-subtle relative overflow-hidden`}>
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-accent-emerald/10 rounded-full blur-2xl" />
        <div className="relative flex items-start gap-4">
          <div className={`w-14 h-14 rounded-xl ${colorClasses.bg} ${colorClasses.border} border flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-7 h-7 ${colorClasses.text}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-zinc-100">{role.name}</h2>
              <span className="text-sm text-zinc-400">{role.fullName}</span>
              {isCurrent && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-emerald/20 text-accent-emerald font-semibold flex items-center gap-1">
                  <Check className="w-2.5 h-2.5" />
                  当前
                </span>
              )}
            </div>
            <p className={`text-sm ${colorClasses.text} mt-1`}>{role.tagline}</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 flex-shrink-0"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 内容 */}
      <div className="p-5 space-y-4">
        {/* 描述 */}
        <div>
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">岗位说明</h3>
          <p className="text-sm text-zinc-300 leading-relaxed">{role.description}</p>
        </div>

        {/* 适配场景 */}
        <div>
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">适配场景</h3>
          <div className="flex flex-wrap gap-2">
            {role.scenarios.map(s => (
              <span key={s} className={`text-xs px-2.5 py-1 rounded-lg ${colorClasses.bg} ${colorClasses.text} border ${colorClasses.border}`}>
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* 推荐技能 */}
        {role.recommendedSkills.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              推荐激活技能
            </h3>
            <div className="space-y-2">
              {role.recommendedSkills.map(sid => {
                const skill = SKILLS.find(s => s.id === sid)
                if (!skill) return null
                return (
                  <div key={sid} className="p-2.5 rounded-lg bg-bg-elevated/50 border border-border-subtle">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-200">{skill.title}</span>
                      <span className="text-[10px] text-zinc-500">{skill.id}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">{skill.description}</p>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              注：技能需在 Agent 工作台 → 技能浏览器中手动激活
            </p>
          </div>
        )}

        {/* 角色指令预览 */}
        {role.systemPromptAppend && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">角色指令预览</h3>
            <pre className="text-xs text-zinc-400 bg-bg-deep/60 p-3 rounded-lg border border-border-subtle whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
              {role.systemPromptAppend}
            </pre>
          </div>
        )}
      </div>

      {/* 底部操作 */}
      <div className="p-4 border-t border-border-subtle flex gap-2">
        <button onClick={onClose} className="btn-ghost flex-1 text-sm">
          取消
        </button>
        <button
          onClick={onActivate}
          disabled={isCurrent}
          className="btn-primary flex-1 text-sm disabled:opacity-50"
        >
          {isCurrent ? (
            <>
              <Check className="w-4 h-4" />
              当前已激活
            </>
          ) : (
            <>
              激活此角色 <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
