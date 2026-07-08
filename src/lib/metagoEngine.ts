/**
 * MetaGO Engine V2 集成层
 *
 * 将 @metago-ai/engine@2.0.0 的核心能力集成到 Studio：
 * - KMWI 四层记忆管理（K知识→M记忆→W智慧→I直觉）
 * - SkillGenerator 技能智能生成（元创造五阶段）
 * - EvolutionEngine V2 元进化引擎（五阶段循环 + 三层自生成策略）
 * - DecisionLock 决策锁四道关卡
 * - AxiomValidator 公理验证
 *
 * 注意：engine package.json 的 types 指向 SDK/types.d.ts（仅接口），
 * 实际类和类型在 RUNTIME/dist/index.js，故从此路径导入。
 */

import MetaGOEngine, {
  type EvolutionResult,
  type CreationResult,
  type DecisionLockResult,
  type KMWIStats,
  type DecayRates,
  type MemoryLayer,
  type ValidationResult,
} from '@metago-ai/engine/RUNTIME/dist/index.js'

export type {
  EvolutionResult,
  CreationResult,
  DecisionLockResult,
  KMWIStats,
  DecayRates,
  MemoryLayer,
  ValidationResult,
}

class MetaGOEngineIntegration {
  private engine: MetaGOEngine | null = null
  private initialized = false

  async init(): Promise<boolean> {
    if (this.initialized) return true
    try {
      this.engine = new MetaGOEngine()
      const ok = await this.engine.init()
      this.initialized = ok
      if (ok) {
        console.log('[MetaGOEngine] Engine V2.0.0 initialized', {
          axioms: 8,
          attributes: 7,
          protocols: 6,
          skills: 39,
        })
      }
      return ok
    } catch (e) {
      console.error('[MetaGOEngine] Failed to initialize:', e)
      this.initialized = false
      return false
    }
  }

  isReady(): boolean {
    return this.initialized && this.engine !== null
  }

  triggerEvolution(context?: {
    task?: string
    failure?: { type: string; message: string }
    feedback?: string
  }): Promise<EvolutionResult> {
    if (!this.engine) {
      return Promise.resolve({
        success: false,
        stage: 'PERCEPTION' as const,
        errors: ['engine_not_initialized'],
        timestamp: new Date().toISOString(),
        timing: [],
        couplingScore: 0,
        kmwiRecorded: false,
      })
    }
    return this.engine.evolve(context)
  }

  generateSkill(
    problemDomain: string,
    context?: { failure?: string; existingSkills?: string[] }
  ): Promise<CreationResult> {
    if (!this.engine) {
      return Promise.resolve({
        success: false,
        stage: 'DOMAIN_PERCEPTION' as const,
        type: 'capability' as const,
        skillName: '',
        skillContent: '',
        validated: false,
        provenance: [],
        couplingScore: 0,
        errors: ['engine_not_initialized'],
        timestamp: new Date().toISOString(),
        recursionTriggered: false,
      })
    }
    return this.engine.createSkill(problemDomain, context)
  }

  validateDecision(output: string, intent?: string, userRequest?: string): Promise<DecisionLockResult> {
    if (!this.engine) {
      return Promise.resolve({
        passed: false,
        gates: [],
        failedGates: ['engine_not_initialized'],
        timestamp: new Date().toISOString(),
        output,
      })
    }
    return this.engine.lock(output, intent, userRequest)
  }

  validateOutput(output: string, context?: { input?: string; decision?: string; capability?: unknown }) {
    if (!this.engine) return { results: [] as ValidationResult[], summary: { total: 0, pass: 0, fail: 0, warning: 0, criticalFail: 0 } }
    return this.engine.validate(output, context)
  }

  addKnowledge(content: string, category: string, tags?: string[], source?: string): string | null {
    if (!this.engine) return null
    return this.engine.kmwi.addKnowledge(content, category, tags, source)
  }

  addMemory(content: string, context: string, tags?: string[], source?: string): string | null {
    if (!this.engine) return null
    return this.engine.kmwi.addMemory(content, context, tags, source)
  }

  addWisdom(pattern: string, description: string, causeEffect: string, tags?: string[], source?: string): string | null {
    if (!this.engine) return null
    return this.engine.kmwi.addWisdom(pattern, description, causeEffect, tags, source)
  }

  addIntuition(insight: string, implicitKnowledge: string, tags?: string[], source?: string): string | null {
    if (!this.engine) return null
    return this.engine.kmwi.addIntuition(insight, implicitKnowledge, tags, source)
  }

  promoteToMemory(knowledgeId: string) {
    if (!this.engine) return null
    return this.engine.kmwi.promoteToMemory(knowledgeId)
  }

  promoteToWisdom(memoryId: string) {
    if (!this.engine) return null
    return this.engine.kmwi.promoteToWisdom(memoryId)
  }

  promoteToIntuition(wisdomId: string) {
    if (!this.engine) return null
    return this.engine.kmwi.promoteToIntuition(wisdomId)
  }

  queryMemory(layer: MemoryLayer, filter?: { tags?: string[]; category?: string; keyword?: string; limit?: number }) {
    if (!this.engine) return []
    return this.engine.kmwi.query(layer, filter)
  }

  getMemoryHealth(): KMWIStats | null {
    if (!this.engine) return null
    return this.engine.getMemoryHealth()
  }

  getMemoryDecay(): DecayRates | null {
    if (!this.engine) return null
    return this.engine.getMemoryDecay()
  }

  getEngineStatus(): string {
    if (!this.engine) return 'Engine not initialized'
    return this.engine.getStatus()
  }

  getEngineInfo(): {
    version: string
    axioms: number
    attributes: number
    protocols: number
    skills: number
    ready: boolean
  } {
    return {
      version: '2.0.0',
      axioms: 8,
      attributes: 7,
      protocols: 6,
      skills: 39,
      ready: this.isReady(),
    }
  }
}

export const engine = new MetaGOEngineIntegration()
