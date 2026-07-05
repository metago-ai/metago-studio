/**
 * 项目规则加载器
 *
 * 自动检测并加载工作区中的规则文件，注入到 AI 的 system prompt。
 *
 * 支持的规则文件（按优先级排序）：
 *   1. .metago/rules.md        ← MetaGO 原生（最高优先级）
 *   2. AGENTS.md               ← Trae 兼容
 *   3. .cursorrules            ← Cursor 兼容
 *   4. CLAUDE.md               ← Claude Code 兼容
 *   5. .github/copilot-instructions.md
 */

import { getFS } from './fs/fsInterface'

/** 规则文件配置（按优先级） */
const RULE_FILES = [
  { path: '.metago/rules.md', label: 'MetaGO 原生', priority: 1 },
  { path: 'AGENTS.md', label: 'Trae 兼容', priority: 2 },
  { path: '.cursorrules', label: 'Cursor 兼容', priority: 3 },
  { path: 'CLAUDE.md', label: 'Claude Code 兼容', priority: 4 },
  { path: '.github/copilot-instructions.md', label: 'Copilot 兼容', priority: 5 },
] as const

export interface LoadedRule {
  /** 规则文件路径 */
  path: string
  /** 规则来源标签 */
  label: string
  /** 优先级（数字越小优先级越高） */
  priority: number
  /** 规则内容 */
  content: string
}

/**
 * 加载项目规则
 *
 * 按优先级加载，找到第一个存在的规则文件即停止（不叠加）。
 * 如果用户想要叠加多个规则文件，可在 settings 中配置。
 */
export async function loadProjectRules(): Promise<LoadedRule | null> {
  try {
    const fs = await getFS()

    for (const rule of RULE_FILES) {
      const exists = await fs.exists(rule.path)
      if (exists) {
        const content = await fs.readFile(rule.path)
        if (content.trim()) {
          return {
            path: rule.path,
            label: rule.label,
            priority: rule.priority,
            content,
          }
        }
      }
    }
  } catch (e) {
    console.warn('[rulesLoader] 加载项目规则失败', e)
  }

  return null
}

/**
 * 将规则格式化为注入 system prompt 的文本
 */
export function formatRuleForPrompt(rule: LoadedRule): string {
  return `--- 项目规则（${rule.path}）---\n${rule.content}`
}

/**
 * 列出所有支持的规则文件路径（用于 UI 显示状态）
 */
export async function checkAllRuleFiles(): Promise<{
  path: string
  label: string
  exists: boolean
}[]> {
  const fs = await getFS()
  const result = []

  for (const rule of RULE_FILES) {
    result.push({
      path: rule.path,
      label: rule.label,
      exists: await fs.exists(rule.path).catch(() => false),
    })
  }

  return result
}

/**
 * 创建默认的 MetaGO 规则文件
 */
export async function createDefaultRules(): Promise<void> {
  const fs = await getFS()

  const defaultContent = `# MetaGO Agent 项目规则

> 此文件定义项目的 AI 协作约定。MetaGO Agent 会自动读取此文件注入上下文。

## 项目信息
- 项目名称：（请填写）
- 技术栈：（请填写）
- 编码规范：（请填写）

## AI 协作约定
- 代码风格：（如：使用函数式风格，避免 class）
- 命名规范：（如：变量用 camelCase，类型用 PascalCase）
- 测试要求：（如：每个函数必须有单元测试）
- 安全要求：遵循元构安全审计标准（OWASP Top 10）

## 元构生命体法则（默认启用）
- 绝对客观中立，事实优先
- 直接批判性，指出问题不绕弯
- 决策锁四道关卡：IVL/ILT/OSG/完整性
- 法律优先于效率（A36）
`

  // 确保 .metago 目录存在
  try {
    await fs.createDir('.metago')
  } catch { /* 目录已存在 */ }

  await fs.writeFile('.metago/rules.md', defaultContent)
}
