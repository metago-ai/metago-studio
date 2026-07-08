/**
 * Agent 自省模块（Self-Reflection Module）
 *
 * 对标 Trae 的工具注册表自感知能力。
 * AI 不靠 system prompt 硬编码数字，而是通过此模块运行时动态查询自身状态。
 *
 * 三层自知：
 * 1. 工具层：通过 get_agent_info 工具查询实时工具清单、分类、数量
 * 2. 环境层：通过 EnvironmentContext 自动注入（systemPrompt.ts 处理）
 * 3. 记忆层：通过 agentMemory 查询项目级历史知识
 */

import { AGENT_TOOLS, type ToolExecutionContext } from './systemPrompt'
import { SKILLS } from '../skillRegistry'
import { findModel, DEFAULT_MODEL_ID } from '../modelRegistry'
import { isByokActive } from '../byokService'

export interface AgentSelfInfo {
  /** 工具总数（实时从 AGENT_TOOLS 派生） */
  totalTools: number
  /** 工程工具数（非 MCP） */
  engineeringToolsCount: number
  /** MCP 元认知工具数 */
  mcpToolsCount: number
  /** 元构技能数（与 MCP 工具同源，连字符命名变体） */
  skillsCount: number
  /** 工具分类明细 */
  categories: Array<{
    name: string
    count: number
    tools: Array<{ name: string; description: string }>
  }>
  /** 运行时环境 */
  runtime: {
    platform: 'web' | 'desktop'
    workspacePath?: string
    workspaceName?: string
    projectType?: string
    activeFileName?: string
    activeFileLanguage?: string
    hasSelectedCode: boolean
    selectedLineRange?: { start: number; end: number }
    activeSkills: string[]
    currentRoleId?: string
    isByokActive: boolean
  }
  /** 当前模型 */
  model: {
    id: string
    name: string
    provider: string
    contextWindow: number
  }
  /** 版本信息 */
  version: {
    agentVersion: string
    buildTime: string
    engineVersion: string
  }
}

/**
 * 获取 Agent 实时自省信息
 *
 * 这是 AI 自知的真相源——不来自 prompt 字符串，来自运行时代码状态。
 */
export async function getAgentSelfInfo(
  ctx?: ToolExecutionContext,
  envContext?: {
    workspacePath?: string
    workspaceName?: string
    projectType?: string
    activeFileName?: string
    activeFileLanguage?: string
    selectedCode?: string
    selectedLineRange?: { start: number; end: number }
    activeSkills?: string[]
    currentRoleId?: string
  },
): Promise<AgentSelfInfo> {
  // 1. 工具分类明细（从 AGENT_TOOLS 实时派生）
  const categoryMap = new Map<string, typeof AGENT_TOOLS>()
  for (const tool of AGENT_TOOLS) {
    if (!categoryMap.has(tool.category)) categoryMap.set(tool.category, [] as any)
    ;(categoryMap.get(tool.category) as any).push(tool)
  }

  const categories = Array.from(categoryMap.entries()).map(([name, tools]) => ({
    name,
    count: tools.length,
    tools: tools.map(t => ({ name: t.name, description: t.description })),
  }))

  // 2. 工程工具 vs MCP 工具
  const engineeringTools = AGENT_TOOLS.filter(t => t.category !== 'MCP 智能工具')
  const mcpTools = AGENT_TOOLS.filter(t => t.category === 'MCP 智能工具')

  // 3. 当前模型
  const model = findModel(DEFAULT_MODEL_ID)

  // 4. 平台检测
  const isDesktop = ctx?.isDesktop ?? (typeof window !== 'undefined' && !!(window as any).electronAPI)

  return {
    totalTools: AGENT_TOOLS.length,
    engineeringToolsCount: engineeringTools.length,
    mcpToolsCount: mcpTools.length,
    skillsCount: SKILLS.length,
    categories,
    runtime: {
      platform: isDesktop ? 'desktop' : 'web',
      workspacePath: envContext?.workspacePath ?? ctx?.workspacePath,
      workspaceName: envContext?.workspaceName,
      projectType: envContext?.projectType,
      activeFileName: envContext?.activeFileName,
      activeFileLanguage: envContext?.activeFileLanguage,
      hasSelectedCode: Boolean(envContext?.selectedCode?.trim()),
      selectedLineRange: envContext?.selectedLineRange,
      activeSkills: envContext?.activeSkills ?? [],
      currentRoleId: envContext?.currentRoleId,
      isByokActive: isByokActive(),
    },
    model: {
      id: model?.id ?? DEFAULT_MODEL_ID,
      name: model?.name ?? 'DeepSeek V4 Pro',
      provider: model?.type === 'custom' ? (model as any).provider ?? 'custom' : 'deepseek',
      contextWindow: model?.contextWindow ?? 128000,
    },
    version: {
      agentVersion: '2.0.0',
      buildTime: new Date().toISOString(),
      engineVersion: 'V36.8',
    },
  }
}

/**
 * 格式化自省信息为 AI 可读的文本
 * 当 AI 调用 get_agent_info 工具时返回此文本
 */
export async function formatAgentSelfInfo(
  ctx?: ToolExecutionContext,
  envContext?: Parameters<typeof getAgentSelfInfo>[1],
): Promise<string> {
  const info = await getAgentSelfInfo(ctx, envContext)

  const lines: string[] = [
    '# MetaGO Agent 实时自省信息',
    '',
    '## 工具能力（运行时从代码注册表派生，永远准确）',
    `- **工具总数**：${info.totalTools}`,
    `  - 工程工具：${info.engineeringToolsCount}`,
    `  - MCP 元认知工具：${info.mcpToolsCount}`,
    `  - 元构技能（SKILLS）：${info.skillsCount}（与 MCP 工具同源，连字符命名变体）`,
    '',
    '## 工具分类明细',
  ]

  for (const cat of info.categories) {
    lines.push(`### ${cat.name}（${cat.count} 个）`)
    for (const t of cat.tools) {
      lines.push(`- \`${t.name}\` - ${t.description}`)
    }
    lines.push('')
  }

  lines.push(
    '## 运行时环境',
    `- **平台**：${info.runtime.platform === 'desktop' ? '桌面端（Electron）' : 'Web 端（浏览器）'}`,
    `- **工作区**：${info.runtime.workspacePath ?? '未打开'}`,
    `- **项目名称**：${info.runtime.workspaceName ?? '无'}`,
    `- **项目类型**：${info.runtime.projectType ?? '未识别'}`,
    `- **当前打开的文件**：${info.runtime.activeFileName ? `${info.runtime.activeFileName} (${info.runtime.activeFileLanguage})` : '无'}`,
    `- **是否有选中代码**：${info.runtime.hasSelectedCode ? '是' + (info.runtime.selectedLineRange ? `（行 ${info.runtime.selectedLineRange.start}-${info.runtime.selectedLineRange.end}）` : '') : '否'}`,
    `- **已激活技能**：${info.runtime.activeSkills.length > 0 ? info.runtime.activeSkills.join(', ') : '无'}`,
    `- **当前 AI 角色**：${info.runtime.currentRoleId ?? 'general（通用）'}`,
    `- **BYOK 模式**：${info.runtime.isByokActive ? '已激活（用户自带 Key）' : '未激活（使用平台配额）'}`,
    '',
    '## 当前模型',
    `- **模型 ID**：${info.model.id}`,
    `- **模型名称**：${info.model.name}`,
    `- **供应商**：${info.model.provider}`,
    `- **上下文窗口**：${(info.model.contextWindow / 1000).toFixed(0)}K tokens`,
    '',
    '## 版本信息',
    `- **Agent 版本**：${info.version.agentVersion}`,
    `- **构建时间**：${info.version.buildTime}`,
    `- **引擎版本**：${info.version.engineVersion}`,
    '',
    '## 使用说明',
    '以上信息全部从运行时代码状态实时派生，不依赖 prompt 字符串硬编码。',
    '当用户询问"你有多少工具""你能做什么""你是什么模型"等问题时，调用此工具获取准确答案。',
  )

  return lines.join('\n')
}
