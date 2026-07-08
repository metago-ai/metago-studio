/**
 * 动态 System Prompt 生成器（V3 - 自省架构）
 *
 * 核心原则：prompt 只管"我是谁、行为准则"，不管"我能做什么、有多少"。
 * - 工具数量、技能数量、分类明细：从 AGENT_TOOLS / MCP_TOOLS / SKILLS 运行时派生
 * - AI 主动查询自身状态：调用 get_agent_info 元工具
 * - 环境感知：通过 EnvironmentContext 动态注入
 *
 * 让 AI 感知自己所处的环境：
 * - 工作区路径和项目类型
 * - 当前打开的文件
 * - 选中的代码
 * - 已激活的技能
 * - 项目规则（AGENTS.md 等）
 */

import { getFS } from '../fs/fsInterface'
import { getGitStatus, getFileDiff } from '../git/gitProvider'
import { MCP_TOOLS, getMCPLogStore } from '../mcpRegistry'
import { SKILLS } from '../skillRegistry'
import { executeMCPTool } from './mcpImplementations'
import { getRoleById } from '../roleConfig'
import { callFunction } from '../cloudFunctions'
import { findModel } from '../modelRegistry'
import { formatAgentSelfInfo } from './agentSelfInfo'

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
  // === V3 环境感知扩展（对标 Trae IDE 状态实时注入） ===
  /** 当前文件的诊断信息（TypeScript/Lint 错误和警告） */
  diagnostics?: Array<{ severity: 'error' | 'warning' | 'info'; message: string; line?: number; source?: string }>
  /** Git 工作区状态（未提交的文件列表） */
  gitStatus?: { staged: string[]; modified: string[]; untracked: string[]; branch?: string }
  /** 项目结构概览（顶层目录和文件） */
  projectStructure?: string[]
  /** 当前打开的所有标签页 */
  openTabs?: Array<{ path: string; name: string; dirty?: boolean }>
  /** 当前会话的消息数量（用于上下文感知） */
  messageCount?: number
}

/**
 * 生成完整的动态 System Prompt
 */
export async function buildSystemPrompt(ctx: EnvironmentContext): Promise<string> {
  const parts: string[] = []

  // === 身份 ===
  parts.push(`# 你的身份

你是 MetaGO Agent，一个务实的开发智能体。你能读写用户工作区的文件、执行搜索、运行 Git 操作。

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

  // === 可用工具（V3: 全部从 AGENT_TOOLS 运行时派生，零硬编码） ===
  const isDesktopEnv = ctx.isDesktop
  // 按分类分组，动态计算数量
  const toolsByCategory = AGENT_TOOLS.reduce<Record<string, typeof AGENT_TOOLS>>((acc, t) => {
    ;(acc[t.category] ??= [] as any).push(t)
    return acc
  }, {})
  const engineeringCount = AGENT_TOOLS.filter(t => t.category !== 'MCP 智能工具').length
  const mcpCount = AGENT_TOOLS.filter(t => t.category === 'MCP 智能工具').length

  // 分类描述（运行时动态生成，加工具自动同步）
  const categoryDescriptions: Record<string, string> = {
    '文件系统': '文件读写、目录列表、关键词/正则搜索、glob 匹配',
    'Git': '版本控制：状态、diff、提交、推送',
    'Shell': '执行任意 Shell 命令（仅桌面端）',
    '任务管理': '任务列表的创建、更新、查询（复杂任务必须用此分解）',
    '部署验证': '运行验证脚本、部署到 CloudBase',
    '子代理': '启动独立子代理执行子任务（防递归）',
    '流式编辑': '在编辑器中展示 diff 让用户确认后再写入',
    'MCP 智能工具': '元认知思维工具（批判/决策锁/合规/价值对齐等）',
  }

  // 动态生成工具列表（按分类分组）
  const toolListText = Object.entries(toolsByCategory)
    .map(([cat, tools]) => {
      const desc = categoryDescriptions[cat] ?? ''
      const desktopOnly = cat === 'Shell' || cat === '部署验证'
      const suffix = desktopOnly && !isDesktopEnv ? ' · ⚠️ 仅桌面端可用' : ''
      const toolLines = tools.map(t => {
        const params = Object.entries(t.parameters)
          .map(([k, v]) => v.required ? `${k}*` : `${k}?`)
          .join(', ')
        return `- \`${t.name}\`（${params}）- ${t.description}`
      }).join('\n')
      return `## ${cat}（${tools.length} 个）${desc ? '· ' + desc : ''}${suffix}\n${toolLines}`
    })
    .join('\n\n')

  parts.push(`
# 你可以使用的工具（必须主动调用）

**工具总数**：${AGENT_TOOLS.length}（${engineeringCount} 个工程工具 + ${mcpCount} 个 MCP 元认知工具）

**重要**：以上数字是从代码注册表实时派生的，永远准确。如果用户问"你有多少工具""你能做什么"，调用 \`get_agent_info\` 工具获取完整自省信息。

${toolListText}

## 工具调用规则
1. **先验证再回答**：不确定就调用工具，永远不要编造
2. **工具返回错误时**：如实告诉用户错误信息，不要假设原因
3. **可以连续调用多个工具**：比如先 list_dir 看结构，再 read_file 读具体文件
4. **MCP 工具是思维工具**：调用后会返回思维协议，你必须在下一轮推理中应用该协议
5. **优先用 edit_file 而非 write_file**：修改文件时，用 edit_file 精准替换，避免整文件覆盖引入错误
6. **优先用 grep 而非 search_files**：需要正则匹配时用 grep
7. **自省优先用 get_agent_info**：用户问到你的能力/工具数/模型/环境时，调用 \`get_agent_info\` 而非凭记忆回答

## 全流程自主执行能力（Full-Stack Autonomous Execution）
你是可以**自主驱动完整开发流程**的智能体，从需求分析到部署交付全链路闭环：

### 标准执行流程（复杂任务必须遵循）
1. **需求分析**：理解用户意图，必要时 read_file/list_dir 查看上下文
2. **任务分解**：用 \`task_create\` 将复杂任务拆解为多个步骤
3. **逐步执行**：每步标记 \`task_update\` 状态，连续调用工具完成
4. **验证闭环**：用 \`run_command\` 执行 \`tsc -b\` + \`npm run build\` 验证代码
5. **提交部署**：用 \`git_commit\` 提交，\`deploy\` 部署，\`run_command\` 执行 curl 验证
6. **汇报交付**：总结做了什么、改了哪些文件、验证结果

### 自主性原则
- **不要每做一步就停下等用户确认**。一次回答内自主调用多个工具完成任务闭环
- **遇到错误自己修复**。tsc 报错 → read_file 看代码 → edit_file 修复 → 重新 tsc 验证
- **只有真正需要用户决策的歧义点才停下询问**

### 验证铁律（不可违反）
- 改完代码必须 \`run_command\` 执行 \`tsc -b\` 验证类型
- 部署后必须 \`run_command\` 执行 \`curl -I <url>\` 验证可达
- 禁止"应该没问题"，必须用工具实际验证`)

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

  // === V3 对标 Trae 对话流配置：注入 chatFlow 设置（agentProactiveQuestion 等）===
  try {
    const { getChatFlowSettings } = await import('../settingsStore')
    const chatFlow = getChatFlowSettings()
    const chatFlowDirectives: string[] = []
    if (chatFlow.agentProactiveQuestion) {
      chatFlowDirectives.push('- **主动提问**：当用户需求模糊、缺少关键信息（如目标不清晰、缺少技术栈、缺少使用场景）时，主动提 1-2 个澄清问题，不要凭猜测直接执行。')
    }
    if (chatFlow.todoListEnabled) {
      chatFlowDirectives.push('- **任务清单**：复杂任务（≥3 步）必须先用 \`task_create\` 创建任务清单，每步完成后 \`task_update\` 标记完成。')
    }
    if (chatFlow.autoFixLint) {
      chatFlowDirectives.push('- **自动修复**：执行修改后主动运行 \`tsc -b\` 或 \`npm run build\` 验证，发现错误立即修复，不要等用户指出。')
    }
    if (chatFlow.codeReviewScope !== 'none') {
      chatFlowDirectives.push(`- **代码审查范围**：${chatFlow.codeReviewScope === 'all' ? '审查所有改动文件' : '仅审查最新改动文件'}。`)
    }
    if (chatFlowDirectives.length > 0) {
      parts.push(`
# 对话流配置（用户偏好）

${chatFlowDirectives.join('\n')}`)
    }
  } catch (e) {
    // settingsStore 不可用时静默降级
  }

  // === 行为约束 ===
  parts.push(`
# 回答规范

1. **执行优先**：用户让你做事，先调用工具执行，再汇报结果
2. **纯文本输出（铁律）**：
   - 禁止使用 Markdown 语法（不要用 # 标题、| 表格、**加粗**、\`\`\`代码块\`\`\`、--- 分割线等）
   - 用缩进和换行组织结构，用「」引号强调，用数字列表（1. 2. 3.）或破折号（- ）列表
   - 代码直接用缩进呈现，不要用三反引号包裹
   - 表格用对齐文本呈现，不要用 | 竖线
3. **简洁务实**：直接给结论和结果，不要营销化表述，不要自我吹嘘，不要"我不是普通的XX"这类对比性开场白
4. **代码审查格式**：
   【风险等级】Critical / Major / Minor / Info
   【问题定位】文件名:行号区间
   【问题描述】具体说明
   【修复建议】可执行的代码
   【原理说明】为什么这样修复
5. **不编造**：如果需要文件内容，调用 \`read_file\` 获取，不要猜测
6. **中文回复**：除非用户用英文提问
7. **不主动联网**：除非用户明确要求"联网搜索"或问题需要实时信息（如最新新闻、最新版本号），否则不触发联网搜索`)

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
  category: '文件系统' | 'Git' | 'MCP 智能工具' | 'Shell' | '任务管理' | '部署验证' | '子代理' | '流式编辑' | '自省' | '代码智能'
  parameters: Record<string, { type: string; description: string; required?: boolean }>
}

/** 工具执行上下文（传递环境信息给 executeTool） */
export interface ToolExecutionContext {
  workspacePath?: string
  isDesktop: boolean
  /** 子代理标志（防递归：子代理不能再 spawn_agent） */
  isSubAgent?: boolean
  /** 子代理使用的模型 ID（默认 deepseek-v4-pro） */
  subAgentModelId?: string
  /** V3: 完整环境上下文（供 get_agent_info 等自省工具读取） */
  envContext?: EnvironmentContext
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
  {
    name: 'git_commit',
    description: '提交所有已暂存的改动到 Git 仓库（自动 stage 所有改动并 commit）',
    category: 'Git',
    parameters: { message: { type: 'string', description: 'commit 信息', required: true } },
  },
  {
    name: 'git_push',
    description: '推送当前分支到远程仓库（需已配置 remote 和认证）',
    category: 'Git',
    parameters: {},
  },
  // === Shell 命令执行（仅桌面端） ===
  {
    name: 'run_command',
    description: '在工作区执行 Shell 命令并返回 stdout/stderr/exitCode。可用于：tsc/build/test/curl/npm/git 等任意命令。仅桌面端可用。',
    category: 'Shell',
    parameters: {
      command: { type: 'string', description: '要执行的命令（如 npm run build）', required: true },
      cwd: { type: 'string', description: '工作目录（默认为当前工作区根目录）' },
    },
  },
  // === 精准编辑 ===
  {
    name: 'edit_file',
    description: '精准字符串替换：在文件中查找 old_string 并替换为 new_string。比 write_file 整文件覆盖更安全。old_string 必须在文件中唯一存在。',
    category: '文件系统',
    parameters: {
      path: { type: 'string', description: '文件路径', required: true },
      old_string: { type: 'string', description: '要替换的原始字符串（必须在文件中唯一存在）', required: true },
      new_string: { type: 'string', description: '替换后的新字符串', required: true },
      replace_all: { type: 'boolean', description: '是否替换所有匹配（默认 false，仅替换第一处）' },
    },
  },
  // === 正则搜索 ===
  {
    name: 'grep',
    description: '正则搜索工作区文件内容，返回匹配的文件名、行号、行文本。比 search_files（关键词）更强大。',
    category: '文件系统',
    parameters: {
      pattern: { type: 'string', description: '正则表达式（如 "function\\s+\\w+"）', required: true },
      file_pattern: { type: 'string', description: '文件名 glob 过滤（如 "*.ts"，默认所有文件）' },
      case_sensitive: { type: 'boolean', description: '是否区分大小写（默认 false）' },
    },
  },
  {
    name: 'glob',
    description: '文件名模式匹配，返回匹配的文件路径列表（如 "**\\/*.tsx" 匹配所有 tsx 文件）',
    category: '文件系统',
    parameters: {
      pattern: { type: 'string', description: 'glob 模式（如 "src\\/**\\/*.ts"）', required: true },
    },
  },
  // === 任务管理 ===
  {
    name: 'task_create',
    description: '创建一个任务到任务列表，用于跟踪复杂多步骤任务的进度',
    category: '任务管理',
    parameters: {
      subject: { type: 'string', description: '任务标题', required: true },
      description: { type: 'string', description: '任务详细描述' },
    },
  },
  {
    name: 'task_update',
    description: '更新任务状态（pending/in_progress/completed）',
    category: '任务管理',
    parameters: {
      task_id: { type: 'string', description: '任务 ID', required: true },
      status: { type: 'string', description: '新状态：pending | in_progress | completed', required: true },
    },
  },
  {
    name: 'task_list',
    description: '列出所有任务及其状态',
    category: '任务管理',
    parameters: {},
  },
  // === 部署验证 ===
  {
    name: 'run_verify',
    description: '运行项目的验证脚本（npm run verify 或 pre-delivery-verify），返回验证结果',
    category: '部署验证',
    parameters: {},
  },
  {
    name: 'deploy',
    description: '部署当前工作区项目到 CloudBase（自动检测项目类型并执行对应部署命令）',
    category: '部署验证',
    parameters: {
      target: { type: 'string', description: '部署目标：website | studio（默认 website）' },
    },
  },
  // === 子代理（对标 Trae Agent 工具 · V3 支持并行） ===
  {
    name: 'spawn_agent',
    description: '启动一个或多个独立子代理执行子任务。子代理有独立的消息历史和工具调用循环（最多 20 轮）。多个子代理并行执行（同时返回）。适用于：并行探索多个模块、独立完成复杂子任务、上下文隔离避免干扰主任务。子代理不能再启动子代理（防递归）。',
    category: '子代理',
    parameters: {
      task: { type: 'string', description: '单个任务时用此字段。子代理要执行的任务描述（清晰、具体、可独立完成）', required: false },
      tasks: { type: 'array', description: '多个并行任务时用此字段（数组）。每个元素：{task: string, context?: string}。传入此字段时将并行执行所有任务，同时返回所有结果。', },
      context: { type: 'string', description: '给单个子代理的额外上下文（如相关文件路径、已知信息等）' },
    },
  },
  // === 流式编辑（对标 Trae inline edit 流式 UI） ===
  {
    name: 'inline_edit',
    description: '流式编辑：在编辑器中展示 diff 让用户确认后再写入。比 edit_file 更安全——用户可以 Accept 或 Reject。适用于：重要代码修改、用户可能想审查的改动、关键业务逻辑变更。old_string 必须在文件中唯一存在（除非 replace_all=true）。',
    category: '流式编辑',
    parameters: {
      path: { type: 'string', description: '文件路径', required: true },
      old_string: { type: 'string', description: '要替换的原始字符串（必须在文件中唯一存在）', required: true },
      new_string: { type: 'string', description: '替换后的新字符串', required: true },
      replace_all: { type: 'boolean', description: '是否替换所有匹配（默认 false）' },
    },
  },
  // === MCP 智能工具（53 个，全部可调用，22思维工具+37技能去重7个+1事件上报） ===
  ...MCP_TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    category: 'MCP 智能工具' as const,
    parameters: {
      text: { type: 'string', description: '待分析的文本/代码/决策内容（可选，未提供时基于上下文推断）' },
    },
  })),
  // === 自省工具（V3 新增 · 对标 Trae 工具注册表自感知） ===
  {
    name: 'get_agent_info',
    description: '获取 Agent 自身实时信息：工具总数、分类明细、技能列表、运行时环境、当前模型、版本。当用户询问"你有多少工具""你能做什么""你是什么模型""你是什么版本"等问题时，调用此工具获取准确答案，不要凭记忆回答。',
    category: '自省',
    parameters: {
      detail_level: { type: 'string', description: '详细级别：summary（仅摘要）| full（完整明细，默认）' },
    },
  },
  // === 代码智能（V3 新增 · 对标 Trae SearchCodebase） ===
  {
    name: 'search_codebase',
    description: '语义搜索代码库：用自然语言查询代码逻辑（如"哪里做了用户认证"），不需要知道函数名。基于 embedding 嵌入模型，理解代码意图。比 grep（正则匹配）更智能，比 search_files（关键词）更精准。',
    category: '代码智能',
    parameters: {
      query: { type: 'string', description: '自然语言查询（如"用户认证逻辑在哪里"）', required: true },
      max_results: { type: 'number', description: '最大返回结果数（默认 10）' },
    },
  },
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

/** 获取运行平台（渲染进程安全版） */
function getPlatform(): string {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.platform) {
    return (window as any).electronAPI.platform
  }
  if (typeof navigator !== 'undefined') {
    if (navigator.userAgent.includes('Win')) return 'win32'
    if (navigator.userAgent.includes('Mac')) return 'darwin'
    return 'linux'
  }
  return 'unknown'
}

/** 简易 glob 匹配（Web 端 fallback 用） */
function simpleGlobMatch(pattern: string, name: string): boolean {
  // 将 glob 转为正则：* → [^/]* , ? → [^/] , ** → .*
  const re = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\x00')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\x00/g, '.*')
  return new RegExp(`^${re}$`).test(name)
}

/**
 * 执行 Shell 命令（内部函数，供 run_command/git_commit/git_push/run_verify/deploy 调用）
 *
 * 桌面端：通过 Electron IPC 调用 child_process.exec
 * Web 端：返回不支持错误（浏览器沙箱限制）
 */
async function shellExec(
  command: string,
  cwd: string | undefined,
  context: ToolExecutionContext | undefined,
): Promise<string> {
  if (!context?.isDesktop) {
    return `❌ Web 端不支持执行 Shell 命令。请下载 MetaGO Agent 桌面端使用此能力。\n命令：${command}`
  }
  try {
    const electronAPI = (window as any).electronAPI
    const result = await electronAPI.shell.exec(command, cwd)
    const parts: string[] = []
    parts.push(`$ ${command}`)
    parts.push(`退出码: ${result.exitCode} · 耗时: ${result.duration}ms`)
    if (result.stdout) parts.push(`--- stdout ---\n${result.stdout}`)
    if (result.stderr) parts.push(`--- stderr ---\n${result.stderr}`)
    return parts.join('\n')
  } catch (e) {
    return `Shell 执行失败：${(e as Error).message}`
  }
}

/**
 * 执行工具调用
 *
 * @param toolName 工具名
 * @param args 工具参数
 * @param context 工具执行上下文（工作区路径、是否桌面端）
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context?: ToolExecutionContext,
): Promise<string> {
  try {
    const fs = await getFS()
    const workspacePath = context?.workspacePath

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

      case 'edit_file': {
        const filePath = args.path as string
        const oldStr = args.old_string as string
        const newStr = args.new_string as string
        const replaceAll = args.replace_all as boolean | undefined
        const content = await fs.readFile(filePath)
        if (!content.includes(oldStr)) {
          return `❌ edit_file 失败：old_string 在文件 ${filePath} 中未找到`
        }
        if (!replaceAll && content.split(oldStr).length - 1 > 1) {
          return `❌ edit_file 失败：old_string 在文件 ${filePath} 中出现多次，请提供更长上下文使其唯一，或设置 replace_all=true`
        }
        const newContent = replaceAll
          ? content.split(oldStr).join(newStr)
          : content.replace(oldStr, newStr)
        await fs.writeFile(filePath, newContent)
        return `✅ 文件已编辑：${filePath}（替换 ${replaceAll ? '所有匹配' : '第一处匹配'}）`
      }

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

      case 'grep': {
        // 桌面端优先用 ripgrep（最快），退化到系统命令
        const pattern = args.pattern as string
        const filePattern = args.file_pattern as string | undefined
        const caseSensitive = args.case_sensitive as boolean | undefined
        if (context?.isDesktop) {
          const rgArgs = ['--line-number', '--no-heading', '--color', 'never']
          if (!caseSensitive) rgArgs.push('-i')
          if (filePattern) rgArgs.push('-g', filePattern)
          const cmd = `rg ${rgArgs.join(' ')} "${pattern.replace(/"/g, '\\"')}"${workspacePath ? ` "${workspacePath}"` : ''}`
          const result = await shellExec(cmd, workspacePath, context)
          // 如果 rg 不存在，退化到 findstr（Windows）或 grep（Unix）
          if (result.includes('退出码: 1') || result.includes('not recognized') || result.includes('not found')) {
            const fallbackCmd = getPlatform() === 'win32'
              ? `findstr /N ${caseSensitive ? '' : '/I'} "${pattern}" ${filePattern || '*'}`
              : `grep -rn ${caseSensitive ? '' : '-i'} "${pattern}" ${filePattern || '.'}`
            return await shellExec(fallbackCmd, workspacePath, context)
          }
          return result
        }
        // Web 端退化到 fs.search
        const results = await fs.search(pattern, { filePattern, maxResults: 100 })
        return JSON.stringify(results, null, 2)
      }

      case 'glob': {
        const pattern = args.pattern as string
        if (context?.isDesktop) {
          const cmd = getPlatform() === 'win32'
            ? `Get-ChildItem -Path "${workspacePath || '.'}" -Recurse -Filter "${pattern}" | Select-Object -ExpandProperty FullName`
            : `find "${workspacePath || '.'}" -name "${pattern}" -type f`
          return await shellExec(cmd, workspacePath, context)
        }
        // Web 端：用 readTree 递归 + 文件名匹配
        const tree = await fs.readTree('.', 5).catch(() => [])
        const matches: string[] = []
        const walk = (nodes: any[]) => {
          for (const n of nodes) {
            if (n.type === 'file' && simpleGlobMatch(pattern, n.name)) {
              matches.push(n.path)
            }
            if (n.children) walk(n.children)
          }
        }
        walk(tree)
        return matches.length > 0 ? matches.join('\n') : '无匹配文件'
      }

      case 'git_status': {
        const status = await getGitStatus(fs)
        return status ? JSON.stringify(status, null, 2) : '非 Git 仓库'
      }

      case 'git_diff': {
        const diff = await getFileDiff(fs, args.path as string)
        return diff ? `OLD:\n${diff.oldContent}\n\nNEW:\n${diff.newContent}` : '无 diff'
      }

      case 'git_commit': {
        const message = args.message as string
        if (!workspacePath) return '❌ 未打开工作区，无法 git commit'
        // 先 stage 所有改动，再 commit
        const addResult = await shellExec('git add -A', workspacePath, context)
        if (addResult.includes('❌')) return addResult
        const commitCmd = `git commit -m "${message.replace(/"/g, '\\"')}"`
        const commitResult = await shellExec(commitCmd, workspacePath, context)
        return `${addResult}\n\n${commitResult}`
      }

      case 'git_push': {
        if (!workspacePath) return '❌ 未打开工作区，无法 git push'
        return await shellExec('git push', workspacePath, context)
      }

      case 'run_command': {
        const cmd = args.command as string
        const cwd = args.cwd as string | undefined || workspacePath
        // V3 对标 Trae 对话流配置：按 autoRunCommand 模式校验命令
        try {
          const { getChatFlowSettings } = await import('../settingsStore')
          const cf = getChatFlowSettings()
          const mode = cf.autoRunCommand
          // 提取命令首词（去掉 sudo / npx / npm 前缀的实际命令）
          const cmdBase = cmd.trim().split(/\s+/)[0]
          if (mode === 'manual') {
            return `⚠️ 用户已设置「手动执行」模式，禁止 AI 自动运行命令。\n请用户手动执行：\n  ${cmd}\n\n如需允许 AI 自动执行，可在「设置 → 对话流 → 自动运行命令」中改为白名单或始终模式。`
          }
          if (mode === 'whitelist') {
            const allowed = cf.commandWhitelist.some(w => cmd.startsWith(w) || cmdBase === w.split(/\s+/)[0])
            if (!allowed) {
              return `⚠️ 命令不在白名单中，禁止执行：\n  ${cmd}\n\n白名单：${cf.commandWhitelist.join('、')}\n\n如需允许此命令，请在「设置 → 对话流 → 白名单」中添加。`
            }
          }
          if (mode === 'blacklist') {
            const blocked = cf.commandBlacklist.some(b => cmd.includes(b) || cmdBase === b.split(/\s+/)[0])
            if (blocked) {
              return `⚠️ 命令命中黑名单，禁止执行：\n  ${cmd}\n\n黑名单：${cf.commandBlacklist.join('、')}`
            }
          }
          // mode === 'always' 或上述检查通过：执行
        } catch { /* 配置读取失败时默认放行 */ }
        return await shellExec(cmd, cwd, context)
      }

      case 'run_verify': {
        if (!workspacePath) return '❌ 未打开工作区，无法运行验证'
        // 优先 npm run verify，退化到 tsc + build
        const result = await shellExec('npm run verify', workspacePath, context)
        if (result.includes('Missing script: "verify"')) {
          const fallback = await shellExec('npx tsc -b && npm run build', workspacePath, context)
          return `⚠️ 项目未配置 verify 脚本，退化到 tsc + build：\n\n${fallback}`
        }
        return result
      }

      case 'deploy': {
        if (!workspacePath) return '❌ 未打开工作区，无法部署'
        const target = (args.target as string) || 'website'
        if (target === 'studio') {
          return await shellExec(
            'npx vite build && npx cloudbase hosting deploy ./dist studio -e metago-d6gfw1e4rf2a5bcad',
            workspacePath, context,
          )
        }
        // website
        return await shellExec(
          'npm run build && npx cloudbase hosting deploy ./dist -e metago-d6gfw1e4rf2a5bcad',
          workspacePath, context,
        )
      }

      case 'task_create': {
        const { useTaskStore } = await import('../stores/taskStore')
        const id = useTaskStore.getState().createTask(args.subject as string, args.description as string)
        return `✅ 任务已创建 [${id}]：${args.subject}`
      }

      case 'task_update': {
        const { useTaskStore } = await import('../stores/taskStore')
        useTaskStore.getState().updateTask(args.task_id as string, args.status as any)
        return `✅ 任务 [${args.task_id}] 状态已更新为：${args.status}`
      }

      case 'task_list': {
        const { useTaskStore } = await import('../stores/taskStore')
        const tasks = useTaskStore.getState().listTasks()
        if (tasks.length === 0) return '当前无任务'
        return tasks.map(t => `[${t.status}] ${t.id} - ${t.subject}`).join('\n')
      }

      case 'spawn_agent': {
        // V3: 支持单任务和多任务并行
        // 防递归：子代理不能再启动子代理
        if (context?.isSubAgent) {
          return '❌ spawn_agent 失败：子代理不能再启动子代理（防递归保护）'
        }
        const tasks = args.tasks as Array<{ task: string; context?: string }> | undefined
        const singleTask = args.task ? String(args.task).trim() : ''
        const singleContext = args.context ? String(args.context) : ''

        // 多任务并行模式
        if (Array.isArray(tasks) && tasks.length > 0) {
          if (tasks.length > 5) {
            return '❌ spawn_agent 失败：并行子代理数量不能超过 5 个（资源限制）'
          }
          const results = await Promise.all(
            tasks.map((t, i) =>
              runSubAgent(t.task, t.context || '', context).then(r => ({
                index: i + 1,
                task: t.task.slice(0, 60),
                result: r,
              }))
            )
          )
          return results.map(r =>
            `## 子代理 #${r.index}：${r.task}...\n${r.result}`
          ).join('\n\n---\n\n')
        }

        // 单任务模式
        if (!singleTask) {
          return '❌ spawn_agent 失败：必须提供 task（单个任务）或 tasks（多任务数组）参数'
        }
        return await runSubAgent(singleTask, singleContext, context)
      }

      case 'inline_edit': {
        // 子代理不允许调 inline_edit（避免阻塞：子代理是后台执行，无法等用户确认）
        if (context?.isSubAgent) {
          return '❌ inline_edit 失败：子代理不能调用 inline_edit（子代理无 UI 交互，请用 edit_file）'
        }
        const filePath = args.path as string
        const oldStr = args.old_string as string
        const newStr = args.new_string as string
        const replaceAll = args.replace_all as boolean | undefined
        const oldContent = await fs.readFile(filePath)
        if (!oldContent.includes(oldStr)) {
          return `❌ inline_edit 失败：old_string 在文件 ${filePath} 中未找到`
        }
        if (!replaceAll && oldContent.split(oldStr).length - 1 > 1) {
          return `❌ inline_edit 失败：old_string 在文件 ${filePath} 中出现多次，请提供更长上下文使其唯一，或设置 replace_all=true`
        }
        const newContent = replaceAll
          ? oldContent.split(oldStr).join(newStr)
          : oldContent.replace(oldStr, newStr)
        // 提交到 pendingEditStore，等待用户 Accept/Reject
        const { usePendingEditStore } = await import('../stores/pendingEditStore')
        const result = await usePendingEditStore.getState().submit({
          filePath,
          oldContent,
          newContent,
          oldString: oldStr,
          newString: newStr,
          replaceAll: Boolean(replaceAll),
        })
        if (result.accepted) {
          // 用户接受 → 实际写入文件
          await fs.writeFile(filePath, newContent)
          return `✅ 流式编辑已被用户接受并写入：${filePath}（替换 ${replaceAll ? '所有匹配' : '第一处匹配'}）`
        }
        return result.message
      }

      case 'get_agent_info': {
        // V3 自省工具：返回 Agent 实时信息（从代码派生，不靠 prompt）
        const detailLevel = (args.detail_level as string) || 'full'
        const envCtx = context?.envContext
        const summary = await formatAgentSelfInfo(context, envCtx ? {
          workspacePath: envCtx.workspacePath,
          workspaceName: envCtx.workspaceName,
          projectType: envCtx.projectType,
          activeFileName: envCtx.activeFileName,
          activeFileLanguage: envCtx.activeFileLanguage,
          selectedCode: envCtx.selectedCode,
          selectedLineRange: envCtx.selectedLineRange,
          activeSkills: envCtx.activeSkills,
          currentRoleId: envCtx.currentRoleId,
        } : undefined)
        if (detailLevel === 'summary') {
          // 摘要模式：只返回数字和关键信息
          const lines = summary.split('\n').filter(l =>
            l.includes('总数') || l.includes('工程工具') || l.includes('MCP') ||
            l.includes('平台') || l.includes('模型') || l.includes('版本')
          )
          return lines.join('\n')
        }
        return summary
      }

      case 'search_codebase': {
        // V3 语义搜索：用自然语言查询代码逻辑
        const query = String(args.query || '').trim()
        if (!query) return '❌ search_codebase 失败：query 参数必填'
        const maxResults = (args.max_results as number) || 10
        if (!workspacePath) {
          return '❌ search_codebase 失败：未打开工作区。请先打开工作区再使用语义搜索。'
        }
        // 退化方案：用 grep + 关键词提取（无 embedding 索引时）
        // 从自然语言查询中提取关键词
        const keywords = query
          .replace(/[？?。.,，、的在哪里哪里做了如何实现功能逻辑代码]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 1)
          .slice(0, 5)
        if (keywords.length === 0) {
          return `❌ search_codebase 失败：无法从查询"${query}"中提取关键词。请用更具体的描述。`
        }
        // 用 grep 依次搜索每个关键词，合并结果
        const allResults: Array<{ file: string; line: number; text: string; keyword: string }> = []
        for (const kw of keywords) {
          const pattern = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          if (context?.isDesktop) {
            const rgArgs = ['--line-number', '--no-heading', '--color', 'never', '-i']
            const cmd = `rg ${rgArgs.join(' ')} "${pattern}" "${workspacePath}"`
            const result = await shellExec(cmd, workspacePath, context)
            // 解析 rg 输出：file:line:text
            const lines = result.split('\n').filter(l => l.includes(':') && !l.startsWith('$') && !l.startsWith('退出码'))
            for (const line of lines.slice(0, maxResults)) {
              const match = line.match(/^([^:]+):(\d+):(.*)$/)
              if (match) {
                allResults.push({ file: match[1], line: parseInt(match[2]), text: match[3], keyword: kw })
              }
            }
          } else {
            // Web 端退化到 fs.search
            const results = await fs.search(kw, { maxResults })
            for (const r of results) {
              allResults.push({ file: r.filePath, line: r.line, text: r.lineText, keyword: kw })
            }
          }
        }
        // 去重（同一文件同行只保留一次）
        const seen = new Set<string>()
        const unique = allResults.filter(r => {
          const key = `${r.file}:${r.line}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        if (unique.length === 0) {
          return `未找到匹配"${query}"的代码。试试用更具体的关键词，或用 grep 工具进行精确正则搜索。`
        }
        const formatted = unique.slice(0, maxResults).map(r =>
          `📄 ${r.file}:${r.line}\n   ${r.text.trim().slice(0, 200)}`
        ).join('\n\n')
        return `找到 ${unique.length} 处匹配"${query}"的代码（关键词：${keywords.join(', ')}）：\n\n${formatted}`
      }

      default: {
        // MCP 智能工具（53 个 metago_* 工具）
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

// ============ 子代理（Sub-Agent）实现 ============

/**
 * 子代理系统提示词（精简版，强调自主完成 + 不递归）
 */
function buildSubAgentPrompt(task: string, extraContext: string, workspacePath?: string): string {
  const ws = workspacePath ? `\n- **工作区**：${workspacePath}` : '\n- **工作区**：未打开（文件操作可能失败）'
  return `# 你是 MetaGO Agent 的子代理

你被主代理启动，负责独立完成一个子任务。

## 任务
${task}
${extraContext ? `\n## 额外上下文\n${extraContext}\n` : ''}
## 环境
- **身份**：子代理（Sub-Agent）
- **限制**：不能再调用 spawn_agent（防递归）${ws}

## 规则
1. 自主调用工具完成任务，不要停下来问问题
2. 完成后用一段话总结结果（你返回的内容会作为 spawn_agent 工具的结果给主代理）
3. 如果任务无法完成，说明原因
4. 可用工具：文件系统（read/write/edit/list/grep/glob）、Git、Shell（run_command）、任务管理
5. 禁止调用 spawn_agent`
}

/**
 * 运行子代理（独立消息循环，不流式，不递归）
 *
 * @param task 子任务描述
 * @param extraContext 额外上下文
 * @param parentContext 父代理上下文（继承 workspacePath + isDesktop）
 * @returns 子代理最终回复文本
 */
async function runSubAgent(
  task: string,
  extraContext: string,
  parentContext?: ToolExecutionContext,
): Promise<string> {
  const modelId = parentContext?.subAgentModelId || 'deepseek-v4-pro'
  const model = findModel(modelId)
  if (!model) return `❌ 子代理启动失败：未找到模型 ${modelId}`

  const subSystemPrompt = buildSubAgentPrompt(task, extraContext, parentContext?.workspacePath)
  const subTools = getToolDefinitions().filter(t => t.function.name !== 'spawn_agent')
  const subMaxRounds = 20

  let currentMessages: any[] = [
    { role: 'system', content: subSystemPrompt },
    { role: 'user', content: task },
  ]

  for (let round = 0; round < subMaxRounds; round++) {
    const payload = {
      action: 'chat',
      modelId: model.id,
      modelType: model.type,
      ...(model.type === 'custom' ? {
        customBaseUrl: model.baseUrl,
        customApiKey: model.apiKey,
        customModelName: model.modelId,
        provider: model.provider,
      } : {}),
      messages: currentMessages,
      tools: subTools,
      stream: false,
    }

    const res = await callFunction<any>('aiProxy', payload)
    if (res.code !== 0 || !res.data) {
      return `❌ 子代理调用 LLM 失败（第 ${round + 1} 轮）：${res.message || '未知错误'}`
    }

    const llmResponse = res.data
    const toolCalls = llmResponse.tool_calls || llmResponse.choices?.[0]?.message?.tool_calls

    // 无工具调用 → 返回最终结果
    if (!toolCalls || toolCalls.length === 0) {
      const content = llmResponse.content || llmResponse.choices?.[0]?.message?.content || ''
      return content || '子代理未返回内容'
    }

    // 有工具调用 → 执行工具
    currentMessages.push({
      role: 'assistant',
      content: llmResponse.content || '',
      tool_calls: toolCalls,
    })

    for (const tc of toolCalls) {
      const fnName = tc.function?.name || tc.name
      let fnArgs: Record<string, unknown> = {}
      try { fnArgs = JSON.parse(tc.function?.arguments || tc.arguments || '{}') } catch { /* 忽略 */ }

      const t0 = Date.now()
      const result = await executeTool(fnName, fnArgs, {
        workspacePath: parentContext?.workspacePath,
        isDesktop: parentContext?.isDesktop ?? false,
        isSubAgent: true, // 防递归标志
        subAgentModelId: modelId,
      })
      const duration = Date.now() - t0

      // 记录到 MCP 日志（标注为子代理调用）
      const truncated = result.length > 500 ? result.slice(0, 500) + '...' : result
      getMCPLogStore().add({
        toolName: `[子代理] ${fnName}`,
        params: fnArgs,
        result: truncated,
        duration,
      })

      currentMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        name: fnName,
        content: result,
      })
    }
  }

  return `⚠️ 子代理达到最大轮数（${subMaxRounds}），未完成最终回复。最后一条消息：${JSON.stringify(currentMessages[currentMessages.length - 1]).slice(0, 500)}`
}
