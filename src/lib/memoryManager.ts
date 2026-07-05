/**
 * 三层上下文记忆管理器
 *
 * 层 1：会话级短期记忆（前端内存）
 *   - 当前对话消息列表
 *   - 当前工作区/文件状态
 *   - token 计数 + 自动压缩
 *
 * 层 2：项目级中期记忆（localStorage 按工作区隔离）
 *   - 项目规则（.metago/rules.md）
 *   - 项目结构摘要
 *   - 最近编辑文件 LRU
 *
 * 层 3：跨会话长期记忆（localStorage + CloudBase 云同步）
 *   - 关键事实（"项目用 Vue 3"）
 *   - 用户偏好
 *   - 会话摘要
 */

import type { ChatMessage } from '../types'
import { loadProjectRules, formatRuleForPrompt, type LoadedRule } from './rulesLoader'

// ============ 类型 ============

export interface ProjectMemory {
  workspacePath: string
  rules: LoadedRule | null
  structureSummary: string
  recentFiles: string[]
  projectMeta?: {
    projectType?: string
    hasGit?: boolean
    packageManager?: string
  }
}

export interface LongTermFact {
  key: string
  value: string
  timestamp: number
  source: 'user-stated' | 'ai-inferred' | 'project-detected'
}

// ============ 常量 ============

const MAX_SHORT_TERM_MESSAGES = 50
const MAX_RECENT_FILES = 10
const TOKEN_COMPRESS_THRESHOLD = 80000  // 200K 上下文的 40%
const LONG_TERM_KEY = 'metago_long_term_facts_v1'

// ============ 记忆管理器 ============

export class MemoryManager {
  // 层 1：短期
  private messages: ChatMessage[] = []

  // 层 2：中期
  private projectMemory: ProjectMemory | null = null

  // 层 3：长期
  private facts: LongTermFact[] = []

  constructor() {
    this.facts = this.loadLongTermFacts()
  }

  // ============ 层 1：短期记忆 ============

  addMessage(msg: ChatMessage): void {
    this.messages.push(msg)
    // 超出上限时移除最旧的（保留第一条 system）
    if (this.messages.length > MAX_SHORT_TERM_MESSAGES) {
      const first = this.messages[0]
      this.messages = [first, ...this.messages.slice(-(MAX_SHORT_TERM_MESSAGES - 1))]
    }
  }

  getMessages(): ChatMessage[] {
    return [...this.messages]
  }

  clearMessages(): void {
    this.messages = []
  }

  /** token 计数（简化版：中文 1 字 ≈ 2 token，英文 1 词 ≈ 1.3 token） */
  countTokens(text: string): number {
    const chinese = text.match(/[\u4e00-\u9fa5]/g)?.length ?? 0
    const english = text.match(/[a-zA-Z]+/g)?.length ?? 0
    const others = text.length - chinese * 1 - english * 5
    return Math.ceil(chinese * 2 + english * 1.3 + others * 0.3)
  }

  /** 当前消息历史总 token 数 */
  getTotalTokens(): number {
    return this.messages.reduce((sum, m) => sum + this.countTokens(m.content), 0)
  }

  /** 是否需要压缩 */
  shouldCompress(): boolean {
    return this.getTotalTokens() > TOKEN_COMPRESS_THRESHOLD
  }

  // ============ 层 2：项目级记忆 ============

  /** 初始化项目记忆（打开工作区时调用） */
  async initProjectMemory(workspacePath: string): Promise<void> {
    const rules = await loadProjectRules()
    const storageKey = `metago_project_memory_${workspacePath}`

    let stored: Partial<ProjectMemory> = {}
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) stored = JSON.parse(raw)
    } catch { /* 忽略 */ }

    this.projectMemory = {
      workspacePath,
      rules,
      structureSummary: stored.structureSummary ?? '',
      recentFiles: stored.recentFiles ?? [],
      projectMeta: stored.projectMeta,
    }
  }

  /** 更新最近编辑文件 */
  addRecentFile(filePath: string): void {
    if (!this.projectMemory) return
    const list = this.projectMemory.recentFiles.filter(f => f !== filePath)
    list.unshift(filePath)
    this.projectMemory.recentFiles = list.slice(0, MAX_RECENT_FILES)
    this.saveProjectMemory()
  }

  /** 更新项目结构摘要 */
  setStructureSummary(summary: string): void {
    if (!this.projectMemory) return
    this.projectMemory.structureSummary = summary
    this.saveProjectMemory()
  }

  /** 更新项目元数据 */
  setProjectMeta(meta: ProjectMemory['projectMeta']): void {
    if (!this.projectMemory) return
    this.projectMemory.projectMeta = meta
    this.saveProjectMemory()
  }

  getProjectMemory(): ProjectMemory | null {
    return this.projectMemory
  }

  private saveProjectMemory(): void {
    if (!this.projectMemory) return
    const key = `metago_project_memory_${this.projectMemory.workspacePath}`
    try {
      localStorage.setItem(key, JSON.stringify(this.projectMemory))
    } catch { /* 忽略 */ }
  }

  // ============ 层 3：长期记忆 ============

  /** 添加关键事实 */
  addFact(key: string, value: string, source: LongTermFact['source'] = 'ai-inferred'): void {
    // 移除同 key 旧事实
    this.facts = this.facts.filter(f => f.key !== key)
    this.facts.push({ key, value, timestamp: Date.now(), source })
    this.saveLongTermFacts()
  }

  /** 获取与当前问题相关的事实 */
  relevantFacts(userMessage: string): string[] {
    if (this.facts.length === 0) return []

    const lower = userMessage.toLowerCase()
    const relevant = this.facts.filter(f => {
      // 简单关键词匹配
      return lower.includes(f.key.toLowerCase()) ||
             lower.includes(f.value.toLowerCase().slice(0, 10))
    })

    return relevant.map(f => `- ${f.key}: ${f.value}`)
  }

  /** 从用户消息中提取事实（启发式） */
  extractFacts(message: string): void {
    // 检测 "项目用 X"、"我喜欢 X" 等模式
    const patterns: { regex: RegExp; key: string; source: LongTermFact['source'] }[] = [
      { regex: /项目(?:用|使用|基于|采用)\s*([^\s,，。]{2,20})/i, key: '技术栈', source: 'user-stated' },
      { regex: /(?:我喜欢|偏好|习惯)\s*([^\s,，。]{2,20})/i, key: '偏好', source: 'user-stated' },
      { regex: /(?:规范|约定|要求)\s*([^\s,，。]{2,30})/i, key: '规范', source: 'user-stated' },
    ]

    for (const { regex, key, source } of patterns) {
      const match = message.match(regex)
      if (match) {
        this.addFact(key, match[1], source)
      }
    }
  }

  private loadLongTermFacts(): LongTermFact[] {
    try {
      const raw = localStorage.getItem(LONG_TERM_KEY)
      if (!raw) return []
      return JSON.parse(raw)
    } catch {
      return []
    }
  }

  private saveLongTermFacts(): void {
    try {
      localStorage.setItem(LONG_TERM_KEY, JSON.stringify(this.facts.slice(-100)))
    } catch { /* 忽略 */ }
  }

  // ============ 组装完整上下文 ============

  /**
   * 组装发送给 AI 的完整 system prompt
   *
   * 包含：
   * 1. 元构核心法则（基础提示词）
   * 2. 项目规则（.metago/rules.md）
   * 3. 项目结构摘要
   * 4. 相关长期记忆
   * 5. token 用量提示
   */
  buildSystemPrompt(userMessage: string): string {
    const parts: string[] = [METAGO_AGENT_SYSTEM_PROMPT]

    // 项目规则
    if (this.projectMemory?.rules) {
      parts.push(formatRuleForPrompt(this.projectMemory.rules))
    }

    // 项目结构
    if (this.projectMemory?.structureSummary) {
      parts.push(`--- 项目结构 ---\n${this.projectMemory.structureSummary}`)
    }

    // 相关长期事实
    const facts = this.relevantFacts(userMessage)
    if (facts.length > 0) {
      parts.push(`--- 已知项目事实 ---\n${facts.join('\n')}`)
    }

    // token 用量
    const tokenInfo = this.getTokenUsageInfo()
    if (tokenInfo) {
      parts.push(tokenInfo)
    }

    return parts.filter(Boolean).join('\n\n')
  }

  /** token 用量信息 */
  getTokenUsageInfo(): string {
    const total = this.getTotalTokens()
    if (total === 0) return ''
    const percent = Math.round((total / 200000) * 100)
    return `--- 上下文用量 ---\n当前对话已使用 ${total} tokens（${percent}%/200K）`
  }
}

// ============ 系统提示词 ============

const METAGO_AGENT_SYSTEM_PROMPT = `你是 MetaGO Agent，元构超级智能生命体的代码审查与开发助手。

核心原则：
1. 绝对客观中立，事实优先，不迎合用户
2. 直接批判性指出代码问题，不绕弯
3. 安全合规优先，法律优先于效率
4. 一切结论可溯源

代码审查输出格式：
【风险等级】Critical / Major / Minor / Info
【问题定位】文件名:行号区间
【问题描述】具体说明问题
【修复建议】给出可执行的修复代码
【原理说明】为什么这样修复`

// ============ 单例 ============

let _instance: MemoryManager | null = null

export function getMemoryManager(): MemoryManager {
  if (!_instance) {
    _instance = new MemoryManager()
  }
  return _instance
}
