/**
 * MetaGO Agent 统一定价模型 V3（2026-07-06）
 *
 * 商业模式：混合模式（订阅含额度 + 时薪计量 + 席位计费 + BYOK 降级 + 超额付费）
 * 业界对标：Cursor Credit / Copilot AI Credits / Trae Token / Anthropic 时薪 / Qoder Credits
 *
 * 五档定价：
 *   - Free        ¥0       10万 tokens/天（V4 Flash）       无 BYOK
 *   - Pro         ¥39/月   500万 tokens/月（V4 Pro）       超额替代 BYOK
 *   - Pro+        ¥99/月   2000万 tokens/月 + 行为银行信用  超额替代 BYOK
 *   - Team        ¥199/月起 5席 + 500小时数字员工时长 + 决策锁可视化 + 行为银行
 *                        超出 500 小时部分 ¥0.5/小时
 *   - Enterprise  ¥3万/年起 5席 + 强制 BYOK + 私有部署
 *                        加席 ¥6000/席位/年
 *
 * 计费基础：DeepSeek V4 Pro 价格
 *   - 缓存命中输入：0.025 元/百万
 *   - 缓存未命中输入：3 元/百万
 *   - 输出：6 元/百万
 *   - 高峰时段（9-12, 14-18点）翻倍
 */

export type PlanTier = 'free' | 'pro' | 'pro_plus' | 'team' | 'enterprise'

export interface PricingPlan {
  tier: PlanTier
  name: string
  price: number
  pricePeriod: 'none' | 'month' | 'year'
  priceDisplay: string
  /** Token 月/日配额；-1 表示强制 BYOK（不消耗平台额度）；0 表示无配额 */
  tokenQuota: number
  tokenQuotaPeriod: 'day' | 'month' | 'year'
  tokenQuotaDisplay: string
  byokAllowed: boolean
  byokRequired: boolean
  /** 超额单价（元/百万 tokens），0 表示不允许超额 */
  overagePricePerMillion: number
  hardValidation: boolean
  /** 行为银行信用（Pro+ 及以上） */
  behaviorBankEnabled: boolean
  /** 决策锁可视化（Team 及以上） */
  decisionLockVisualization: boolean
  /** 数字员工席位（仅 Enterprise） */
  seats: number
  /** 数字员工时长（小时/月，Team 及以上，0 表示不适用） */
  digitalEmployeeHours: number
  /** 超出时薪（元/小时，0 表示不适用） */
  overageHourlyRate: number
  features: string[]
}

export const PRICING_PLANS: Record<PlanTier, PricingPlan> = {
  free: {
    tier: 'free',
    name: '社区版',
    price: 0,
    pricePeriod: 'none',
    priceDisplay: '¥0',
    tokenQuota: 100_000,
    tokenQuotaPeriod: 'day',
    tokenQuotaDisplay: '10万 tokens/天',
    byokAllowed: false,
    byokRequired: false,
    overagePricePerMillion: 0,
    hardValidation: false,
    behaviorBankEnabled: false,
    decisionLockVisualization: false,
    seats: 1,
    digitalEmployeeHours: 0,
    overageHourlyRate: 0,
    features: [
      '8 公理 + 7 属性 + 43 条根本属性',
      '39 个 metago-* 技能',
      '7 平台适配器',
      'MCP Server（53 tools）',
      '决策锁软校验（提示词驱动）',
      'AI 对话 10万 tokens/天（DeepSeek V4 Flash）',
    ],
  },
  pro: {
    tier: 'pro',
    name: 'Pro 个人版',
    price: 39,
    pricePeriod: 'month',
    priceDisplay: '¥39/月',
    tokenQuota: 5_000_000,
    tokenQuotaPeriod: 'month',
    tokenQuotaDisplay: '500万 tokens/月',
    byokAllowed: true,
    byokRequired: false,
    overagePricePerMillion: 5,
    hardValidation: true,
    behaviorBankEnabled: false,
    decisionLockVisualization: false,
    seats: 1,
    digitalEmployeeHours: 0,
    overageHourlyRate: 0,
    features: [
      '社区版全部功能',
      '500万 tokens/月（DeepSeek V4 Pro + GLM-5V Turbo）',
      '决策锁强制校验（硬逻辑）',
      '元进化档案（自动记录）',
      '能力度量仪表盘（10 维雷达）',
      '跨平台同步（7 平台 + MCP）',
      '私有技能库（端到端加密）',
      'BYOK 超额降级（绑自己 Key 零超额费）',
      '优先支持（72h 响应）',
    ],
  },
  pro_plus: {
    tier: 'pro_plus',
    name: 'Pro+ 进阶版',
    price: 99,
    pricePeriod: 'month',
    priceDisplay: '¥99/月',
    tokenQuota: 20_000_000,
    tokenQuotaPeriod: 'month',
    tokenQuotaDisplay: '2000万 tokens/月',
    byokAllowed: true,
    byokRequired: false,
    overagePricePerMillion: 5,
    hardValidation: true,
    behaviorBankEnabled: true,
    decisionLockVisualization: false,
    seats: 1,
    digitalEmployeeHours: 0,
    overageHourlyRate: 0,
    features: [
      'Pro 个人版全部功能',
      '2000万 tokens/月（4 倍 Pro 额度）',
      '行为银行信用（数字行为价值记录）',
      '行为价值面板（可视化）',
      '决策锁深度分析（含跨次对比）',
      '元进化高级档案（多维度趋势）',
      '能力度量高级仪表盘（行业基准）',
      'BYOK 超额降级（零超额费用）',
      '优先支持（48h 响应）',
    ],
  },
  team: {
    tier: 'team',
    name: 'Pro 团队版',
    price: 199,
    pricePeriod: 'month',
    priceDisplay: '¥199/月起',
    tokenQuota: 20_000_000,
    tokenQuotaPeriod: 'month',
    tokenQuotaDisplay: '2000万 tokens/月（5人共享）',
    byokAllowed: true,
    byokRequired: false,
    overagePricePerMillion: 4,
    hardValidation: true,
    behaviorBankEnabled: true,
    decisionLockVisualization: true,
    seats: 5,
    digitalEmployeeHours: 500,
    overageHourlyRate: 0.5,
    features: [
      'Pro+ 进阶版全部功能',
      '5 席位 + 2000万 tokens/月（团队共享池）',
      '500 小时数字员工时长/月（超出 ¥0.5/小时）',
      '决策锁可视化（团队对比）',
      '行为银行信用（团队账户）',
      '团队仪表盘（成员对比）',
      '统一规范配置',
      '进化档案团队版',
      'BYOK 管理员配置',
      '专属客户成功经理',
    ],
  },
  enterprise: {
    tier: 'enterprise',
    name: '企业版',
    price: 30000,
    pricePeriod: 'year',
    priceDisplay: '¥3万/年起',
    tokenQuota: 0,
    tokenQuotaPeriod: 'year',
    tokenQuotaDisplay: '强制 BYOK',
    byokAllowed: true,
    byokRequired: true,
    overagePricePerMillion: 0,
    hardValidation: true,
    behaviorBankEnabled: true,
    decisionLockVisualization: true,
    seats: 5,
    digitalEmployeeHours: 0,
    overageHourlyRate: 0,
    features: [
      '团队版全部功能',
      '5 个数字员工席位（含）',
      '加席 ¥6000/席位/年',
      '强制 BYOK（数据不出企业，零 Token 费用）',
      '私有化部署',
      '定制化开发',
      '99.9% SLA 保障',
      '组织转型咨询服务',
      'AI 治理咨询服务',
      '元构范式合规认证（L2 含）',
    ],
  },
}

export const TOKEN_PRICING = {
  V4_PRO_CACHE_HIT_INPUT: 0.025,
  V4_PRO_CACHE_MISS_INPUT: 3,
  V4_PRO_OUTPUT: 6,
  V4_FLASH_CACHE_HIT_INPUT: 0.02,
  V4_FLASH_CACHE_MISS_INPUT: 1,
  V4_FLASH_OUTPUT: 2,
  PEAK_MULTIPLIER: 2,
  PEAK_HOURS: [
    { start: 9, end: 12 },
    { start: 14, end: 18 },
  ],
  OVERAGE_MARKUP: 1.4,
} as const

/** 团队版数字员工时长单价 */
export const TEAM_HOURS_QUOTA = 500
export const TEAM_HOURS_OVERAGE_RATE = 0.5

/** 企业版基础席位数 */
export const ENTERPRISE_BASE_SEATS = 5
export const ENTERPRISE_SEAT_PRICE = 6000

/** 检查当前是否在高峰时段（北京时间 9-12, 14-18 点） */
export function isPeakHours(date = new Date()): boolean {
  const hour = date.getHours()
  return TOKEN_PRICING.PEAK_HOURS.some(range => hour >= range.start && hour < range.end)
}

/** 计算单次对话成本（元） */
export function calculateChatCost(
  inputTokens: number,
  outputTokens: number,
  cacheHitRatio = 0.5,
  useFlash = false,
  peak = false,
): number {
  const base = useFlash
    ? {
        hit: TOKEN_PRICING.V4_FLASH_CACHE_HIT_INPUT,
        miss: TOKEN_PRICING.V4_FLASH_CACHE_MISS_INPUT,
        out: TOKEN_PRICING.V4_FLASH_OUTPUT,
      }
    : {
        hit: TOKEN_PRICING.V4_PRO_CACHE_HIT_INPUT,
        miss: TOKEN_PRICING.V4_PRO_CACHE_MISS_INPUT,
        out: TOKEN_PRICING.V4_PRO_OUTPUT,
      }
  const multiplier = peak ? TOKEN_PRICING.PEAK_MULTIPLIER : 1
  const inputCost =
    (inputTokens * cacheHitRatio * base.hit + inputTokens * (1 - cacheHitRatio) * base.miss) /
    1_000_000
  const outputCost = (outputTokens * base.out) / 1_000_000
  return (inputCost + outputCost) * multiplier
}

/** BYOK 策略查询 */
export function getByokPolicy(tier: PlanTier): { allowed: boolean; required: boolean } {
  const plan = PRICING_PLANS[tier]
  return { allowed: plan.byokAllowed, required: plan.byokRequired }
}

/** 超额策略查询 */
export function getOveragePolicy(tier: PlanTier): {
  allowed: boolean
  pricePerMillion: number
} {
  const plan = PRICING_PLANS[tier]
  return {
    allowed: plan.overagePricePerMillion > 0,
    pricePerMillion: plan.overagePricePerMillion,
  }
}

/** 获取指定档位的 Token 配额（按当前周期） */
export function getTokenQuota(tier: PlanTier, period: 'day' | 'month' | 'year' = 'month'): number {
  const plan = PRICING_PLANS[tier]
  if (plan.tokenQuota <= 0) return 0
  return plan.tokenQuotaPeriod === period ? plan.tokenQuota : 0
}

/** 配额显示文案 */
export function getQuotaDisplay(tier: PlanTier): string {
  return PRICING_PLANS[tier].tokenQuotaDisplay
}

/** 各档位 Token 配额常量（便于直接引用） */
export const FREE_DAILY_TOKEN_QUOTA = 100_000
export const PRO_MONTHLY_TOKEN_QUOTA = 5_000_000
export const PRO_PLUS_MONTHLY_TOKEN_QUOTA = 20_000_000
export const TEAM_MONTHLY_TOKEN_QUOTA = 20_000_000
