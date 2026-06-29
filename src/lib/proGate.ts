/**
 * Pro 版功能门控（FR-1 ~ FR-7）
 *
 * 管理 Pro 授权状态，区分 Free / Pro / Team 三档功能。
 * 授权码本地验证（离线可用），云端验证（在线时同步）。
 *
 * 定价（PRD 第六章）：
 *   - Free（社区版）：永久免费
 *   - Pro 个人版：¥39/月 / ¥399/年
 *   - Pro 团队版：¥199/月（5 席）/ ¥1999/年
 *   - 企业版：¥30000/年起
 *
 * 14 天免费试用（PRD 9.1 风险应对）
 */

export type PlanTier = 'free' | 'trial' | 'pro' | 'team'

export interface LicenseInfo {
  tier: PlanTier
  email: string
  licenseKey: string
  activatedAt: string
  expiresAt: string | null // null = 永久
  trialStartedAt: string | null
  seats: number // 团队版席位数
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
}

const LICENSE_KEY = 'metago_pro_license_v1'

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
  },
  trial: {
    // 试用版解锁全部 Pro 功能
    decisionLockHardValidation: true,
    evolutionArchive: true,
    capabilityDashboard: true,
    crossPlatformSync: true,
    privateSkillLibrary: true,
    prioritySupport: false, // 试用不含优先支持
    industryKits: true,
    exportAdvanced: true,
    teamDashboard: false,
    unlimitedTemplates: true,
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
  },
}

/** 各档位显示信息 */
export const TIER_INFO: Record<PlanTier, { name: string; price: string; color: string }> = {
  free: { name: '社区版', price: '免费', color: 'text-zinc-400' },
  trial: { name: '试用版', price: '14 天试用', color: 'text-accent-amber' },
  pro: { name: 'Pro 个人版', price: '¥39/月', color: 'text-accent-emerald' },
  team: { name: 'Pro 团队版', price: '¥199/月', color: 'text-accent-teal' },
}

// ============ 授权码验证 ============

/**
 * 验证授权码格式（本地校验）
 * 格式：METAGO-PRO-XXXX-XXXX-XXXX 或 METAGO-TEAM-XXXX-XXXX-XXXX
 */
export function validateLicenseKey(key: string): { valid: boolean; tier: PlanTier; email?: string } {
  if (!key) return { valid: false, tier: 'free' }
  const trimmed = key.trim().toUpperCase()
  // 简单格式校验：METAGO-PRO-XXXX-XXXX-XXXX
  const proMatch = trimmed.match(/^METAGO-PRO-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/)
  if (proMatch) return { valid: true, tier: 'pro' }
  const teamMatch = trimmed.match(/^METAGO-TEAM-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/)
  if (teamMatch) return { valid: true, tier: 'team' }
  return { valid: false, tier: 'free' }
}

/**
 * 生成授权码（本地试用版，仅用于演示）
 * 真实环境由云端生成并签名
 */
export function generateTrialLicense(email: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const random = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  const seed = email.length > 0 ? email[0].toUpperCase().replace(/[^A-Z0-9]/g, 'X') : 'X'
  return `METAGO-PRO-${seed}${random(3)}-${random(4)}-${random(4)}`
}

// ============ 持久化 ============

/** 读取授权信息 */
export function loadLicense(): LicenseInfo | null {
  try {
    const raw = localStorage.getItem(LICENSE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as LicenseInfo
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
  // 试用期检查
  if (license.tier === 'trial' && license.trialStartedAt) {
    const trialEnd = new Date(license.trialStartedAt)
    trialEnd.setDate(trialEnd.getDate() + 14)
    if (new Date() > trialEnd) {
      clearLicense()
      return 'free'
    }
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
  return tier === 'pro' || tier === 'team'
}

/** 判断是否在试用期内 */
export function isTrialActive(): boolean {
  return getCurrentTier() === 'trial'
}

/** 获取试用剩余天数 */
export function getTrialDaysRemaining(): number {
  const license = loadLicense()
  if (!license || license.tier !== 'trial' || !license.trialStartedAt) return 0
  const trialEnd = new Date(license.trialStartedAt)
  trialEnd.setDate(trialEnd.getDate() + 14)
  const remaining = Math.ceil((trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  return Math.max(0, remaining)
}

// ============ 激活/取消 ============

/** 启动 14 天试用 */
export function startTrial(email: string): LicenseInfo {
  const licenseKey = generateTrialLicense(email)
  const now = new Date().toISOString()
  const info: LicenseInfo = {
    tier: 'trial',
    email,
    licenseKey,
    activatedAt: now,
    expiresAt: null,
    trialStartedAt: now,
    seats: 1,
  }
  saveLicense(info)
  return info
}

/** 激活 Pro 授权 */
export function activatePro(licenseKey: string, email: string): { success: boolean; message: string; info?: LicenseInfo } {
  const validation = validateLicenseKey(licenseKey)
  if (!validation.valid) {
    return { success: false, message: '授权码格式无效，应为 METAGO-PRO-XXXX-XXXX-XXXX' }
  }
  const now = new Date().toISOString()
  const info: LicenseInfo = {
    tier: validation.tier,
    email,
    licenseKey: licenseKey.trim().toUpperCase(),
    activatedAt: now,
    expiresAt: null, // 永久授权（云端校验过期）
    trialStartedAt: null,
    seats: validation.tier === 'team' ? 5 : 1,
  }
  saveLicense(info)
  return { success: true, message: `${TIER_INFO[validation.tier].name} 激活成功`, info }
}

/** 取消授权（降级到 Free） */
export function deactivateLicense(): void {
  clearLicense()
}
