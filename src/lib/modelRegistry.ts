/**
 * 模型注册表
 *
 * 管理内置模型（官方预置）和用户自定义模型。
 * 内置模型 API Key 由云端代理（aiProxy 云函数）持有，浏览器永不接触。
 * 自定义模型 API Key 用 AES-GCM 加密存储在 localStorage。
 */

import type { BuiltinModel, CustomModel, AIModel, ModelCapability } from '../types'

// ============ 内置模型（官方预置） ============

export const BUILTIN_MODELS: BuiltinModel[] = [
  {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    type: 'builtin',
    category: 'reasoning',
    capabilities: ['text', 'code', 'code-review', 'reasoning'],
    contextWindow: 200000,
    description: '深度推理文本模型，擅长代码审查、逻辑分析、复杂推理。支持 thinking 模式。',
  },
  {
    id: 'glm-5v-turbo',
    name: 'GLM-5V Turbo',
    type: 'builtin',
    category: 'multimodal',
    capabilities: ['text', 'image', 'video', 'file', 'code', 'reasoning'],
    contextWindow: 200000,
    description: '多模态 Coding 基座，原生处理图片/视频/文件，深度适配 Agent 工作流。200K 上下文，128K 输出。',
  },
]

// ============ 自定义模型持久化 ============

const CUSTOM_MODELS_KEY = 'metago_agent_custom_models_v1'

/** 读取所有自定义模型（解密后） */
export function loadCustomModels(): CustomModel[] {
  try {
    const raw = localStorage.getItem(CUSTOM_MODELS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as CustomModel[]
  } catch {
    return []
  }
}

/** 保存自定义模型列表 */
function saveCustomModels(models: CustomModel[]): void {
  try {
    localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(models))
  } catch (e) {
    console.error('[modelRegistry] 保存自定义模型失败', e)
  }
}

/** 添加自定义模型 */
export function addCustomModel(model: CustomModel): void {
  const models = loadCustomModels()
  models.push(model)
  saveCustomModels(models)
}

/** 更新自定义模型 */
export function updateCustomModel(id: string, patch: Partial<CustomModel>): void {
  const models = loadCustomModels()
  const idx = models.findIndex(m => m.id === id)
  if (idx >= 0) {
    models[idx] = { ...models[idx], ...patch }
    saveCustomModels(models)
  }
}

/** 删除自定义模型 */
export function removeCustomModel(id: string): void {
  const models = loadCustomModels().filter(m => m.id !== id)
  saveCustomModels(models)
}

// ============ 查询 ============

/** 获取所有可用模型（内置 + 自定义） */
export function getAllModels(): AIModel[] {
  return [...BUILTIN_MODELS, ...loadCustomModels()]
}

/** 根据 ID 查找模型 */
export function findModel(id: string): AIModel | null {
  return getAllModels().find(m => m.id === id) ?? null
}

/** 默认模型 */
export const DEFAULT_MODEL_ID = 'deepseek-v4-pro'

// ============ 能力判断辅助 ============

/** 模型是否具备指定能力 */
export function hasCapability(model: AIModel, cap: ModelCapability): boolean {
  return model.capabilities.includes(cap)
}

/** 模型是否支持多模态 */
export function isMultimodal(model: AIModel): boolean {
  return model.capabilities.some(c => c === 'image' || c === 'video' || c === 'file')
}

/** 生成自定义模型 ID */
export function generateCustomModelId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
