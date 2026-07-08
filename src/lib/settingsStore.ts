/**
 * 统一设置存储（V3 对标 Trae 设置中心）
 *
 * 管理所有 IDE 级配置：通用/智能体/MCP/对话流/规则/技能/模型/索引/HOOKS
 * 存储策略：
 *   - 用户级偏好（主题/语言/快捷键）：localStorage
 *   - 项目级配置（rules/agents/mcp/skills）：.metago/ 目录文件
 *   - 运行时状态（对话流开关）：localStorage + 项目记忆
 */

import { getFS } from './fs/fsInterface'

// ============ 类型定义 ============

export type Theme = 'dark' | 'deep-blue' | 'light'
export type Language = 'zh-CN' | 'en' | 'ja'
export type KeymapStyle = 'vscode' | 'jetbrains' | 'vim'
export type CodeReviewScope = 'all' | 'latest' | 'none'
export type AutoRunMode = 'manual' | 'whitelist' | 'blacklist' | 'always'
export type HookEvent = 'on_save' | 'on_commit' | 'on_project_open' | 'on_file_create' | 'on_file_delete'

export interface GeneralSettings {
  theme: Theme
  language: Language
  keymap: KeymapStyle
  markdownDefaultMode: 'code' | 'preview'
  localLinkOpenMode: 'ask' | 'internal' | 'system'
}

export interface ChatFlowSettings {
  todoListEnabled: boolean
  autoCollapseNodes: boolean
  autoFixLint: boolean
  agentProactiveQuestion: boolean
  codeReviewScope: CodeReviewScope
  jumpToNextChangeAfterReview: boolean
  autoRunMCP: boolean
  autoRunCommand: AutoRunMode
  commandWhitelist: string[]
  commandBlacklist: string[]
  taskNotificationBanner: boolean
  taskNotificationSound: boolean
  soundVolume: number
}

export interface CustomAgent {
  id: string
  name: string
  description: string
  icon?: string
  systemPrompt: string
  enabledTools: string[]
  enabledMCP: string[]
  modelId?: string
  isBuiltIn: boolean
  createdAt: string
  updatedAt: string
}

export interface MCPServerConfig {
  id: string
  name: string
  type: 'stdio' | 'sse'
  command?: string[]
  url?: string
  env?: Record<string, string>
  enabled: boolean
  autoRun: boolean
  createdAt: string
}

export interface PathRule {
  id: string
  paths: string[]
  content: string
  description?: string
}

export interface RulesConfig {
  userRules: string
  projectRules: string
  pathRules: PathRule[]
}

export interface CustomSkill {
  id: string
  name: string
  description: string
  content: string
  trigger: string
  category: string
  isBuiltIn: boolean
  createdAt: string
}

export interface IndexDocEntry {
  id: string
  type: 'web' | 'doc' | 'file'
  url?: string
  path?: string
  title: string
  content?: string
  indexedAt: string
}

export interface HookConfig {
  id: string
  event: HookEvent
  pattern?: string
  action: 'run_command' | 'ai_analyze' | 'notify'
  command?: string
  aiPrompt?: string
  enabled: boolean
}

export interface AllSettings {
  general: GeneralSettings
  chatFlow: ChatFlowSettings
  agents: CustomAgent[]
  mcpServers: MCPServerConfig[]
  rules: RulesConfig
  skills: CustomSkill[]
  indexDocs: IndexDocEntry[]
  hooks: HookConfig[]
}

// ============ 默认值 ============

export const DEFAULT_GENERAL: GeneralSettings = {
  theme: 'dark',
  language: 'zh-CN',
  keymap: 'vscode',
  markdownDefaultMode: 'preview',
  localLinkOpenMode: 'ask',
}

export const DEFAULT_CHAT_FLOW: ChatFlowSettings = {
  todoListEnabled: true,
  autoCollapseNodes: true,
  autoFixLint: true,
  agentProactiveQuestion: false,
  codeReviewScope: 'latest',
  jumpToNextChangeAfterReview: true,
  autoRunMCP: false,
  autoRunCommand: 'manual',
  commandWhitelist: ['npm test', 'npm run build', 'git status', 'git diff'],
  commandBlacklist: ['rm -rf', 'format', 'shutdown', 'del /f'],
  taskNotificationBanner: true,
  taskNotificationSound: false,
  soundVolume: 50,
}

export const DEFAULT_BUILT_IN_AGENTS: CustomAgent[] = [
  {
    id: 'builtin-builder',
    name: '构建器',
    description: '从零开始开发完整项目，调用所有工具进行代码分析、编辑、命令执行',
    icon: 'Hammer',
    systemPrompt: '你是一个全栈构建器智能体，能够自主探索代码库、识别相关文件并实施修改。',
    enabledTools: ['read_file', 'write_file', 'edit_file', 'list_dir', 'grep', 'search_codebase', 'shell_exec', 'git'],
    enabledMCP: ['metago-critique', 'metago-deep-reasoning'],
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'builtin-builder-mcp',
    name: '搭载 MCP 的构建器',
    description: '在构建器基础上自动加载所有已启用的 MCP Server',
    icon: 'Network',
    systemPrompt: '你是一个搭载 MCP 的构建器智能体，所有 MCP 服务器工具默认启用且不可编辑。',
    enabledTools: ['*'],
    enabledMCP: ['*'],
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

// ============ localStorage 存取（用户级偏好） ============

const LS_KEY_GENERAL = 'metago_settings_general'
const LS_KEY_CHAT_FLOW = 'metago_settings_chatflow'
const LS_KEY_AGENTS = 'metago_settings_agents'
const LS_KEY_MCP = 'metago_settings_mcp_servers'
const LS_KEY_SKILLS = 'metago_settings_custom_skills'
const LS_KEY_INDEX_DOCS = 'metago_settings_index_docs'
const LS_KEY_HOOKS = 'metago_settings_hooks'

function loadLS<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return defaultValue
    return { ...defaultValue, ...JSON.parse(raw) }
  } catch {
    return defaultValue
  }
}

function saveLS<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('[settingsStore] localStorage 写入失败', e)
  }
}

function loadArrayLS<T>(key: string, defaultValue: T[]): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return defaultValue
    return JSON.parse(raw)
  } catch {
    return defaultValue
  }
}

// ============ General ============

export function getGeneralSettings(): GeneralSettings {
  return loadLS(LS_KEY_GENERAL, DEFAULT_GENERAL)
}

export function saveGeneralSettings(s: GeneralSettings): void {
  saveLS(LS_KEY_GENERAL, s)
}

// ============ ChatFlow ============

export function getChatFlowSettings(): ChatFlowSettings {
  return loadLS(LS_KEY_CHAT_FLOW, DEFAULT_CHAT_FLOW)
}

export function saveChatFlowSettings(s: ChatFlowSettings): void {
  saveLS(LS_KEY_CHAT_FLOW, s)
}

// ============ Agents ============

export function getAgents(): CustomAgent[] {
  const custom = loadArrayLS<CustomAgent>(LS_KEY_AGENTS, [])
  return [...DEFAULT_BUILT_IN_AGENTS, ...custom]
}

export function getCustomAgents(): CustomAgent[] {
  return loadArrayLS<CustomAgent>(LS_KEY_AGENTS, [])
}

export function saveAgent(agent: CustomAgent): void {
  const list = getCustomAgents()
  const idx = list.findIndex(a => a.id === agent.id)
  if (idx >= 0) {
    list[idx] = { ...agent, updatedAt: new Date().toISOString() }
  } else {
    list.push(agent)
  }
  saveLS(LS_KEY_AGENTS, list)
}

export function deleteAgent(id: string): void {
  const list = getCustomAgents().filter(a => a.id !== id)
  saveLS(LS_KEY_AGENTS, list)
}

// ============ MCP Servers ============

export function getMCPServers(): MCPServerConfig[] {
  return loadArrayLS<MCPServerConfig>(LS_KEY_MCP, [])
}

export function saveMCPServer(server: MCPServerConfig): void {
  const list = getMCPServers()
  const idx = list.findIndex(s => s.id === server.id)
  if (idx >= 0) list[idx] = server
  else list.push(server)
  saveLS(LS_KEY_MCP, list)
}

export function deleteMCPServer(id: string): void {
  saveLS(LS_KEY_MCP, getMCPServers().filter(s => s.id !== id))
}

// ============ Rules（项目级，存 .metago/） ============

export async function loadRulesFromWorkspace(): Promise<RulesConfig> {
  try {
    const fs = await getFS()
    const rules: RulesConfig = {
      userRules: '',
      projectRules: '',
      pathRules: [],
    }
    try {
      rules.userRules = await fs.readFile('.metago/user_rules.md')
    } catch { /* 不存在则空 */ }
    try {
      rules.projectRules = await fs.readFile('.metago/project_rules.md')
    } catch { /* 不存在则空 */ }
    try {
      const raw = await fs.readFile('.metago/path_rules.json')
      rules.pathRules = JSON.parse(raw)
    } catch { /* 不存在则空 */ }
    return rules
  } catch {
    return { userRules: '', projectRules: '', pathRules: [] }
  }
}

export async function saveRulesToWorkspace(rules: RulesConfig): Promise<void> {
  const fs = await getFS()
  try {
    await fs.writeFile('.metago/user_rules.md', rules.userRules)
    await fs.writeFile('.metago/project_rules.md', rules.projectRules)
    await fs.writeFile('.metago/path_rules.json', JSON.stringify(rules.pathRules, null, 2))
  } catch (e) {
    console.error('[settingsStore] 保存规则失败', e)
    throw e
  }
}

// ============ Skills（项目级，存 .metago/skills/） ============

export function getCustomSkills(): CustomSkill[] {
  return loadArrayLS<CustomSkill>(LS_KEY_SKILLS, [])
}

export function saveCustomSkill(skill: CustomSkill): void {
  const list = getCustomSkills()
  const idx = list.findIndex(s => s.id === skill.id)
  if (idx >= 0) list[idx] = skill
  else list.push(skill)
  saveLS(LS_KEY_SKILLS, list)
}

export function deleteCustomSkill(id: string): void {
  saveLS(LS_KEY_SKILLS, getCustomSkills().filter(s => s.id !== id))
}

// ============ Index Docs ============

export function getIndexDocs(): IndexDocEntry[] {
  return loadArrayLS<IndexDocEntry>(LS_KEY_INDEX_DOCS, [])
}

export function saveIndexDoc(doc: IndexDocEntry): void {
  const list = getIndexDocs()
  const idx = list.findIndex(d => d.id === doc.id)
  if (idx >= 0) list[idx] = doc
  else list.push(doc)
  saveLS(LS_KEY_INDEX_DOCS, list)
}

export function deleteIndexDoc(id: string): void {
  saveLS(LS_KEY_INDEX_DOCS, getIndexDocs().filter(d => d.id !== id))
}

// ============ Hooks ============

export function getHooks(): HookConfig[] {
  return loadArrayLS<HookConfig>(LS_KEY_HOOKS, [])
}

export function saveHook(hook: HookConfig): void {
  const list = getHooks()
  const idx = list.findIndex(h => h.id === hook.id)
  if (idx >= 0) list[idx] = hook
  else list.push(hook)
  saveLS(LS_KEY_HOOKS, list)
}

export function deleteHook(id: string): void {
  saveLS(LS_KEY_HOOKS, getHooks().filter(h => h.id !== id))
}

// ============ 全部加载 ============

export async function loadAllSettings(): Promise<AllSettings> {
  const [rules] = await Promise.all([loadRulesFromWorkspace()])
  return {
    general: getGeneralSettings(),
    chatFlow: getChatFlowSettings(),
    agents: getAgents(),
    mcpServers: getMCPServers(),
    rules,
    skills: getCustomSkills(),
    indexDocs: getIndexDocs(),
    hooks: getHooks(),
  }
}

// ============ 工具函数 ============

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 按名称查找智能体（支持 @Builder / @构建器 等提及形式）
 *
 * 匹配规则：
 *   - 精确匹配 name（如"构建器"）
 *   - 大小写不敏感匹配 name（如"builder"→"Builder"）
 *   - 匹配 id（如"builtin-builder"）
 *
 * 用于 @提及实际切换智能体（对标 Trae @Builder）
 */
export function findAgentByName(name: string): CustomAgent | undefined {
  if (!name) return undefined
  const agents = getAgents()
  const lower = name.toLowerCase().trim()
  return agents.find(a =>
    a.name === name ||
    a.name.toLowerCase() === lower ||
    a.id === lower ||
    a.id === name,
  )
}

/**
 * 解析文本中所有 @智能体 提及
 *
 * 返回所有匹配到的智能体（去重）。
 * 用于在发送消息时实际切换 systemPrompt 和工具集。
 */
export function parseAgentMentions(text: string): CustomAgent[] {
  if (!text) return []
  const mentions = text.match(/@([^\s@#,]+)/g) || []
  const names = mentions.map(m => m.slice(1)) // 去掉 @
  const seen = new Set<string>()
  const agents: CustomAgent[] = []
  for (const name of names) {
    const agent = findAgentByName(name)
    if (agent && !seen.has(agent.id)) {
      seen.add(agent.id)
      agents.push(agent)
    }
  }
  return agents
}

/**
 * 移除文本中的 @智能体 提及（发送给 LLM 前清理）
 *
 * 保留其他文本和 #上下文 提及不变。
 */
export function stripAgentMentions(text: string): string {
  if (!text) return ''
  return text.replace(/@([^\s@#,]+)/g, '').replace(/\s{2,}/g, ' ').trim()
}
