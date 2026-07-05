import { useState, useMemo } from 'react'
import { Zap, ChevronDown, ChevronRight, Search, Sparkles, CheckSquare, Square } from 'lucide-react'
import { SKILLS, groupSkillsByFamily, FAMILY_ICONS, type Skill } from '../../lib/skillRegistry'

interface SkillBrowserProps {
  onActivateSkill?: (skill: Skill) => void
  onActiveSkillsChange?: (skillIds: string[]) => void
}

/** 技能浏览器面板 —— 支持三档激活（单个 / 族级 / 全局） */
export function SkillBrowser({ onActivateSkill, onActiveSkillsChange }: SkillBrowserProps) {
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set(['Dev Kit', '认知族']))
  const [filter, setFilter] = useState('')
  /** 已激活技能集合（支持多选） */
  const [activeSkills, setActiveSkills] = useState<Set<string>>(new Set())

  const grouped = groupSkillsByFamily(SKILLS)

  const filteredSkills = filter
    ? SKILLS.filter(s =>
        s.name.toLowerCase().includes(filter.toLowerCase()) ||
        s.id.toLowerCase().includes(filter.toLowerCase()) ||
        s.description.toLowerCase().includes(filter.toLowerCase()))
    : SKILLS

  const filteredGrouped = useMemo(() => {
    if (!filter) return grouped
    return Object.entries(groupSkillsByFamily(filteredSkills)).reduce<Record<string, Skill[]>>((acc, [k, v]) => {
      if (v.length > 0) acc[k] = v
      return acc
    }, {})
  }, [filter, grouped])

  const toggleFamily = (family: string) => {
    setExpandedFamilies(prev => {
      const n = new Set(prev)
      if (n.has(family)) n.delete(family)
      else n.add(family)
      return n
    })
  }

  /** 通知外部激活技能集合变化 */
  const notifyChange = (next: Set<string>) => {
    onActiveSkillsChange?.(Array.from(next))
  }

  /** 单个技能切换激活 */
  const toggleSkill = (skill: Skill) => {
    setActiveSkills(prev => {
      const next = new Set(prev)
      if (next.has(skill.id)) {
        next.delete(skill.id)
      } else {
        next.add(skill.id)
        onActivateSkill?.(skill)
      }
      notifyChange(next)
      return next
    })
  }

  /** 族级一键：全选/全不选此族 */
  const toggleFamilyAll = (_family: string, skills: Skill[]) => {
    setActiveSkills(prev => {
      const next = new Set(prev)
      const allActive = skills.every(s => next.has(s.id))
      if (allActive) {
        skills.forEach(s => next.delete(s.id))
      } else {
        skills.forEach(s => {
          next.add(s.id)
        })
      }
      notifyChange(next)
      return next
    })
  }

  /** 全局一键：全选/全不选所有技能 */
  const toggleAll = () => {
    setActiveSkills(prev => {
      const next: Set<string> = prev.size === SKILLS.length ? new Set() : new Set(SKILLS.map(s => s.id))
      notifyChange(next)
      return next
    })
  }

  const allActive = activeSkills.size === SKILLS.length
  const partialActive = activeSkills.size > 0 && !allActive

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex-shrink-0 px-2 py-1.5 border-b border-border-subtle bg-bg-deep/50">
        <div className="flex items-center gap-1.5 mb-1">
          <Zap className="w-3.5 h-3.5 text-accent-amber" />
          <span className="text-[10px] font-medium text-zinc-300">技能浏览器</span>
          <span className="text-[9px] text-zinc-600">{SKILLS.length} 个技能</span>
          <span className="text-[9px] text-accent-emerald ml-1">已激活 {activeSkills.size}</span>
        </div>
        <div className="text-[9px] text-zinc-600 mb-1.5 px-1">
          💡 技能是思维协议。激活后会影响 AI 的思考方式，无需手动调用。
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-bg-deep border border-border-subtle mb-1.5">
          <Search className="w-3 h-3 text-zinc-500" />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="搜索技能..."
            className="flex-1 bg-transparent text-[10px] text-zinc-300 focus:outline-none"
          />
        </div>
        {/* 全局一键激活按钮 */}
        <button
          onClick={toggleAll}
          className={`w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
            allActive
              ? 'bg-accent-emerald/15 text-accent-emerald border-accent-emerald/30'
              : partialActive
                ? 'bg-accent-amber/10 text-accent-amber border-accent-amber/30 hover:bg-accent-amber/20'
                : 'bg-bg-deep text-zinc-300 border-border-subtle hover:border-accent-emerald/40 hover:text-accent-emerald'
          }`}
          title={allActive ? '取消全部激活' : '激活全部技能'}
        >
          {allActive ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
          {allActive ? '取消全部激活' : partialActive ? `补全激活（还差 ${SKILLS.length - activeSkills.size}）` : `一键激活全部 ${SKILLS.length} 个技能`}
        </button>
      </div>

      {/* 技能列表 */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(filteredGrouped).map(([family, skills]) => {
          const familyActiveCount = skills.filter(s => activeSkills.has(s.id)).length
          const familyAllActive = familyActiveCount === skills.length
          return (
            <div key={family} className="border-b border-border-subtle/30">
              {/* 族标题栏 */}
              <div className="flex items-center pr-1">
                <button
                  onClick={() => toggleFamily(family)}
                  className="flex-1 flex items-center gap-1 px-2 py-1 hover:bg-bg-hover"
                >
                  {(expandedFamilies.has(family) || filter)
                    ? <ChevronDown className="w-3 h-3 text-zinc-500" />
                    : <ChevronRight className="w-3 h-3 text-zinc-500" />}
                  <span className="text-[11px]">{FAMILY_ICONS[family] ?? '📦'}</span>
                  <span className="text-[10px] font-medium text-zinc-400">{family}</span>
                  <span className="text-[9px] text-zinc-600">{skills.length}</span>
                  {familyActiveCount > 0 && (
                    <span className="text-[8px] px-1 rounded bg-accent-emerald/15 text-accent-emerald ml-1">
                      {familyActiveCount}/{skills.length}
                    </span>
                  )}
                </button>
                {/* 族级一键激活 */}
                <button
                  onClick={() => toggleFamilyAll(family, skills)}
                  className={`flex-shrink-0 px-1.5 py-0.5 text-[8px] rounded border transition-colors ${
                    familyAllActive
                      ? 'bg-accent-emerald/15 text-accent-emerald border-accent-emerald/30'
                      : 'bg-bg-deep text-zinc-400 border-border-subtle hover:border-accent-emerald/40 hover:text-accent-emerald'
                  }`}
                  title={familyAllActive ? `取消激活${family}全部` : `一键激活${family}全部`}
                >
                  {familyAllActive ? '全不选' : '全选'}
                </button>
              </div>
              {/* 族内技能 */}
              {(expandedFamilies.has(family) || filter) && skills.map(skill => {
                const isActive = activeSkills.has(skill.id)
                return (
                  <div
                    key={skill.id}
                    className={`px-3 py-1.5 hover:bg-bg-hover group transition-colors cursor-pointer ${
                      isActive ? 'bg-accent-emerald/5' : ''
                    }`}
                    onClick={() => toggleSkill(skill)}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className={`text-[10px] flex-1 truncate ${isActive ? 'text-accent-emerald font-medium' : 'text-zinc-200 font-medium'}`}>
                        {skill.name}
                      </div>
                      {isActive && (
                        <span className="text-[8px] px-1 rounded bg-accent-emerald/15 text-accent-emerald flex items-center gap-0.5">
                          <Sparkles className="w-2 h-2" />
                          已激活
                        </span>
                      )}
                      {!isActive && (
                        <span className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 text-[9px] rounded bg-bg-deep text-accent-emerald border border-accent-emerald/20">
                          点击激活
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-zinc-600 mt-0.5 leading-relaxed">
                      {skill.description}
                    </div>
                    {skill.triggers && skill.triggers.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {skill.triggers.map(t => (
                          <span key={t} className="text-[8px] px-1 py-0.5 rounded bg-bg-deep text-zinc-500">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* 底部统计 */}
      <div className="flex-shrink-0 px-2 py-1 border-t border-border-subtle bg-bg-deep/50 text-[9px] text-zinc-600">
        共 {SKILLS.length} 技能 · {Object.keys(grouped).length} 能力族 · 激活 {activeSkills.size}
      </div>
    </div>
  )
}
