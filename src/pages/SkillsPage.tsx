import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Search, Sparkles, Package, Download, Check, Wand2, Terminal } from 'lucide-react'
import { SKILLS } from '../data/skills'
import { useStore } from '../store/useStore'
import type { Skill } from '../types'

const CATEGORY_LABELS: Record<string, string> = {
  core: '核心技能',
  dev: 'Dev Kit',
}

const TAG_COLORS: Record<string, string> = {
  批判: 'bg-accent-rose/10 text-accent-rose',
  决策: 'bg-accent-amber/10 text-accent-amber',
  溯源: 'bg-accent-blue/10 text-accent-blue',
  输出: 'bg-accent-emerald/10 text-accent-emerald',
  元认知: 'bg-accent-teal/10 text-accent-teal',
  适配: 'bg-accent-teal/10 text-accent-teal',
  推演: 'bg-accent-amber/10 text-accent-amber',
  代码: 'bg-accent-emerald/10 text-accent-emerald',
  架构: 'bg-accent-blue/10 text-accent-blue',
  安全: 'bg-accent-rose/10 text-accent-rose',
}

const LIFEFORM_INSTALL_CMD = 'irm https://gitee.com/metago/metagolifeform/raw/main/scripts/bootstrap-install.ps1 | iex'

const CATEGORY_SCENARIOS: Record<string, string> = {
  core: '作为 Lifeform Kit 内置能力，在 AI 对话中自动触发或由用户手动调用',
  dev: '作为 Dev Kit 工程能力，在代码审查、架构设计、重构、安全审计场景中使用',
}

export function SkillsPage() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  const navigate = useNavigate()
  const setPendingKitSkillIds = useStore(s => s.setPendingKitSkillIds)

  const filteredSkills = useMemo(() => {
    return SKILLS.filter((skill) => {
      const matchSearch =
        !search ||
        skill.id.toLowerCase().includes(search.toLowerCase()) ||
        skill.title.includes(search) ||
        skill.description.includes(search)
      const matchCategory = activeCategory === 'all' || skill.category === activeCategory
      return matchSearch && matchCategory
    })
  }, [search, activeCategory])

  const handleGenerateKit = useCallback((skill: Skill) => {
    setPendingKitSkillIds([skill.id])
    setSelectedSkill(null)
    navigate('/kit')
  }, [navigate, setPendingKitSkillIds])

  const handleCopyInstall = useCallback(async () => {
    const allCmds = [
      '# MetaGO Lifeform Kit 安装方式',
      '# Gitee（一键引导安装-推荐）:',
      LIFEFORM_INSTALL_CMD,
      '# npm:',
      'npm install metago-lifeform',
      '# GitHub:',
      'git clone https://github.com/MetaGO-Labs/MetaGO-Lifeform.git',
    ].join('\n')
    try {
      await navigator.clipboard?.writeText(allCmds)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      setCopyState('idle')
    }
  }, [])

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-accent-emerald" />
          技能库
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {SKILLS.length} 个技能 · 10 大能力族 · 认知/保障/治理/进化/执行/溯源/价值/意识/方法论/架构
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="flex items-center gap-3 flex-wrap"
      >
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索技能名称、ID 或描述..."
            className="input-base pl-9"
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-elevated/50">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              activeCategory === 'all'
                ? 'bg-accent-emerald/20 text-accent-emerald'
                : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            全部
          </button>
          <button
            onClick={() => setActiveCategory('core')}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              activeCategory === 'core'
                ? 'bg-accent-emerald/20 text-accent-emerald'
                : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            核心技能
          </button>
          <button
            onClick={() => setActiveCategory('dev')}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              activeCategory === 'dev'
                ? 'bg-accent-emerald/20 text-accent-emerald'
                : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            Dev Kit
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="text-xs text-zinc-500"
      >
        共 {filteredSkills.length} 个技能
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
      >
        {filteredSkills.map((skill, idx) => (
          <motion.div
            key={skill.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.02, 0.3) }}
            whileHover={{ scale: 1.02 }}
            onClick={() => setSelectedSkill(skill)}
            className="card-base p-4 cursor-pointer transition-all hover:border-accent-emerald/40 hover:shadow-glow"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-accent-emerald">{skill.id}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${skill.category === 'core' ? 'bg-accent-emerald/10 text-accent-emerald' : 'bg-accent-blue/10 text-accent-blue'}`}
              >
                {CATEGORY_LABELS[skill.category]}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-zinc-100 mb-1">{skill.title}</h3>
            <p className="text-xs text-zinc-400 mb-2">{skill.description}</p>
            <div className="flex items-center gap-1 flex-wrap">
              {skill.tags.map((tag) => (
                <span
                  key={tag}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${TAG_COLORS[tag] || 'bg-bg-elevated text-zinc-500'}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>
        ))}
      </motion.div>

      <AnimatePresence>
        {selectedSkill && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedSkill(null)}
            className="fixed inset-0 bg-bg-deep/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="card-base p-6 max-w-xl w-full max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-mono text-accent-emerald">{selectedSkill.id}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${selectedSkill.category === 'core' ? 'bg-accent-emerald/10 text-accent-emerald' : 'bg-accent-blue/10 text-accent-blue'}`}
                >
                  {CATEGORY_LABELS[selectedSkill.category]}
                </span>
              </div>

              <h2 className="text-xl font-bold text-zinc-100 mb-2">{selectedSkill.title}</h2>
              <p className="text-sm text-zinc-400 mb-4">{selectedSkill.detail}</p>

              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {selectedSkill.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`text-xs px-2 py-0.5 rounded ${TAG_COLORS[tag] || 'bg-bg-elevated text-zinc-500'}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="space-y-3 mb-5 text-xs">
                <div className="flex items-center gap-2 text-zinc-500">
                  <Package className="w-3 h-3 flex-shrink-0" />
                  <span>预估大小：{(selectedSkill.estimatedSize / 1024).toFixed(2)} KB</span>
                </div>
                <div className="flex items-start gap-2 text-zinc-500">
                  <Wand2 className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <span>使用场景：{CATEGORY_SCENARIOS[selectedSkill.category]}</span>
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4 mb-5">
                <div className="text-xs text-zinc-500 mb-3 flex items-center gap-1.5">
                  <Terminal className="w-3 h-3" />
                  安装命令（三大平台）
                </div>
                {/* Gitee / 引导安装 */}
                <div className="bg-bg-deep rounded-md p-2.5 mb-2">
                  <div className="text-[10px] text-zinc-600 mb-1">Gitee · 一键引导安装（Windows）</div>
                  <div className="font-mono text-[11px] text-accent-emerald break-all">
                    {LIFEFORM_INSTALL_CMD}
                  </div>
                </div>
                {/* npm */}
                <div className="bg-bg-deep rounded-md p-2.5 mb-2">
                  <div className="text-[10px] text-zinc-600 mb-1">npm · Node.js 包</div>
                  <div className="font-mono text-[11px] text-blue-400 break-all">
                    npm install metago-lifeform
                  </div>
                </div>
                {/* GitHub */}
                <div className="bg-bg-deep rounded-md p-2.5">
                  <div className="text-[10px] text-zinc-600 mb-1">GitHub · 开源仓库</div>
                  <div className="font-mono text-[11px] text-zinc-400 break-all">
                    github.com/MetaGO-Labs/MetaGO-Lifeform
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleGenerateKit(selectedSkill)}
                  className="btn-primary text-xs flex-1 inline-flex items-center justify-center gap-1.5"
                >
                  <Wand2 className="w-3 h-3" />
                  生成包含此技能的 Kit
                </button>
                <button
                  onClick={handleCopyInstall}
                  className="btn-secondary text-xs inline-flex items-center justify-center gap-1.5 min-w-[130px]"
                  title="复制三大平台安装命令"
                >
                  {copyState === 'copied' ? (
                    <>
                      <Check className="w-3 h-3 text-accent-emerald" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Download className="w-3 h-3" />
                      复制安装命令
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
