// MetaGO Studio 类型定义

/** 技能分类 */
export type SkillCategory = 'core' | 'dev'

/** 技能标签（用于详情展示，不参与主筛选） */
export type SkillTag =
  | '批判'
  | '决策'
  | '溯源'
  | '输出'
  | '元认知'
  | '适配'
  | '推演'
  | '代码'
  | '架构'
  | '安全'

/** 单个技能的元信息 */
export interface Skill {
  /** 技能 ID，等价于目录名，如 metago-critique */
  id: string
  /** 中文短标题，如 批判性分析 */
  title: string
  /** 简短描述（用于列表展示） */
  description: string
  /** 详细说明（展开时显示） */
  detail: string
  /** 主分类 */
  category: SkillCategory
  /** 子标签 */
  tags: SkillTag[]
  /** 预估技能包大小（字节） */
  estimatedSize: number
}

/** Kit 类型 */
export type KitType = 'vertical-kit' | 'workflow' | 'standalone'

/** 垂直领域 */
export type VerticalDomain = 'developer' | 'research' | 'product' | 'writing' | 'general'

/** Kit 配置项 */
export interface KitConfigState {
  name: string
  version: string
  description: string
  type: KitType
  vertical: VerticalDomain
}

/** 预览内容类型 */
export type PreviewType = 'package.json' | 'README.md' | 'kit-config.json'

/** 预览模态框状态 */
export interface PreviewState {
  open: boolean
  type: PreviewType | null
  content: string
  filename: string
}

// ============ Studio MVP 新增类型 ============

/** 决策锁四道关卡类型 */
export type DecisionLockStageId = 'ivl' | 'ilt' | 'osg' | 'integrity'

/** 决策锁单道关卡状态 */
export interface DecisionLockStage {
  id: DecisionLockStageId
  name: string
  fullName: string
  description: string
  passed: boolean
  durationMs: number
  details: { label: string; value: string; ok: boolean }[]
}

/** 决策锁校验记录 */
export interface DecisionLockRecord {
  id: string
  timestamp: string
  input: string
  stages: DecisionLockStage[]
  totalDurationMs: number
  passed: boolean
  blockedReason?: string
}

/** 进化阶段 */
export type EvolutionStageId = 'boundary' | 'gap' | 'generate' | 'verify' | 'recurse'

/** 进化记录 */
export interface EvolutionRecord {
  id: string
  timestamp: string
  trigger: string
  boundary: string
  gap: string
  generated: string
  verified: boolean
  recursed: boolean
  durationMs: number
  depth: number
}

/** 能力维度（10 维雷达图） */
export interface AbilityDimension {
  dimension: string
  score: number
  fullMark: number
}

/** 进化统计 */
export interface EvolutionStats {
  totalEvolutions: number
  last7Days: number
  last30Days: number
  last90Days: number
  last365Days: number
  successRate: number
  averageDurationMs: number
  dimensions: AbilityDimension[]
  dailyCounts: { date: string; count: number }[]
}

/** 最近活动 */
export interface Activity {
  id: string
  timestamp: string
  type: 'decision_lock' | 'evolution' | 'template_run' | 'skill_call'
  title: string
  description: string
  status: 'success' | 'blocked' | 'pending'
}

/** 场景模板 */
export interface SceneTemplate {
  id: string
  name: string
  icon: string
  description: string
  category: 'code' | 'risk' | 'evolution' | 'compliance' | 'architecture' | 'provenance'
  skills: string[]
  steps: { name: string; description: string; durationMs: number }[]
  estimatedDuration: string
  proOnly: boolean
}

/** 模板运行结果 */
export interface TemplateRunResult {
  templateId: string
  timestamp: string
  passed: boolean
  stages: { name: string; status: 'running' | 'success' | 'failed'; output: string }[]
}

/** Dashboard 概览统计 */
export interface DashboardStats {
  totalSkills: number
  totalEvolutions: number
  decisionLockPassRate: number
  totalValidations: number
  totalBlocked: number
  totalTemplateRuns: number
}

