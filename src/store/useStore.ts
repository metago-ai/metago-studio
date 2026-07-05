import { create } from 'zustand'
import type { DecisionLockRecord, EvolutionRecord, Activity, BehaviorRecord, BehaviorCategory, CreditScore, CreditHistoryEntry, LeaderboardEntry } from '../types'
import { EVOLUTION_STATS } from '../data/evolution'
import { SCENE_TEMPLATES } from '../data/templates'
import { SKILLS } from '../data/skills'
import {
  loadRecords as loadEvolutionRecords,
  addRecord as addRecordToArchive,
  removeRecord as removeRecordFromArchive,
  calculateStats as calculateEvolutionStats,
} from '../lib/evolutionArchive'
import {
  runDecisionLockValidation,
  calculateLockStats,
  loadDecisionLockHistory,
  saveDecisionLockHistory,
  type ValidationInput,
} from '../lib/decisionLockValidator'
import {
  loadLicense,
  getCurrentTier,
  getFeatureFlags,
  validateLicenseKey,
  deactivateLicense,
  getTrialDaysRemaining,
  saveLicense,
  type LicenseInfo,
  type PlanTier,
  type FeatureFlags,
} from '../lib/proGate'
import {
  loadCurrentRoleId,
  saveCurrentRoleId,
} from '../lib/roleConfig'
import {
  getProfile,
  activateProCloud,
  cancelSubscriptionCloud,
  reportEventCloud,
  getMetricsFromCloud,
  recordBehaviorCloud,
  getCreditScoreCloud,
  getBehaviorRecordsCloud,
  getCreditHistoryCloud,
  getLeaderboardCloud,
  type CloudMetrics,
} from '../lib/cloudFunctions'
import {
  loadPrivateSkills,
  addPrivateSkill,
  updatePrivateSkill,
  removePrivateSkill,
  decryptContent,
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
import {
  loadAllFromCloud,
  cloudSaveEvolutionRecord,
  cloudDeleteEvolutionRecord,
  cloudSaveDecisionLock,
  cloudSavePrivateSkill,
  cloudDeletePrivateSkill,
} from '../lib/cloudSync'

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

  // 真实云端度量（来自 events 集合，本地 AI 工具自动上报 + 模板运行上报）
  cloudMetrics: CloudMetrics | null
  metricsLoading: boolean

  // UI 状态
  selectedTemplateId: string | null
  setSelectedTemplateId: (id: string | null) => void

  // Pro 操作
  refreshLicense: () => void
  refreshFromCloud: () => Promise<void>
  startTrialAction: (contact: string) => Promise<{ success: boolean; message: string }>
  activateProAction: (key: string, contact: string) => Promise<{ success: boolean; message: string }>
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
  decryptViewAction: (id: string, password: string) => Promise<{ success: boolean; message: string; content?: string }>

  // 同步操作
  syncPlatform: (id: import('../lib/crossPlatformSync').PlatformId, localCount: number) => Promise<void>
  syncAll: (localCount: number) => Promise<void>

  // 活动
  addActivity: (activity: Activity) => void

  // 云端度量（真实数据通道）
  syncMetricsFromCloud: () => Promise<void>

  // 云端同步
  cloudUserId: string | null
  setCloudUser: (userId: string | null) => Promise<void>

  // 跨页面技能选中（从技能库跳转到 Kit 页面）
  pendingKitSkillIds: string[]
  setPendingKitSkillIds: (ids: string[]) => void

  // AI 数字员工角色（影响 Agent 工作台 system prompt）
  currentRoleId: string
  setCurrentRole: (id: string) => void

  // 行为银行（Behavior Bank）
  creditScore: CreditScore | null
  behaviorRecords: BehaviorRecord[]
  creditHistory: CreditHistoryEntry[]
  leaderboard: LeaderboardEntry[]
  behaviorBankLoading: boolean
  loadCreditScore: () => Promise<void>
  loadBehaviorRecords: (options?: {
    type?: 'digital' | 'ai'
    category?: BehaviorCategory
    limit?: number
    offset?: number
  }) => Promise<void>
  loadCreditHistory: (days?: number) => Promise<void>
  loadLeaderboard: (limit?: number) => Promise<void>
  recordBehavior: (
    category: BehaviorCategory,
    action?: string,
    metadata?: Record<string, unknown>,
  ) => Promise<{ success: boolean; message: string; value?: number }>
}

// 初始化时从 localStorage 加载真实数据，新用户看到空状态（不使用 mock 数据）
const initialEvolutionRecords = loadEvolutionRecords()
const initialDecisionLockHistory = loadDecisionLockHistory()
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
    : {
        ...EVOLUTION_STATS,
        totalEvolutions: 0,
        last7Days: 0,
        last30Days: 0,
        last90Days: 0,
        last365Days: 0,
        successRate: 0,
        averageDurationMs: 0,
        dailyCounts: [],
        dimensions: EVOLUTION_STATS.dimensions.map(d => ({ ...d, score: 0 })),
      },

  // 活动（新用户从空开始，只有真实操作才会产生活动）
  activities: [],

  // 私有技能
  privateSkills: initialPrivateSkills,

  // 同步
  platforms: initialPlatforms,
  syncLogs: initialSyncLogs,
  isSyncing: false,

  // 真实云端度量（初始为 null，syncMetricsFromCloud 后填充）
  cloudMetrics: null,
  metricsLoading: false,

  // UI 状态
  selectedTemplateId: null,
  setSelectedTemplateId: (id) => set({ selectedTemplateId: id }),

  // AI 数字员工角色
  currentRoleId: loadCurrentRoleId(),
  setCurrentRole: (id) => {
    saveCurrentRoleId(id)
    set({ currentRoleId: id })
  },

  // Pro 操作
  refreshLicense: () => {
    set({
      license: loadLicense(),
      tier: getCurrentTier(),
      features: getFeatureFlags(),
      trialDaysRemaining: getTrialDaysRemaining(),
    })
  },
  refreshFromCloud: async () => {
    const profile = await getProfile()
    if (profile) {
      // V3 数据迁移：云端数据库可能存有旧 'trial' 数据，降级为 'free'
      const rawTier = profile.tier as string
      const cloudTier: PlanTier = rawTier === 'trial' ? 'free' : (rawTier as PlanTier)
      const localTier = getCurrentTier()
      if (cloudTier !== localTier) {
        if (cloudTier === 'free') {
          deactivateLicense()
        } else {
          const info: LicenseInfo = {
            tier: cloudTier,
            email: profile.email,
            licenseKey: profile.licenseKey,
            activatedAt: profile.activatedAt ?? new Date().toISOString(),
            expiresAt: profile.expiresAt,
            seats: profile.seats,
            teamHoursBalance: profile.teamHoursBalance,
            enterpriseSeats: profile.enterpriseSeats,
          }
          saveLicense(info)
        }
        set({
          license: loadLicense(),
          tier: getCurrentTier(),
          features: getFeatureFlags(),
          trialDaysRemaining: 0,
        })
      }
    }
  },
  startTrialAction: async (_contact) => {
    // V3 移除 Trial 档位：此方法保留向后兼容，但实际返回错误提示
    return { success: false, message: '14 天免费试用已下线，请直接订阅 Pro（¥39/月）或 Pro+（¥99/月）' }
  },
  activateProAction: async (key, contact) => {
    // 本地格式预检（快速反馈格式错误，不作为授权依据）
    const validation = validateLicenseKey(key)
    if (!validation.valid) {
      return { success: false, message: '授权码格式错误，应为 METAGO-PRO/PROPLUS/TEAM/ENT-XXXX-XXXX-XXXX' }
    }
    // 云端验证（服务端权威，授权码必须在 licenses 集合中存在且有效）
    const res = await activateProCloud(key, contact)
    if (!res.success || !res.profile) {
      return { success: false, message: res.message }
    }
    // V3 数据迁移：云端数据库可能存有旧 'trial' 数据，降级为 'free'
    const rawTier = res.profile.tier as string
    const tier: PlanTier = rawTier === 'trial' ? 'free' : (rawTier as PlanTier)
    const info: LicenseInfo = {
      tier,
      email: res.profile.email,
      licenseKey: res.profile.licenseKey,
      activatedAt: res.profile.activatedAt ?? new Date().toISOString(),
      expiresAt: res.profile.expiresAt,
      seats: res.profile.seats,
      teamHoursBalance: res.profile.teamHoursBalance,
      enterpriseSeats: res.profile.enterpriseSeats,
    }
    saveLicense(info)
    set({
      license: info,
      tier,
      features: getFeatureFlags(),
      trialDaysRemaining: 0,
    })
    return { success: true, message: res.message }
  },
  deactivate: () => {
    deactivateLicense()
    set({
      license: null,
      tier: getCurrentTier(),
      features: getFeatureFlags(),
      trialDaysRemaining: 0,
    })
    cancelSubscriptionCloud().catch(() => {})
  },

  // 决策锁操作
  runValidation: (input) => {
    // Pro 版硬校验（问题即阻断），Free 版软校验（仅警告不阻断）
    const hardMode = get().features.decisionLockHardValidation
    const record = runDecisionLockValidation(input, { hardMode })
    const history = [record, ...get().decisionLockHistory].slice(0, 500)
    const stats = calculateLockStats(history)
    saveDecisionLockHistory(history)
    // 添加活动日志
    const activity: Activity = {
      id: `act_${Date.now()}`,
      timestamp: record.timestamp,
      type: 'decision_lock',
      title: record.passed
        ? (hardMode ? '决策锁硬校验通过' : '决策锁软校验完成')
        : '决策锁硬校验阻断',
      description: record.blockedReason || `4 道关卡全部通过（${record.totalDurationMs}ms）`,
      status: record.passed ? 'success' : 'blocked',
    }
    set({
      decisionLockHistory: history,
      lockStats: stats,
      activities: [activity, ...get().activities].slice(0, 50),
    })
    const uid = get().cloudUserId
    if (uid) cloudSaveDecisionLock(uid, record).catch(() => {})
    // 自动上报到 events 集合（度量页面真实数据源）
    reportEventCloud('decision_lock', {
      passed: record.passed,
      hardMode,
      durationMs: record.totalDurationMs,
      blockedReason: record.blockedReason || '',
      stages: record.stages.map(s => ({ name: s.name, ok: s.passed })),
    }).catch(() => {})
    return record
  },
  clearDecisionLockHistory: () => {
    saveDecisionLockHistory([])
    set({
      decisionLockHistory: [],
      lockStats: calculateLockStats([]),
    })
  },

  // 进化操作
  addEvolutionRecord: (record) => {
    const records = addRecordToArchive(record)
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
    const uid = get().cloudUserId
    if (uid) cloudSaveEvolutionRecord(uid, record).catch(() => {})
    // 自动上报到 events 集合（度量页面真实数据源）
    reportEventCloud('evolution', {
      trigger: record.trigger,
      boundary: record.boundary,
      gap: record.gap,
      verified: record.verified,
      recursed: record.recursed,
      depth: record.depth,
      durationMs: record.durationMs,
    }).catch(() => {})
  },
  removeEvolutionRecord: (id) => {
    const records = removeRecordFromArchive(id)
    const stats = calculateEvolutionStats(records)
    set({ evolutionRecords: records, evolutionStats: stats })
    const uid = get().cloudUserId
    if (uid) cloudDeleteEvolutionRecord(uid, id).catch(() => {})
  },
  clearEvolutionRecords: () => {
    set({
      evolutionRecords: [],
      evolutionStats: calculateEvolutionStats([]),
    })
  },

  // 私有技能操作
  addPrivateSkillAction: (name, description, content, password, tags = []) => {
    const uid = get().cloudUserId
    const result = addPrivateSkill(name, description, content, password, tags, uid ? (skill) => {
      cloudSavePrivateSkill(uid, skill).catch(() => {})
    } : undefined)
    if (result.success) {
      set({ privateSkills: loadPrivateSkills() })
    }
    return { success: result.success, message: result.message }
  },
  updatePrivateSkillAction: (id, content, password) => {
    const result = updatePrivateSkill(id, content, password)
    if (result.success) {
      set({ privateSkills: loadPrivateSkills() })
      const uid = get().cloudUserId
      if (uid) {
        const skills = loadPrivateSkills()
        const updated = skills.find(s => s.id === id)
        if (updated) cloudSavePrivateSkill(uid, updated).catch(() => {})
      }
    }
    return { success: result.success, message: result.message }
  },
  removePrivateSkillAction: (id) => {
    removePrivateSkill(id)
    set({ privateSkills: loadPrivateSkills() })
    const uid = get().cloudUserId
    if (uid) cloudDeletePrivateSkill(uid, id).catch(() => {})
  },
  decryptViewAction: async (id, password) => {
    const skills = loadPrivateSkills()
    const skill = skills.find(s => s.id === id)
    if (!skill) return { success: false, message: '技能不存在' }
    if (!skill.encryptedContent) {
      // 加密尚未完成（异步加密中）或数据损坏
      return { success: false, message: '加密内容尚未就绪，请稍后再试' }
    }
    try {
      const content = await decryptContent(skill.encryptedContent, password)
      return { success: true, message: '解密成功', content }
    } catch {
      return { success: false, message: '口令错误，无法解密' }
    }
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

  // 云端度量（真实数据通道）—— 从 events 集合拉取真实聚合数据
  syncMetricsFromCloud: async () => {
    set({ metricsLoading: true })
    try {
      const metrics = await getMetricsFromCloud(30)
      set({ cloudMetrics: metrics, metricsLoading: false })
    } catch {
      set({ metricsLoading: false })
    }
  },

  // 云端同步
  cloudUserId: null,
  setCloudUser: async (userId) => {
    set({ cloudUserId: userId })
    if (!userId) return
    const cloud = await loadAllFromCloud(userId)
    set({
      evolutionRecords: cloud.evolutionRecords.length > 0 ? cloud.evolutionRecords : get().evolutionRecords,
      evolutionStats: cloud.evolutionRecords.length > 0
        ? calculateEvolutionStats(cloud.evolutionRecords)
        : get().evolutionStats,
      decisionLockHistory: cloud.decisionLocks.length > 0 ? cloud.decisionLocks : get().decisionLockHistory,
      lockStats: cloud.decisionLocks.length > 0
        ? calculateLockStats(cloud.decisionLocks)
        : get().lockStats,
      privateSkills: cloud.privateSkills.length > 0 ? cloud.privateSkills : get().privateSkills,
      platforms: cloud.platforms ?? get().platforms,
      syncLogs: cloud.syncLogs ?? get().syncLogs,
    })
  },

  pendingKitSkillIds: [],
  setPendingKitSkillIds: (ids) => set({ pendingKitSkillIds: ids }),

  // 行为银行
  creditScore: null,
  behaviorRecords: [],
  creditHistory: [],
  leaderboard: [],
  behaviorBankLoading: false,
  loadCreditScore: async () => {
    set({ behaviorBankLoading: true })
    try {
      const score = await getCreditScoreCloud()
      set({ creditScore: score, behaviorBankLoading: false })
    } catch {
      set({ behaviorBankLoading: false })
    }
  },
  loadBehaviorRecords: async (options) => {
    set({ behaviorBankLoading: true })
    try {
      const records = await getBehaviorRecordsCloud(options)
      set({ behaviorRecords: records, behaviorBankLoading: false })
    } catch {
      set({ behaviorBankLoading: false })
    }
  },
  loadCreditHistory: async (days) => {
    set({ behaviorBankLoading: true })
    try {
      const history = await getCreditHistoryCloud(days)
      set({ creditHistory: history, behaviorBankLoading: false })
    } catch {
      set({ behaviorBankLoading: false })
    }
  },
  loadLeaderboard: async (limit) => {
    set({ behaviorBankLoading: true })
    try {
      const board = await getLeaderboardCloud(limit)
      set({ leaderboard: board, behaviorBankLoading: false })
    } catch {
      set({ behaviorBankLoading: false })
    }
  },
  recordBehavior: async (category, action, metadata) => {
    const res = await recordBehaviorCloud({ category, action, metadata })
    if (res.success) {
      // 乐观刷新信用分（不阻塞返回）
      get().loadCreditScore().catch(() => {})
    }
    return res
  },
}))
