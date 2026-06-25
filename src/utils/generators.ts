import type { KitConfigState, KitType, Skill, SkillCategory, VerticalDomain } from '../types'
import { PARENT_PACKAGE_NAME, PARENT_PACKAGE_VERSION } from '../data/skills'

// ============ 标签映射 ============
export const KIT_TYPE_LABELS: Record<KitType, string> = {
  'vertical-kit': '垂直包',
  'workflow': '工作流',
  'standalone': '独立包',
}

export const VERTICAL_LABELS: Record<VerticalDomain, string> = {
  'developer': '开发',
  'research': '研究',
  'product': '产品',
  'writing': '写作',
  'general': '通用',
}

export const CATEGORY_LABELS: Record<SkillCategory, string> = {
  'core': '核心',
  'dev': 'Dev Kit',
}

// ============ 工具函数 ============

/** 将字节大小格式化为人类可读字符串 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/** 累加技能预估大小 */
export function getTotalSize(skills: Skill[]): number {
  return skills.reduce((sum, s) => sum + s.estimatedSize, 0)
}

/** 将 kit name 转为可读标题：my-custom-kit -> My Custom Kit */
export function toTitleCase(name: string): string {
  return name
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

/** 当前日期 YYYY-MM-DD */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// ============ 生成器 ============

/** 生成 package.json 内容 */
export function generatePackageJson(config: KitConfigState, skills: Skill[]): string {
  const pkg = {
    name: config.name,
    version: config.version,
    description: config.description || 'MetaGO custom kit',
    license: 'MIT',
    metago: {
      type: config.type,
      vertical: config.vertical,
      skills: skills.map((s) => s.id),
      totalSkills: skills.length,
      parentPackage: `${PARENT_PACKAGE_NAME}@${PARENT_PACKAGE_VERSION}`,
    },
    peerDependencies: {
      [PARENT_PACKAGE_NAME]: PARENT_PACKAGE_VERSION,
    },
  }
  return JSON.stringify(pkg, null, 2)
}

/** 生成 README.md 内容 */
export function generateReadme(config: KitConfigState, skills: Skill[]): string {
  const title = toTitleCase(config.name) || 'Custom Kit'
  const description = config.description || 'MetaGO 定制 Kit'
  const lines: string[] = []

  lines.push(`# ${title}`)
  lines.push('')
  lines.push(`> ${description}`)
  lines.push('')
  lines.push(`## 技能清单（${skills.length} 个）`)
  lines.push('')
  lines.push('| # | 技能 | 描述 |')
  lines.push('|---|------|------|')
  skills.forEach((s, i) => {
    lines.push(`| ${i + 1} | ${s.id} | ${s.title} - ${s.description} |`)
  })
  lines.push('')
  lines.push('## 安装')
  lines.push('')
  lines.push(`前置条件：先安装 ${PARENT_PACKAGE_NAME}@${PARENT_PACKAGE_VERSION}`)
  lines.push('')
  lines.push('```bash')
  lines.push(`npm install ${config.name}@${config.version}`)
  lines.push('```')
  lines.push('')
  lines.push('## Kit 信息')
  lines.push('')
  lines.push(`- 类型：${KIT_TYPE_LABELS[config.type]}`)
  lines.push(`- 垂直领域：${VERTICAL_LABELS[config.vertical]}`)
  lines.push(`- 父包：${PARENT_PACKAGE_NAME}@${PARENT_PACKAGE_VERSION}`)
  lines.push('')
  lines.push('## 生成信息')
  lines.push('')
  lines.push('- 生成工具：MetaGO Studio')
  lines.push(`- 生成时间：${todayISO()}`)
  lines.push(`- 技能数：${skills.length}`)

  return lines.join('\n')
}

/** 生成 Kit 完整配置 JSON（用于下载） */
export function generateKitConfig(config: KitConfigState, skills: Skill[]): string {
  const kit = {
    name: config.name,
    version: config.version,
    description: config.description,
    type: config.type,
    typeLabel: KIT_TYPE_LABELS[config.type],
    vertical: config.vertical,
    verticalLabel: VERTICAL_LABELS[config.vertical],
    parentPackage: `${PARENT_PACKAGE_NAME}@${PARENT_PACKAGE_VERSION}`,
    skills: skills.map((s, i) => ({
      order: i + 1,
      id: s.id,
      title: s.title,
      description: s.description,
      category: s.category,
      categoryLabel: CATEGORY_LABELS[s.category],
      tags: s.tags,
      estimatedSize: s.estimatedSize,
    })),
    totalSkills: skills.length,
    totalEstimatedSize: getTotalSize(skills),
    generatedAt: new Date().toISOString(),
    generator: 'MetaGO Studio',
  }
  return JSON.stringify(kit, null, 2)
}

// ============ 文件 / 剪贴板操作 ============

/** 触发文件下载 */
export function downloadFile(filename: string, content: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 复制到剪贴板（带 fallback） */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 落入 fallback
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    return true
  } catch {
    return false
  }
}
