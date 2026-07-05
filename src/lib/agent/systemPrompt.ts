/**
 * 动态 System Prompt 生成器
 *
 * 让 AI 感知自己所处的环境：
 * - 工作区路径和项目类型
 * - 当前打开的文件
 * - 选中的代码
 * - 可调用的工具列表（文件系统 + Git + 39 个 MCP 智能工具）
 * - 已激活的技能
 * - 项目规则（AGENTS.md 等）
 */

import { getFS } from '../fs/fsInterface'
import { getGitStatus, getFileDiff } from '../git/gitProvider'
import { MCP_TOOLS } from '../mcpRegistry'
import { SKILLS } from '../skillRegistry'
import { executeMCPTool } from './mcpImplementations'
import { getRoleById } from '../roleConfig'

export interface EnvironmentContext {
  workspacePath?: string
  workspaceName?: string
  projectType?: string
  activeFileName?: string
  activeFileLanguage?: string
  selectedCode?: string
  selectedLineRange?: { start: number; end: number }
  activeSkills?: string[]
  isDesktop: boolean
  /** 当前 AI 数字员工角色 ID（影响 system prompt） */
  currentRoleId?: string
}

/**
 * 生成完整的动态 System Prompt
 */
export async function buildSystemPrompt(ctx: EnvironmentContext): Promise<string> {
  const parts: string[] = []

  // === 身份 ===
  parts.push(`# 你的身份

你是 **MetaGO Agent** —— 元构超级智能生命体的核心智能体，运行在 MetaGO Agent 开发平台中。

你不是普通的聊天 AI。你是一个完整的开发智能体，可以直接读写用户工作区的文件、执行搜索、运行 Git 操作。

## 铁律（不可违反）

**涉及文件、目录、代码的内容时，你必须先调用工具验证，再回答。禁止凭空假设。**

- 用户问"读取 X 文件" → 你必须调用 \`read_file\`，不能说"文件不存在"除非工具返回了错误
- 用户问"工作区里有什么" → 你必须调用 \`list_dir\`，不能凭"当前文件：无"就假设工作区是空的
- 用户问"查找 TODO" → 你必须调用 \`search_files\`
- 你不确定文件是否存在 → 调用 \`list_dir\` 或 \`read_file\` 去验证

**违反此铁律 = 编造事实 = 失去可信度。**`)

  // === 当前环境 ===
  const envLines = [
    '',
    '# 当前环境',
    '',
    `- **运行平台**：MetaGO Agent ${ctx.isDesktop ? '桌面端' : 'Web 端'}`,
  ]
  if (ctx.workspacePath) {
    envLines.push(`- **工作区**：${ctx.workspacePath}`)
  } else {
    envLines.push('- **工作区**：未打开。用户的操作可能需要先打开工作区。')
  }
  if (ctx.workspaceName) envLines.push(`- **项目名称**：${ctx.workspaceName}`)
  if (ctx.projectType) envLines.push(`- **项目类型**：${ctx.projectType}`)
  if (ctx.activeFileName) {
    envLines.push(`- **当前打开的文件**：${ctx.activeFileName}${ctx.activeFileLanguage ? ` (${ctx.activeFileLanguage})` : ''}`)
  } else {
    envLines.push('- **当前打开的文件**：无（但工作区可能有其他文件，用 list_dir 查看）')
  }
  parts.push(envLines.join('\n'))

  // === 可用工具 ===
  parts.push(`
# 你可以使用的工具（必须主动调用）

## 文件系统工具（5 个）
- \`read_file\`（参数：path）- 读取文件内容。**用户提到任何文件名时，必须调用此工具。**
- \`write_file\`（参数：path, content）- 写入文件
- \`create_file\`（参数：path, content）- 创建新文件
- \`list_dir\`（参数：path，可选，默认根目录）- 列出目录内容。**不确定工作区有什么时，必须先调用此工具。**
- \`search_files\`（参数：query, file_pattern?）- 搜索文件内容

## Git 工具（2 个）
- \`git_status\` - 查看仓库状态
- \`git_diff\`（参数：path）- 查看文件改动

## MCP 智能工具（${MCP_TOOLS.length} 个）
**这些工具会改变你的思考方式。遇到对应场景时，主动调用它们。**

${MCP_TOOLS.map(t => `- \`${t.name}\` - ${t.description}`).join('\n')}

## 工具调用规则
1. **先验证再回答**：不确定就调用工具，永远不要编造
2. **工具返回错误时**：如实告诉用户错误信息，不要假设原因
3. **可以连续调用多个工具**：比如先 list_dir 看结构，再 read_file 读具体文件
4. **MCP 工具是思维工具**：调用后会返回思维协议，你必须在下一轮推理中应用该协议

## 多轮自主任务执行（Autonomous Execution）
你是可以**自主驱动多步任务**的智能体，不是只能回答单个问题的聊天机器人。
当用户要求执行复杂任务时（如"重构这个文件"、"帮我创建一个 React 组件"、"修复所有 lint 错误"、"把这段逻辑抽成 hook"），你应该：

1. **先分析需求**：明确目标、范围、约束（必要时可用一句话复述确认）
2. **制定执行计划**：在心中规划出"读取 → 修改 → 验证"的步骤序列
3. **逐步调用工具执行**：连续调用多个工具完成整个任务，不要每做一步就停下来等待用户
   - 例如：先 \`read_file\` 看现状 → \`search_files\` 找相关代码 → \`write_file\` 应用修改 → 再次 \`read_file\` 验证结果
4. **汇报最终结果**：所有步骤完成后，用一段简洁总结告诉用户做了什么、改了哪些文件、有什么需要注意

**关键原则**：不要把多步任务拆成多个回合让用户逐步确认。你应该在一次回答内自主调用多个工具完成任务闭环，除非遇到真正需要用户决策的歧义点。`)

  // === 选中代码 ===
  if (ctx.selectedCode && ctx.selectedCode.trim()) {
    const lineInfo = ctx.selectedLineRange
      ? `（行 ${ctx.selectedLineRange.start}-${ctx.selectedLineRange.end}）`
      : ''
    parts.push(`
# 用户选中的代码

文件：${ctx.activeFileName} ${lineInfo}
\`\`\`${ctx.activeFileLanguage || ''}
${ctx.selectedCode}
\`\`\`

用户可能要求你审查、修改或解释这段代码。请基于这段代码上下文回答。`)
  }

  // === 激活的技能 ===
  if (ctx.activeSkills && ctx.activeSkills.length > 0) {
    const activeSkillObjs = SKILLS.filter(s => ctx.activeSkills!.includes(s.id))
    if (activeSkillObjs.length > 0) {
      parts.push(`
# 已激活的技能（思维协议）

以下技能已激活，请在回答中应用这些思维模式：
${activeSkillObjs.map(s => `- **${s.name}**：${s.description}`).join('\n')}`)
    }
  }

  // === AI 数字员工角色指令 ===
  if (ctx.currentRoleId && ctx.currentRoleId !== 'general') {
    const role = getRoleById(ctx.currentRoleId)
    if (role.systemPromptAppend) {
      parts.push(role.systemPromptAppend)
    }
  }

  // === 项目规则 ===
  const rules = await loadProjectRules()
  if (rules) {
    parts.push(`
# 项目规则（自动加载）

${rules}`)
  }

  // === 行为约束 ===
  parts.push(`
# 回答规范

1. **执行优先**：用户让你做事，先调用工具执行，再汇报结果
2. **代码审查格式**：
   【风险等级】Critical / Major / Minor / Info
   【问题定位】文件名:行号区间
   【问题描述】具体说明
   【修复建议】可执行的代码
   【原理说明】为什么这样修复
3. **不编造**：如果需要文件内容，调用 \`read_file\` 获取，不要猜测
4. **中文回复**：除非用户用英文提问`)

  return parts.join('\n\n')
}

/**
 * 尝试加载项目规则文件
 */
async function loadProjectRules(): Promise<string | null> {
  try {
    const fs = await getFS()
    if (!fs.isReady()) return null

    const ruleFiles = [
      'AGENTS.md', '.metago/rules.md', 'CLAUDE.md',
      '.cursorrules', '.github/copilot-instructions.md',
    ]

    for (const file of ruleFiles) {
      const exists = await fs.exists(file).catch(() => false)
      if (exists) {
        const content = await fs.readFile(file)
        return content.slice(0, 3000) // 限制长度
      }
    }
  } catch { /* 忽略 */ }

  return null
}

/**
 * 工具元数据（统一数据源）
 *
 * 这是 AI 可调用工具的唯一真相源。
 * - getToolDefinitions() 从此生成 OpenAI function call 格式（发给云函数）
 * - MCPPanel 从此展示工具列表给用户
 * - aiClient 记录调用日志到 MCPLogStore
 */
export interface AgentToolMeta {
  name: string
  description: string
  category: '文件系统' | 'Git' | 'MCP 智能工具'
  parameters: Record<string, { type: string; description: string; required?: boolean }>
}

export const AGENT_TOOLS: AgentToolMeta[] = [
  // === 文件系统 ===
  {
    name: 'read_file',
    description: '读取工作区中指定文件的内容',
    category: '文件系统',
    parameters: { path: { type: 'string', description: '文件路径（相对于工作区根目录）', required: true } },
  },
  {
    name: 'write_file',
    description: '写入或覆盖文件内容',
    category: '文件系统',
    parameters: {
      path: { type: 'string', description: '文件路径', required: true },
      content: { type: 'string', description: '文件内容', required: true },
    },
  },
  {
    name: 'create_file',
    description: '创建一个新文件',
    category: '文件系统',
    parameters: {
      path: { type: 'string', description: '文件路径', required: true },
      content: { type: 'string', description: '文件内容', required: true },
    },
  },
  {
    name: 'list_dir',
    description: '列出目录中的文件和子目录',
    category: '文件系统',
    parameters: { path: { type: 'string', description: '目录路径（默认为根目录）' } },
  },
  {
    name: 'search_files',
    description: '在工作区中搜索包含指定关键词的文件',
    category: '文件系统',
    parameters: {
      query: { type: 'string', description: '搜索关键词', required: true },
      file_pattern: { type: 'string', description: '文件名过滤（如 *.ts）' },
    },
  },
  // === Git ===
  {
    name: 'git_status',
    description: '获取当前 Git 仓库状态（分支、改动文件）',
    category: 'Git',
    parameters: {},
  },
  {
    name: 'git_diff',
    description: '获取指定文件的 Git diff',
    category: 'Git',
    parameters: { path: { type: 'string', description: '文件路径', required: true } },
  },
  // === MCP 智能工具（39 个，全部可调用，含交付质量族 metago_delivery_gate / metago_discipline） ===
  ...MCP_TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    category: 'MCP 智能工具' as const,
    parameters: {
      text: { type: 'string', description: '待分析的文本/代码/决策内容（可选，未提供时基于上下文推断）' },
    },
  })),
]

/**
 * 生成工具定义（OpenAI function call 格式）
 *
 * 所有工具（文件系统 + Git + MCP 智能工具）都参与 function calling。
 * MCP 工具调用后会返回思维协议内容，AI 在下一轮推理中应用。
 */
export function getToolDefinitions() {
  return AGENT_TOOLS.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(t.parameters).map(([k, v]) => [k, { type: v.type, description: v.description }])
        ),
        required: Object.entries(t.parameters)
          .filter(([, v]) => v.required)
          .map(([k]) => k),
        additionalProperties: false,
      },
    },
  }))
}

/**
 * 执行工具调用
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  try {
    const fs = await getFS()

    // 文件系统工具
    switch (toolName) {
      case 'read_file':
        return await fs.readFile(args.path as string)

      case 'write_file':
        await fs.writeFile(args.path as string, args.content as string)
        return `文件已写入：${args.path}`

      case 'create_file':
        await fs.createFile(args.path as string, args.content as string)
        return `文件已创建：${args.path}`

      case 'list_dir': {
        const entries = await fs.readDir((args.path as string) || '.')
        return entries.map(e => `${e.type === 'folder' ? '📁' : '📄'} ${e.name}`).join('\n')
      }

      case 'search_files': {
        const results = await fs.search(args.query as string, {
          filePattern: args.file_pattern as string | undefined,
          maxResults: 50,
        })
        return JSON.stringify(results, null, 2)
      }

      case 'git_status': {
        const status = await getGitStatus(fs)
        return status ? JSON.stringify(status, null, 2) : '非 Git 仓库'
      }

      case 'git_diff': {
        const diff = await getFileDiff(fs, args.path as string)
        return diff ? `OLD:\n${diff.oldContent}\n\nNEW:\n${diff.newContent}` : '无 diff'
      }

      default: {
        // MCP 智能工具（39 个 metago_* 工具）
        if (toolName.startsWith('metago_')) {
          const result = executeMCPTool(toolName, args)
          if (!result.ok) {
            return `⚠️ ${result.summary}`
          }
          // 返回思维协议内容，AI 在下一轮推理中应用
          return `${result.summary}\n\n${result.protocol}`
        }
        return `未知工具：${toolName}`
      }
    }
  } catch (e) {
    return `工具执行失败：${(e as Error).message}`
  }
}
