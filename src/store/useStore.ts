import { create } from 'zustand'
import type { DecisionLockRecord, EvolutionRecord, Activity } from '../types'
import { EVOLUTION_STATS, EVOLUTION_RECORDS, RECENT_ACTIVITIES } from '../data/evolution'
import { DECISION_LOCK_HISTORY } from '../data/decisionLock'
import { SCENE_TEMPLATES } from '../data/templates'
import { SKILLS } from '../data/skills'
import {
  loadRecords as loadEvolutionRecords,
  addRecord as addEvolutionRecord,
  removeRecord as removeEvolutionRecord,
  calculateStats as calculateEvolutionStats,
} from '../lib/evolutionArchive'
import {
  runDecisionLockValidation,
  calculateLockStats,
  type ValidationInput,
} from '../lib/decisionLockValidator'
import {
  loadLicense,
  getCurrentTier,
  getFeatureFlags,
  startTrial,
  activatePro,
  deactivateLicense,
  getTrialDaysRemaining,
  type LicenseInfo,
  type PlanTier,
  type FeatureFlags,
} from '../lib/proGate'
import {
  loadPrivateSkills,
  addPrivateSkill,
  updatePrivateSkill,
  removePrivateSkill,
  type PrivateSkill,
} from '../lib/privateSkills'
import {
  loadPlatforms,
  loadSyncLogs,
  syncWithPlatform,
  syncAllPlatforms,
  type PlatformInfo,
  type SyncLog,
} from '../lib/crossPlatformSync'

interface MetaGOStore {
  // 静态数据
  skills: typeof SKILLS
  templates: typeof SCENE_TEMPLATES

  // Pro 状态
  license: LicenseInfo | null
  tier: PlanTier
  features: FeatureFlags
  trialDaysRemaining: number

  // 决策锁
  decisionLockHistory: DecisionLockRecord[]
  lockStats: ReturnType<typeof calculateLockStats>

  // 进化档案
  evolutionRecords: EvolutionRecord[]
  evolutionStats: typeof EVOLUTION_STATS

  // 活动
  activities: Activity[]

  // 私有技能
  privateSkills: PrivateSkill[]

  // 同步
  platforms: PlatformInfo[]
  syncLogs: SyncLog[]
  isSyncing: boolean

  // UI 状态
  selectedTemplateId: string | null
  setSelectedTemplateId: (id: string | null) => void

  // Pro 操作
  refreshLicense: () => void
  startTrialAction: (email: string) => void
  activateProAction: (key: string, email: string) => { success: boolean; message: string }
  deactivate: () => void

  // 决策锁操作
  runValidation: (input: ValidationInput) => DecisionLockRecord
  clearDecisionLockHistory: () => void

  // 进化操作
  addEvolutionRecord: (record: EvolutionRecord) => void
  removeEvolutionRecord: (id: string) => void
  clearEvolutionRecords: () => void

  // 私有技能操作
  addPrivateSkillAction: (
    name: string,
    description: string,
    content: string,
    password: string,
    tags?: string[]
  ) => { success: boolean; message: string }
  updatePrivateSkillAction: (id: string, content: string, password: string) => { success: boolean; message: string }
  removePrivateSkillAction: (id: string) => void

  // 同步操作
  syncPlatform: (id: import('../lib/crossPlatformSync').PlatformId, localCount: number) => Promise<void>
  syncAll: (localCount: number) => Promise<void>

  // 活动
  addActivity: (activity: Activity) => void
}

// 初始化时从 localStorage 加载真实数据（如果有），否则用 mock 数据
const initialEvolutionRecords = loadEvolutionRecords().length > 0
  ? loadEvolutionRecords()
  : EVOLUTION_RECORDS
const initialDecisionLockHistory = DECISION_LOCK_HISTORY // 决策锁历史默认用 mock（首次使用）
const initialLicense = loadLicense()
const initialTier = getCurrentTier()
const initialFeatures = getFeatureFlags()
const initialTrialDays = getTrialDaysRemaining()
const initialPrivateSkills = loadPrivateSkills()
const initialPlatforms = loadPlatforms()
const initialSyncLogs = loadSyncLogs()

export const useStore = create<MetaGOStore>((set, get) => ({
  // 静态数据
  skills: SKILLS,
  templates: SCENE_TEMPLATES,

  // Pro 状态
  license: initialLicense,
  tier: initialTier,
  features: initialFeatures,
  trialDaysRemaining: initialTrialDays,

  // 决策锁
  decisionLockHistory: initialDecisionLockHistory,
  lockStats: calculateLockStats(initialDecisionLockHistory),

  // 进化档案
  evolutionRecords: initialEvolutionRecords,
  evolutionStats: initialEvolutionRecords.length > 0
    ? calculateEvolutionStats(initialEvolutionRecords)
    : EVOLUTION_STATS,

  // 活动
  activities: RECENT_ACTIVITIES,

  // 私有技能
  privateSkills: initialPrivateSkills,

  // 同步
  platforms: initialPlatforms,
  syncLogs: initialSyncLogs,
  isSyncing: false,

  // UI 状态
  selectedTemplateId: null,
  setSelectedTemplateId: (id) => set({ selectedTemplateId: id }),

  // Pro 操作
  refreshLicense: () => {
    set({
      license: loadLicense(),
      tier: getCurrentTier(),
      features: getFeatureFlags(),
      trialDaysRemaining: getTrialDaysRemaining(),
    })
  },
  startTrialAction: (email) => {
    startTrial(email)
    set({
      license: loadLicense(),
      tier: getCurrentTier(),
      features: getFeatureFlags(),
      trialDaysRemaining: getTrialDaysRemaining(),
    })
  },
  activateProAction: (key, email) => {
    const result = activatePro(key, email)
    if (result.success) {
      set({
        license: loadLicense(),
        tier: getCurrentTier(),
        features: getFeatureFlags(),
        trialDaysRemaining: getTrialDaysRemaining(),
      })
    }
    return { success: result.success, message: result.message }
  },
  deactivate: () => {
    deactivateLicense()
    set({
      license: null,
      tier: getCurrentTier(),
      features: getFeatureFlags(),
      trialDaysRemaining: 0,
    })
  },

  // 决策锁操作
  runValidation: (input) => {
    const record = runDecisionLockValidation(input)
    const history = [record, ...get().decisionLockHistory].slice(0, 500)
    const stats = calculateLockStats(history)
    // 添加活动日志
    const activity: Activity = {
      id: `act_${Date.now()}`,
      timestamp: record.timestamp,
      type: 'decision_lock',
      title: record.passed ? '决策锁校验通过' : '决策锁校验阻断',
      description: record.blockedReason || `4 道关卡全部通过（${record.totalDurationMs}ms）`,
      status: record.passed ? 'success' : 'blocked',
    }
    set({
      decisionLockHistory: history,
      lockStats: stats,
      activities: [activity, ...get().activities].slice(0, 50),
    })
    return record
  },
  clearDecisionLockHistory: () => {
    set({
      decisionLockHistory: [],
      lockStats: calculateLockStats([]),
    })
  },

  // 进化操作
  addEvolutionRecord: (record) => {
    const records = addEvolutionRecord(record)
    const stats = calculateEvolutionStats(records)
    const activity: Activity = {
      id: `act_${Date.now()}`,
      timestamp: record.timestamp,
      type: 'evolution',
      title: `元进化：${record.trigger}`,
      description: record.boundary.slice(0, 80),
      status: record.verified ? 'success' : 'pending',
    }
    set({
      evolutionRecords: records,
      evolutionStats: stats,
      activities: [activity, ...get().activities].slice(0, 50),
    })
  },
  removeEvolutionRecord: (id) => {
    const records = removeEvolutionRecord(id)
    const stats = calculateEvolutionStats(records)
    set({ evolutionRecords: records, evolutionStats: stats })
  },
  clearEvolutionRecords: () => {
    set({
      evolutionRecords: [],
      evolutionStats: calculateEvolutionStats([]),
    })
  },

  // 私有技能操作
  addPrivateSkillAction: (name, description, content, password, tags = []) => {
    const result = addPrivateSkill(name, description, content, password, tags)
    if (result.success) {
      set({ privateSkills: loadPrivateSkills() })
    }
    return { success: result.success, message: result.message }
  },
  updatePrivateSkillAction: (id, content, password) => {
    const result = updatePrivateSkill(id, content, password)
    if (result.success) {
      set({ privateSkills: loadPrivateSkills() })
    }
    return { success: result.success, message: result.message }
  },
  removePrivateSkillAction: (id) => {
    removePrivateSkill(id)
    set({ privateSkills: loadPrivateSkills() })
  },

  // 同步操作
  syncPlatform: async (id, localCount) => {
    set({ isSyncing: true })
    try {
      const result = await syncWithPlatform(id, localCount)
      set({
        platforms: result.platforms,
        syncLogs: result.logs,
        isSyncing: false,
      })
    } catch {
      set({ isSyncing: false })
    }
  },
  syncAll: async (localCount) => {
    set({ isSyncing: true })
    try {
      const result = await syncAllPlatforms(localCount)
      set({
        platforms: result.platforms,
        syncLogs: result.logs,
        isSyncing: false,
      })
    } catch {
      set({ isSyncing: false })
    }
  },

  // 活动
  addActivity: (activity) => {
    set({ activities: [activity, ...get().activities].slice(0, 50) })
  },
}))
