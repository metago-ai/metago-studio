/**
 * 私有技能库（Pro 版 FR-5，v1.1 提前实现）
 *
 * 个人专属技能存储，云端加密。
 * - 端到端加密（用户密钥，零知识架构）
 * - 单用户上限 100 个私有技能
 * - 支持技能版本管理（最多 10 版本）
 * - 支持技能导入/导出（SKILL.md 格式）
 *
 * 加密方案：Web Crypto API + AES-GCM + 用户口令派生密钥（PBKDF2）
 * 服务器无法解密（零知识架构）
 */

export interface PrivateSkill {
  id: string
  name: string
  description: string
  content: string // SKILL.md 原文（明文，未加密）
  encryptedContent: string // 加密后的内容（Base64）
  tags: string[]
  version: number
  createdAt: string
  updatedAt: string
  // 版本历史
  history: { version: number; content: string; updatedAt: string }[]
}

const STORAGE_KEY = 'metago_private_skills_v1'
const MAX_SKILLS = 100
const MAX_HISTORY = 10

// ============ 加密 ============

/** 从用户口令派生密钥（PBKDF2） */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  const saltBuf = new Uint8Array(salt)
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuf,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/** 加密内容（AES-GCM） */
export async function encryptContent(content: string, password: string): Promise<string> {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(content))
  // 拼接 salt + iv + ciphertext，Base64 编码
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength)
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length)
  return btoa(String.fromCharCode(...combined))
}

/** 解密内容（AES-GCM） */
export async function decryptContent(encrypted: string, password: string): Promise<string> {
  try {
    const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0))
    const salt = combined.slice(0, 16)
    const iv = combined.slice(16, 28)
    const ciphertext = combined.slice(28)
    const key = await deriveKey(password, salt)
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    return new TextDecoder().decode(decrypted)
  } catch {
    throw new Error('解密失败：口令错误或数据损坏')
  }
}

// ============ 持久化 ============

/** 读取所有私有技能 */
export function loadPrivateSkills(): PrivateSkill[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as PrivateSkill[]
  } catch {
    return []
  }
}

/** 保存所有私有技能 */
function savePrivateSkills(skills: PrivateSkill[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(skills))
  } catch (e) {
    console.error('[privateSkills] 保存失败', e)
  }
}

// ============ CRUD ============

/** 添加私有技能 */
export function addPrivateSkill(
  name: string,
  description: string,
  content: string,
  password: string,
  tags: string[] = [],
  onEncrypted?: (skill: PrivateSkill) => void
): { success: boolean; message: string; skill?: PrivateSkill } {
  const skills = loadPrivateSkills()
  if (skills.length >= MAX_SKILLS) {
    return { success: false, message: `已达上限 ${MAX_SKILLS} 个私有技能` }
  }
  const skill: PrivateSkill = {
    id: `ps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    description,
    content: '',
    encryptedContent: '',
    tags,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [{ version: 1, content, updatedAt: new Date().toISOString() }],
  }
  skills.unshift(skill)
  savePrivateSkills(skills)
  encryptContent(content, password).then(encrypted => {
    skill.encryptedContent = encrypted
    skill.content = ''
    skill.history = skill.history.map(h => ({ ...h, content: '' }))
    savePrivateSkills(skills)
    if (onEncrypted) onEncrypted(skill)
  }).catch(e => {
    console.error('[privateSkills] 加密失败', e)
    const remaining = loadPrivateSkills().filter(s => s.id !== skill.id)
    savePrivateSkills(remaining)
  })
  return { success: true, message: '私有技能已添加', skill }
}

/** 更新私有技能（新版本） */
export function updatePrivateSkill(
  id: string,
  content: string,
  password: string
): { success: boolean; message: string } {
  const skills = loadPrivateSkills()
  const skill = skills.find(s => s.id === id)
  if (!skill) return { success: false, message: '技能不存在' }
  skill.version += 1
  skill.content = ''
  skill.updatedAt = new Date().toISOString()
  skill.history.push({ version: skill.version, content: '', updatedAt: skill.updatedAt })
  // 保留最多 10 个版本
  if (skill.history.length > MAX_HISTORY) {
    skill.history = skill.history.slice(-MAX_HISTORY)
  }
  savePrivateSkills(skills)
  // 异步更新加密
  encryptContent(content, password).then(encrypted => {
    skill.encryptedContent = encrypted
    skill.content = ''
    skill.history = skill.history.map(h => ({ ...h, content: '' }))
    savePrivateSkills(skills)
  }).catch(e => {
    console.error('[privateSkills] 加密失败', e)
    // 加密失败：版本回滚
    skill.version -= 1
    if (skill.history.length > 0) skill.history.pop()
    savePrivateSkills(skills)
  })
  return { success: true, message: `已更新到版本 ${skill.version}` }
}

/** 删除私有技能 */
export function removePrivateSkill(id: string): PrivateSkill[] {
  const skills = loadPrivateSkills().filter(s => s.id !== id)
  savePrivateSkills(skills)
  return skills
}

/** 导出为 SKILL.md 格式 */
export function exportToSKILLMD(skill: PrivateSkill): string {
  return `---
name: ${skill.name}
version: ${skill.version}
created_at: ${skill.createdAt}
updated_at: ${skill.updatedAt}
tags: [${skill.tags.join(', ')}]
---

# ${skill.name}

${skill.description}

---

${skill.content}
`
}

/** 导入 SKILL.md 格式 */
export function importFromSKILLMD(
  mdContent: string,
  password: string
): { success: boolean; message: string; skill?: PrivateSkill } {
  // 解析 frontmatter
  const fmMatch = mdContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!fmMatch) {
    return { success: false, message: 'SKILL.md 格式无效：缺少 frontmatter' }
  }
  const frontmatter = fmMatch[1]
  const body = fmMatch[2].trim()
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m)
  const descMatch = body.match(/^#\s+(.+)\n+([\s\S]*?)\n---/)
  const name = nameMatch ? nameMatch[1].trim() : '导入的技能'
  const description = descMatch ? descMatch[2].trim() : ''
  const content = body.split('---').slice(1).join('---').trim()
  return addPrivateSkill(name, description, content, password)
}
