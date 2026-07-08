/**
 * Pro 版功能门控（FR-1 ~ FR-7）- V3 2026-07-06
 *
 * 管理 Pro 授权状态，区分 Free / Pro / Pro+ / Team / Enterprise 五档。
 * 授权码本地验证（离线可用），云端验证（在线时同步）。
 *
 * 定价（与 pricing.ts 一致）：
 *   - Free（社区版）：永久免费，10万 tokens/天（V4 Flash）
 *   - Pro 个人版：¥39/月，500万 tokens/月，超额 ¥5/百万 or BYOK
 *   - Pro+ 进阶版：¥99/月，2000万 tokens/月，行为银行信用 + 优先支持
 *   - Pro 团队版：¥199/月起（5 席 + 500 小时数字员工时长），超出 ¥0.5/小时
 *   - 企业版：¥3万/年起 + ¥6000/席位/年，强制 BYOK + 私有部署
 *
 * V3 变更：
 *   - 移除 Trial（14 天免费试用）—— Free 用户可直接升级到 Pro
 *   - 新增 Pro+（¥99/月，行为银行信用 + 2000万 tokens/月）
 *   - Team 改为订阅+时薪（含 500 小时数字员工时长，超出 ¥0.5/小时）
 *   - Enterprise 改为年费+席位费（5 席含，加席 ¥6000/席位/年）
 */

import type { PlanTier } from './pricing'
export type { PlanTier } from './pricing'

export interface LicenseInfo {
  tier: PlanTier
  email: string
  licenseKey: string
  activatedAt: string
  expiresAt: string | null // null = 永久
  seats: number // 团队版席位数
  /** Team 档位：数字员工时长余额（小时） */
  teamHoursBalance?: number
  /** Enterprise 档位：数字员工席位数 */
  enterpriseSeats?: number
}

/** 功能特性清单 */
export interface FeatureFlags {
  decisionLockHardValidation: boolean // FR-1 硬校验
  evolutionArchive: boolean // FR-2 进化档案
  capabilityDashboard: boolean // FR-3 仪表盘
  crossPlatformSync: boolean // FR-4 跨平台同步
  privateSkillLibrary: boolean // FR-5 私有技能库
  prioritySupport: boolean // FR-6 优先支持
  industryKits: boolean // FR-7 行业定制器官
  exportAdvanced: boolean // 高级导出（PDF）
  teamDashboard: boolean // 团队仪表盘
  unlimitedTemplates: boolean // 无限模板
  behaviorBank: boolean // 行为银行信用
  decisionLockVisualization: boolean // 决策锁可视化
}

const LICENSE_KEY = 'metago_pro_license_v3'

/** 各档位功能矩阵 */
const TIER_FEATURES: Record<PlanTier, FeatureFlags> = {
  free: {
    decisionLockHardValidation: false, // 社区版仅软校验
    evolutionArchive: false,
    capabilityDashboard: false,
    crossPlatformSync: false,
    privateSkillLibrary: false,
    prioritySupport: false,
    industryKits: false,
    exportAdvanced: false,
    teamDashboard: false,
    unlimitedTemplates: false,
    behaviorBank: false,
    decisionLockVisualization: false,
  },
  pro: {
    decisionLockHardValidation: true,
    evolutionArchive: true,
    capabilityDashboard: true,
    crossPlatformSync: true,
    privateSkillLibrary: true,
    prioritySupport: true,
    industryKits: true,
    exportAdvanced: true,
    teamDashboard: false,
    unlimitedTemplates: true,
    behaviorBank: false,
    decisionLockVisualization: false,
  },
  pro_plus: {
    decisionLockHardValidation: true,
    evolutionArchive: true,
    capabilityDashboard: true,
    crossPlatformSync: true,
    privateSkillLibrary: true,
    prioritySupport: true,
    industryKits: true,
    exportAdvanced: true,
    teamDashboard: false,
    unlimitedTemplates: true,
    behaviorBank: true,
    decisionLockVisualization: false,
  },
  team: {
    decisionLockHardValidation: true,
    evolutionArchive: true,
    capabilityDashboard: true,
    crossPlatformSync: true,
    privateSkillLibrary: true,
    prioritySupport: true,
    industryKits: true,
    exportAdvanced: true,
    teamDashboard: true,
    unlimitedTemplates: true,
    behaviorBank: true,
    decisionLockVisualization: true,
  },
  enterprise: {
    decisionLockHardValidation: true,
    evolutionArchive: true,
    capabilityDashboard: true,
    crossPlatformSync: true,
    privateSkillLibrary: true,
    prioritySupport: true,
    industryKits: true,
    exportAdvanced: true,
    teamDashboard: true,
    unlimitedTemplates: true,
    behaviorBank: true,
    decisionLockVisualization: true,
  },
}

/** 各档位显示信息 */
export const TIER_INFO: Record<PlanTier, { name: string; price: string; color: string }> = {
  free: { name: '社区版', price: '免费', color: 'text-zinc-400' },
  pro: { name: 'Pro 个人版', price: '¥39/月', color: 'text-accent-emerald' },
  pro_plus: { name: 'Pro+ 进阶版', price: '¥99/月', color: 'text-accent-teal' },
  team: { name: 'Pro 团队版', price: '¥199/月起', color: 'text-accent-amber' },
  enterprise: { name: '企业版', price: '¥3万/年起', color: 'text-accent-violet' },
}

// ============ 授权码验证 ============

/**
 * 验证授权码格式（本地校验）
 * 格式：
 *   - METAGO-PRO-XXXX-XXXX-XXXX       → Pro 个人版
 *   - METAGO-PROPLUS-XXXX-XXXX-XXXX   → Pro+ 进阶版
 *   - METAGO-TEAM-XXXX-XXXX-XXXX      → Team 团队版
 *   - METAGO-ENT-XXXX-XXXX-XXXX       → Enterprise 企业版
 */
export function validateLicenseKey(key: string): { valid: boolean; tier: PlanTier; email?: string } {
  if (!key) return { valid: false, tier: 'free' }
  const trimmed = key.trim().toUpperCase()
  const proMatch = trimmed.match(/^METAGO-PRO-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/)
  if (proMatch) return { valid: true, tier: 'pro' }
  const proPlusMatch = trimmed.match(/^METAGO-PROPLUS-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/)
  if (proPlusMatch) return { valid: true, tier: 'pro_plus' }
  const teamMatch = trimmed.match(/^METAGO-TEAM-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/)
  if (teamMatch) return { valid: true, tier: 'team' }
  const entMatch = trimmed.match(/^METAGO-ENT-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/)
  if (entMatch) return { valid: true, tier: 'enterprise' }
  return { valid: false, tier: 'free' }
}

// V3 安全加固（2026-07-06）：generateLicenseKey 函数已删除
// 旧版漏洞：本地可生成有效格式授权码，任何用户都可在控制台调用激活 Pro
// 现在：授权码只能由云端 subscription 云函数的 generateLicense action 生成（管理员权限）
// 前端不再提供本地生成授权码的能力

// ============ 持久化 ============

/** 读取授权信息 */
export function loadLicense(): LicenseInfo | null {
  try {
    const raw = localStorage.getItem(LICENSE_KEY)
    if (!raw) return null
    const info = JSON.parse(raw) as LicenseInfo
    // 数据迁移：旧版本可能存了 trial 字段，自动清理
    if ((info as LicenseInfo & { trialStartedAt?: string }).trialStartedAt) {
      delete (info as LicenseInfo & { trialStartedAt?: string }).trialStartedAt
      saveLicense(info)
    }
    return info
  } catch {
    return null
  }
}

/** 保存授权信息 */
export function saveLicense(info: LicenseInfo): void {
  try {
    localStorage.setItem(LICENSE_KEY, JSON.stringify(info))
  } catch (e) {
    console.error('[proGate] 保存授权失败', e)
  }
}

/** 清除授权信息 */
export function clearLicense(): void {
  localStorage.removeItem(LICENSE_KEY)
  // 清理旧版本存储 key（向后兼容）
  localStorage.removeItem('metago_pro_license_v1')
}

// ============ 状态查询 ============

/** 获取当前档位 */
export function getCurrentTier(): PlanTier {
  const license = loadLicense()
  if (!license) return 'free'
  // 检查是否过期
  if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
    clearLicense()
    return 'free'
  }
  return license.tier
}

/** 获取功能特性 */
export function getFeatureFlags(): FeatureFlags {
  const tier = getCurrentTier()
  return TIER_FEATURES[tier]
}

/** 判断是否为付费用户 */
export function isPaidUser(): boolean {
  const tier = getCurrentTier()
  return tier === 'pro' || tier === 'pro_plus' || tier === 'team' || tier === 'enterprise'
}

/** 判断是否为高级付费用户（Pro+ 及以上） */
export function isPremiumUser(): boolean {
  const tier = getCurrentTier()
  return tier === 'pro_plus' || tier === 'team' || tier === 'enterprise'
}

// ============ 激活/取消 ============

// V3 安全加固（2026-07-06）：本地 activatePro 函数已删除
// 旧版漏洞：本地纯格式校验即可激活 Pro，用户构造 METAGO-PRO-XXXX-XXXX-XXXX 即可白嫖
// 现在：激活只能通过 useStore.activateProAction → activateProCloud → 云端 subscription 云函数验证
// 授权码必须在 licenses 集合中存在且状态为 unused，否则云端返回 404/410
//
// 保留的本地函数：
//   - validateLicenseKey：仅做格式预检（快速反馈），不作为授权依据
//   - saveLicense：保存云端返回的授权信息（仅缓存，权威源在云端）
//
// 删除的函数：
//   - generateLicenseKey：授权码只能云端生成
//   - activatePro：本地激活已删除，必须走云端

/** 取消授权（降级到 Free） */
export function deactivateLicense(): void {
  clearLicense()
}

/** 旧版本兼容：保持 startTrial 函数签名但实际降级到 Free（已无 Trial 档位） */
export function startTrial(email: string): LicenseInfo {
  console.warn('[proGate] startTrial 已废弃（V3 移除 Trial 档位），自动降级到 Free')
  return {
    tier: 'free',
    email,
    licenseKey: '',
    activatedAt: new Date().toISOString(),
    expiresAt: null,
    seats: 1,
  }
}

/** 旧版本兼容：trialDaysRemaining 始终返回 0 */
export function getTrialDaysRemaining(): number {
  return 0
}

/** 旧版本兼容：isTrialActive 始终返回 false */
export function isTrialActive(): boolean {
  return false
}
