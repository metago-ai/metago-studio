import { useMemo, useState } from 'react'
import { Search, ChevronDown, Check, Boxes } from 'lucide-react'
import type { Skill, SkillCategory } from '../types'
import { SKILLS } from '../data/skills'
import { CATEGORY_LABELS } from '../utils/generators'

interface SkillLibraryProps {
  selectedIds: string[]
  onToggle: (id: string) => void
}

type Filter = 'all' | SkillCategory

export function SkillLibrary({ selectedIds, onToggle }: SkillLibraryProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const counts = useMemo(
    () => ({
      all: SKILLS.length,
      core: SKILLS.filter((s) => s.category === 'core').length,
      dev: SKILLS.filter((s) => s.category === 'dev').length,
    }),
    [],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return SKILLS.filter((s) => {
      if (filter !== 'all' && s.category !== filter) return false
      if (!q) return true
      return (
        s.id.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.detail.toLowerCase().includes(q)
      )
    })
  }, [query, filter])

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: counts.all },
    { key: 'core', label: '核心', count: counts.core },
    { key: 'dev', label: 'Dev Kit', count: counts.dev },
  ]

  return (
    <div className="card-base flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border-subtle">
        <div className="flex items-center gap-2 mb-3">
          <Boxes className="w-4 h-4 text-accent-emerald" />
          <h2 className="text-sm font-semibold text-zinc-100">技能库</h2>
          <span className="ml-auto text-xs text-zinc-500">
            {filtered.length} / {SKILLS.length}
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索技能..."
            className="input-base pl-8 text-xs"
            aria-label="搜索技能"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 mt-2.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                filter === f.key
                  ? 'bg-accent-emerald/15 text-accent-emerald border-accent-emerald/30'
                  : 'bg-bg-elevated text-zinc-400 border-transparent hover:bg-bg-hover'
              }`}
            >
              {f.label}
              <span className="ml-1 opacity-60">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-xs">
            <Search className="w-6 h-6 mx-auto mb-2 opacity-40" />
            未找到匹配技能
          </div>
        ) : (
          filtered.map((skill) => (
            <SkillRow
              key={skill.id}
              skill={skill}
              selected={selectedIds.includes(skill.id)}
              expanded={expandedId === skill.id}
              onToggle={() => onToggle(skill.id)}
              onExpand={() =>
                setExpandedId((prev) => (prev === skill.id ? null : skill.id))
              }
            />
          ))
        )}
      </div>
    </div>
  )
}

interface SkillRowProps {
  skill: Skill
  selected: boolean
  expanded: boolean
  onToggle: () => void
  onExpand: () => void
}

function SkillRow({ skill, selected, expanded, onToggle, onExpand }: SkillRowProps) {
  return (
    <div
      className={`rounded-lg border transition-colors ${
        selected
          ? 'bg-accent-emerald/8 border-accent-emerald/30'
          : 'border-transparent hover:bg-bg-elevated/60'
      }`}
    >
      <div className="flex items-start gap-2 p-2">
        <button
          onClick={onToggle}
          className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
            selected
              ? 'bg-accent-emerald border-accent-emerald'
              : 'border-border-default hover:border-accent-emerald/50'
          }`}
          aria-label={selected ? '取消选择' : '选择技能'}
          aria-pressed={selected}
        >
          {selected && <Check className="w-3 h-3 text-bg-deep" />}
        </button>

        <button
          onClick={onExpand}
          className="flex-1 min-w-0 text-left"
          aria-expanded={expanded}
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium text-zinc-100">{skill.title}</span>
            <span
              className={`badge ${
                skill.category === 'core'
                  ? 'bg-zinc-700/60 text-zinc-300'
                  : 'bg-accent-amber/15 text-accent-amber'
              }`}
            >
              {CATEGORY_LABELS[skill.category]}
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 font-mono mt-0.5 truncate">{skill.id}</div>
          <div className="text-xs text-zinc-400 mt-1">{skill.description}</div>
        </button>

        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-500 flex-shrink-0 mt-1 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </div>

      {expanded && (
        <div className="px-2 pb-2 pl-8 animate-slide-down">
          <div className="pt-2 border-t border-border-subtle">
            <p className="text-xs text-zinc-400 leading-relaxed">{skill.detail}</p>
            <div className="flex flex-wrap gap-1 mt-2 items-center">
              {skill.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-zinc-400"
                >
                  #{tag}
                </span>
              ))}
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-zinc-500 ml-auto font-mono">
                ~{(skill.estimatedSize / 1024).toFixed(1)}KB
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
