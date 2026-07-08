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
  | '验证'
  | '质量'
  | '自律'
  | '意识'
  | '方法论'
  | '组织'
  | '记忆'
  | '共识'

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
  /** true=硬校验(Pro，问题即阻断)，false=软校验(Free，仅警告不阻断) */
  hardMode: boolean
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

// ============ Agent 智能体类型 ============

/** Agent 文件树节点 */
export interface AgentFileNode {
  id: string
  name: string
  type: 'file' | 'folder'
  language?: string
  content?: string
  children?: AgentFileNode[]
}

// ============ Agent AI 模块类型 ============

/** 模型类别 */
export type ModelCategory = 'reasoning' | 'multimodal' | 'custom'

/** 模型能力标签 */
export type ModelCapability = 'text' | 'image' | 'video' | 'file' | 'code' | 'code-review' | 'reasoning'

/** 内置模型定义 */
export interface BuiltinModel {
  id: string
  name: string
  type: 'builtin'
  category: ModelCategory
  capabilities: ModelCapability[]
  contextWindow: number
  description: string
}

/** 用户自定义模型 */
export interface CustomModel {
  id: string
  name: string
  type: 'custom'
  category: ModelCategory
  provider: 'openai-compatible' | 'anthropic-compatible'
  baseUrl: string
  apiKey: string          // AES-GCM 加密存储
  modelId: string         // 实际模型名
  capabilities: ModelCapability[]
  contextWindow?: number
}

/** 统一模型类型 */
export type AIModel = BuiltinModel | CustomModel

/** 对话消息角色 */
export type ChatRole = 'system' | 'user' | 'assistant'

/** 对话消息（支持多模态） */
export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  timestamp: string
  /** 关联的代码片段（用户选中代码发送时填充） */
  codeContext?: {
    fileName: string
    language: string
    code: string
    lineRange?: { start: number; end: number }
  }
  /** AI 回复的思考过程（部分模型支持） */
  reasoning?: string
  /** 该消息触发的联网搜索 */
  searchResults?: SearchResult[]
  /** 流式输出状态 */
  streaming?: boolean
  /** 出错信息 */
  error?: string
  /** 使用的模型 ID */
  modelId?: string
  /** V3 对标 Trae 回退版本：发送此消息前的工作区快照（git stash ref）
   *  仅桌面端 + 已打开工作区 + 工作区是 git 仓库时填充
   *  用户点击"回退到此对话前"按钮时，执行 git stash apply 恢复
   */
  workspaceSnapshot?: {
    stashRef: string
    branch: string
    timestamp: string
    /** 改动文件数（用于 UI 显示） */
    changedFiles: number
  }
}

/** 联网搜索结果 */
export interface SearchResult {
  title: string
  url: string
  snippet: string
  source?: string
}

/** 联网判断结果 */
export interface SearchDecision {
  shouldSearch: boolean
  query?: string
  reason?: string
}

/** 联网模式 */
export type SearchMode = 'auto' | 'always' | 'never'

// ============ Sprint 3：审查看板 ============

/** 风险等级（与 AI 提示词约定） */
export type Severity = 'critical' | 'major' | 'minor' | 'info'

/** 结构化审查问题（从 AI 输出解析得到） */
export interface ReviewIssue {
  id: string
  severity: Severity
  /** 问题定位：文件名 */
  fileName?: string
  /** 问题定位：行号范围 */
  lineRange?: { start: number; end: number }
  /** 问题描述 */
  description: string
  /** 修复建议（含代码） */
  suggestion?: string
  /** 原理说明 */
  rationale?: string
}

/** 审查看板数据：一条 AI 审查回复 + 解析出的问题列表 + 决策锁记录 */
export interface ReviewSession {
  id: string
  messageId: string
  timestamp: string
  issues: ReviewIssue[]
  /** 关联的决策锁校验记录 ID */
  decisionLockId?: string
}

// ============ 行为银行（Behavior Bank）类型 ============

/** 行为大类：数字行为（用户人工行为） / AI行为（AI 自动行为） */
export type BehaviorType = 'digital' | 'ai'

/**
 * 行为类别枚举
 * - digital: 用户数字贡献
 * - ai: AI 自主行为
 */
export type BehaviorCategory =
  // digital 类
  | 'code_contribution'   // 代码贡献
  | 'doc_contribution'     // 文档贡献
  | 'community_help'       // 社区帮助
  | 'skill_creation'       // 技能创建
  | 'bug_report'           // Bug 上报
  | 'template_run'         // 模板运行
  // ai 类
  | 'decision_lock_pass'   // 决策锁通过
  | 'decision_lock_block'  // 决策锁阻断（扣分）
  | 'evolution_iteration'  // 元进化迭代
  | 'compliance_check'     // 合规检查
  | 'provenance_trace'     // 溯源完整
  | 'skill_call'           // 技能调用
  | 'output_integrity'     // 输出完整性校验

/** 单条行为记录 */
export interface BehaviorRecord {
  id: string
  uid: string
  type: BehaviorType
  category: BehaviorCategory
  action: string
  /** 行为价值（信用分增量，可为负数表示扣分） */
  value: number
  /** 行为元数据（行为详情） */
  metadata: Record<string, unknown>
  timestamp: string
  source: string
}

/** 信用等级 ID */
export type CreditLevelId = 'apprentice' | 'artisan' | 'expert' | 'master' | 'grandmaster'

/** 信用等级元信息 */
export interface CreditLevel {
  id: CreditLevelId
  name: string          // 中文名：元构学徒 / 匠人 / 专家 / 大师 / 宗师
  minScore: number      // 等级最低分
  maxScore: number      // 等级最高分（含）
  icon: string          // lucide 图标名
  color: string         // tailwind 主题色
  description: string
  privileges: string[]  // 该等级特权列表
}

/** 信用分快照 */
export interface CreditScore {
  uid: string
  totalScore: number
  digitalScore: number
  aiScore: number
  level: CreditLevelId
  levelName: string
  nextLevelName: string | null
  nextLevelMinScore: number | null
  /** 距离下一级还差多少分 */
  scoreToNextLevel: number | null
  /** 当前进度百分比（0-100） */
  progressPercent: number
  stats: {
    totalRecords: number
    digitalRecords: number
    aiRecords: number
    decisionLockPasses: number
    decisionLockBlocks: number
    evolutionIterations: number
    complianceChecks: number
    provenanceTraces: number
    skillCalls: number
    codeContributions: number
    docContributions: number
    communityHelps: number
    skillCreations: number
    bugReports: number
    templateRuns: number
  }
  updatedAt: string
}

/** 信用分历史条目（按时间聚合） */
export interface CreditHistoryEntry {
  date: string      // YYYY-MM-DD
  scoreDelta: number
  totalScore: number
  recordsCount: number
}

/** 排行榜条目 */
export interface LeaderboardEntry {
  rank: number
  uid: string
  displayName: string
  totalScore: number
  level: CreditLevelId
  levelName: string
  recordsCount: number
}

