import { create } from 'zustand'
import type { DecisionLockRecord, EvolutionRecord } from '../types'
import { EVOLUTION_STATS, EVOLUTION_RECORDS, RECENT_ACTIVITIES } from '../data/evolution'
import { DECISION_LOCK_HISTORY } from '../data/decisionLock'
import { SCENE_TEMPLATES } from '../data/templates'
import { SKILLS } from '../data/skills'

interface MetaGOStore {
  skills: typeof SKILLS
  templates: typeof SCENE_TEMPLATES
  evolutionRecords: EvolutionRecord[]
  evolutionStats: typeof EVOLUTION_STATS
  activities: typeof RECENT_ACTIVITIES
  decisionLockHistory: DecisionLockRecord[]
  selectedTemplateId: string | null
  setSelectedTemplateId: (id: string | null) => void
}

export const useStore = create<MetaGOStore>((set) => ({
  skills: SKILLS,
  templates: SCENE_TEMPLATES,
  evolutionRecords: EVOLUTION_RECORDS,
  evolutionStats: EVOLUTION_STATS,
  activities: RECENT_ACTIVITIES,
  decisionLockHistory: DECISION_LOCK_HISTORY,
  selectedTemplateId: null,
  setSelectedTemplateId: (id) => set({ selectedTemplateId: id }),
}))
