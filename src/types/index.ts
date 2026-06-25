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
