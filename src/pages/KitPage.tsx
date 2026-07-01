import { useCallback, useState, useEffect, useRef } from 'react'
import { SkillLibrary } from '../components/SkillLibrary'
import { Workspace } from '../components/Workspace'
import { KitConfig } from '../components/KitConfig'
import { PreviewModal } from '../components/PreviewModal'
import { SKILLS } from '../data/skills'
import { useStore } from '../store/useStore'
import {
  generatePackageJson,
  generateReadme,
  generateKitConfig,
  downloadFile,
  getTotalSize,
} from '../utils/generators'
import type { KitConfigState, PreviewState, PreviewType, Skill } from '../types'

const DEFAULT_KIT_CONFIG: KitConfigState = {
  name: 'my-custom-kit',
  version: '1.0.0',
  description: '',
  type: 'vertical-kit',
  vertical: 'developer',
}

export function KitPage() {
  const pendingKitSkillIds = useStore(s => s.pendingKitSkillIds)
  const setPendingKitSkillIds = useStore(s => s.setPendingKitSkillIds)
  const consumedRef = useRef(false)

  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>(() => {
    if (pendingKitSkillIds.length > 0 && !consumedRef.current) {
      consumedRef.current = true
      const ids = [...pendingKitSkillIds]
      setPendingKitSkillIds([])
      return ids
    }
    return []
  })
  const [kitConfig, setKitConfig] = useState<KitConfigState>(DEFAULT_KIT_CONFIG)

  useEffect(() => {
    if (pendingKitSkillIds.length > 0) {
      setSelectedSkillIds((prev) => {
        const merged = [...new Set([...prev, ...pendingKitSkillIds])]
        return merged
      })
      setPendingKitSkillIds([])
    }
  }, [pendingKitSkillIds, setPendingKitSkillIds])
  const [preview, setPreview] = useState<PreviewState>({
    open: false,
    type: null,
    content: '',
    filename: '',
  })

  const selectedSkills: Skill[] = selectedSkillIds
    .map((id) => SKILLS.find((s) => s.id === id))
    .filter((s): s is Skill => Boolean(s))

  const totalSize = getTotalSize(selectedSkills)

  const toggleSkill = useCallback((id: string) => {
    setSelectedSkillIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])

  const removeSkill = useCallback((id: string) => {
    setSelectedSkillIds((prev) => prev.filter((x) => x !== id))
  }, [])

  const moveSkill = useCallback((index: number, direction: 'up' | 'down') => {
    setSelectedSkillIds((prev) => {
      if (prev.length === 0) return prev
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const tmp = next[index]
      next[index] = next[target]
      next[target] = tmp
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setSelectedSkillIds([])
  }, [])

  const openPreview = useCallback(
    (type: PreviewType) => {
      let content = ''
      let filename = ''
      if (type === 'package.json') {
        content = generatePackageJson(kitConfig, selectedSkills)
        filename = 'package.json'
      } else if (type === 'README.md') {
        content = generateReadme(kitConfig, selectedSkills)
        filename = 'README.md'
      } else {
        content = generateKitConfig(kitConfig, selectedSkills)
        filename = `${kitConfig.name || 'kit'}.kit.json`
      }
      setPreview({ open: true, type, content, filename })
    },
    [kitConfig, selectedSkills],
  )

  const downloadKitConfig = useCallback(() => {
    const content = generateKitConfig(kitConfig, selectedSkills)
    const filename = `${kitConfig.name || 'kit'}.kit.json`
    downloadFile(filename, content, 'application/json')
  }, [kitConfig, selectedSkills])

  const closePreview = useCallback(() => {
    setPreview((prev) => ({ ...prev, open: false }))
  }, [])

  return (
    <div className="flex flex-col gap-3 p-3 lg:p-4 overflow-y-auto lg:overflow-hidden min-h-0 h-[calc(100vh-8rem)]">
      <main className="flex-1 flex flex-col lg:flex-row gap-3 overflow-y-auto lg:overflow-hidden min-h-0">
        <section className="lg:w-80 xl:w-96 flex-shrink-0 h-80 lg:h-full min-h-0">
          <SkillLibrary selectedIds={selectedSkillIds} onToggle={toggleSkill} />
        </section>

        <section className="flex-1 min-h-0 h-96 lg:h-full">
          <Workspace
            selectedSkills={selectedSkills}
            onMove={moveSkill}
            onRemove={removeSkill}
            onClear={clearAll}
          />
        </section>

        <section className="lg:w-80 xl:w-96 flex-shrink-0 h-[640px] lg:h-full min-h-0">
          <KitConfig
            config={kitConfig}
            onChange={setKitConfig}
            selectedCount={selectedSkills.length}
            totalSize={totalSize}
            onGenerate={openPreview}
            onDownloadKit={downloadKitConfig}
          />
        </section>
      </main>

      <PreviewModal
        open={preview.open}
        type={preview.type}
        content={preview.content}
        filename={preview.filename}
        onClose={closePreview}
      />
    </div>
  )
}
