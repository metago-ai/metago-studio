/**
 * BYOK（Bring Your Own Key）服务 - 2026-07-05
 *
 * 职责：
 *   1. AES-GCM 加密存储用户 API Key（不再明文存 localStorage）
 *   2. 验证 Key 有效性（测试调用）
 *   3. 同步到云端（byok 云函数，加密存储）
 *   4. 提供给 aiProxy 的"使用 BYOK" 标识
 *
 * 加密方案：
 *   - 用户口令 → PBKDF2 → 256-bit AES Key
 *   - AES-GCM 加密 API Key
 *   - 加密后的密文存 localStorage + 云端 user_profiles.byokCipher
 *
 * 安全设计：
 *   - 永不明文存储 API Key
 *   - 用户口令不存储（丢失口令 = 数据丢失，需重新绑定）
 *   - 加密盐值每个用户唯一（防止彩虹表攻击）
 */

import { callFunction } from './cloudFunctions'
import { getCurrentTier } from './proGate'
import { getByokPolicy } from './pricing'

export type ByokProvider = 'deepseek' | 'openai' | 'anthropic' | 'glm'

export interface ByokConfig {
  enabled: boolean
  provider: ByokProvider
  /** AES-GCM 加密后的 API Key 密文（base64） */
  encryptedKey: string
  /** 加密盐值（base64，每个用户唯一） */
  salt: string
  /** 加密 IV（base64，每次绑定唯一） */
  iv: string
  /** KDF 迭代次数 */
  iterations: number
  baseUrl?: string
  model?: string
  boundAt: string
}

export interface ByokBindInput {
  provider: ByokProvider
  apiKey: string
  password: string
  baseUrl?: string
  model?: string
}

const BYOK_STORAGE_KEY = 'metago_byok_v2'
const PBKDF2_ITERATIONS = 100_000

// ============ AES-GCM 加密/解密 ============

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encryptString(plaintext: string, password: string): Promise<{
  ciphertext: string
  salt: string
  iv: string
  iterations: number
}> {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext),
  )
  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    salt: arrayBufferToBase64(salt.buffer),
    iv: arrayBufferToBase64(iv.buffer),
    iterations: PBKDF2_ITERATIONS,
  }
}

async function decryptString(
  ciphertext: string,
  password: string,
  saltB64: string,
  ivB64: string,
  iterations: number,
): Promise<string> {
  const salt = base64ToUint8Array(saltB64)
  const iv = base64ToUint8Array(ivB64)
  const key = await deriveKey(password, salt, iterations)
  const ciphertextBuf = base64ToArrayBuffer(ciphertext)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertextBuf,
  )
  return new TextDecoder().decode(plaintext)
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  return base64ToUint8Array(b64).buffer as ArrayBuffer
}

// ============ 持久化 ============

export function loadByokConfig(): ByokConfig | null {
  try {
    const raw = localStorage.getItem(BYOK_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ByokConfig
  } catch {
    return null
  }
}

function saveByokConfig(config: ByokConfig): void {
  try {
    localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(config))
  } catch (e) {
    console.error('[byokService] 保存 BYOK 配置失败', e)
  }
}

export function clearByokConfig(): void {
  localStorage.removeItem(BYOK_STORAGE_KEY)
}

export function isByokActive(): boolean {
  const config = loadByokConfig()
  return !!config?.enabled && !!config?.encryptedKey
}

export function isByokAllowed(): boolean {
  const tier = getCurrentTier()
  return getByokPolicy(tier).allowed
}

export function isByokRequired(): boolean {
  const tier = getCurrentTier()
  return getByokPolicy(tier).required
}

// ============ 绑定/解绑 ============

export async function bindByok(input: ByokBindInput): Promise<{ success: boolean; message: string }> {
  const tier = getCurrentTier()
  const policy = getByokPolicy(tier)
  if (!policy.allowed) {
    return { success: false, message: `${tier} 档位不支持 BYOK` }
  }
  if (!input.apiKey || !input.password) {
    return { success: false, message: 'API Key 和加密口令均为必填' }
  }
  if (input.password.length < 6) {
    return { success: false, message: '加密口令至少 6 位' }
  }

  // 验证 Key 有效性
  const validResult = await validateApiKey(input.provider, input.apiKey, input.baseUrl)
  if (!validResult.valid) {
    return { success: false, message: validResult.message || 'API Key 无效' }
  }

  // 加密存储
  const encrypted = await encryptString(input.apiKey, input.password)
  const config: ByokConfig = {
    enabled: true,
    provider: input.provider,
    encryptedKey: encrypted.ciphertext,
    salt: encrypted.salt,
    iv: encrypted.iv,
    iterations: encrypted.iterations,
    baseUrl: input.baseUrl,
    model: input.model,
    boundAt: new Date().toISOString(),
  }
  saveByokConfig(config)

  // 同步到云端（只存绑定元信息，不存密文）
  try {
    await callFunction('byok', {
      action: 'syncBinding',
      provider: input.provider,
      baseUrl: input.baseUrl,
      model: input.model,
      boundAt: config.boundAt,
    })
  } catch (e) {
    console.warn('[byokService] 云端同步失败（不影响本地使用）', e)
  }

  return { success: true, message: 'BYOK 绑定成功' }
}

export async function unbindByok(): Promise<void> {
  clearByokConfig()
  try {
    await callFunction('byok', { action: 'unbind' })
  } catch (e) {
    console.warn('[byokService] 云端解绑失败', e)
  }
}

export async function getDecryptedApiKey(password: string): Promise<{ success: boolean; apiKey?: string; message?: string }> {
  const config = loadByokConfig()
  if (!config || !config.encryptedKey) {
    return { success: false, message: '未绑定 BYOK' }
  }
  try {
    const apiKey = await decryptString(
      config.encryptedKey,
      password,
      config.salt,
      config.iv,
      config.iterations,
    )
    return { success: true, apiKey }
  } catch {
    return { success: false, message: '口令错误，无法解密 API Key' }
  }
}

// ============ 验证 API Key ============

async function validateApiKey(
  provider: ByokProvider,
  apiKey: string,
  baseUrl?: string,
): Promise<{ valid: boolean; message?: string }> {
  try {
    const res = await callFunction<{ valid: boolean; message?: string }>('byok', {
      action: 'validateKey',
      provider,
      apiKey,
      baseUrl,
    })
    if (res.code !== 0) {
      return { valid: false, message: res.message || 'API Key 验证失败' }
    }
    return { valid: !!res.data?.valid, message: res.data?.message }
  } catch (e) {
    return { valid: false, message: '验证服务异常，请稍后再试' }
  }
}

// ============ 给 aiProxy 使用的"BYOK 模式"标识 ============

export interface ByokRouteInfo {
  active: boolean
  provider?: ByokProvider
  baseUrl?: string
  model?: string
}

export function getByokRouteInfo(): ByokRouteInfo {
  const config = loadByokConfig()
  if (!config?.enabled) return { active: false }
  return {
    active: true,
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
  }
}
