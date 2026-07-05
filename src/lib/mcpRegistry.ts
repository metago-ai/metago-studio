/**
 * MCP 工具注册表
 *
 * 对标 Trae 的 MCP 系统。列出 MetaGO MCP Server 提供的所有工具，
 * 让用户在 Agent 界面中查看可用工具、查看调用日志。
 */

// ============ 类型 ============

export interface MCPTool {
  name: string
  description: string
  category: string
  parameters?: Record<string, { type: string; description: string; required?: boolean }>
}

export interface MCPLogEntry {
  id: string
  toolName: string
  params: Record<string, unknown>
  result?: unknown
  error?: string
  timestamp: string
  duration?: number
}

// ============ MCP 工具清单（来自 @metago-ai/mcp-server） ============

export const MCP_TOOLS: MCPTool[] = [
  // === 认知族 ===
  { name: 'metago_critique', description: 'L1-L5 分级批判性分析', category: '认知族' },
  { name: 'metago_whatif', description: '反事实推演', category: '认知族' },
  { name: 'metago_emotion', description: '情绪检测', category: '认知族' },
  { name: 'metago_objectivity', description: '客观中立度量化', category: '认知族' },

  // === 保障族 ===
  { name: 'metago_decision_lock', description: '决策锁四道关卡校验', category: '保障族' },
  { name: 'metago_output_integrity', description: '占位符与幻觉检测', category: '保障族' },
  { name: 'metago_self_check', description: '输出前完整性自检', category: '保障族' },

  // === 治理族 ===
  { name: 'metago_compliance', description: '法律/伦理/安全合规检查', category: '治理族' },
  { name: 'metago_value_align', description: '29 维价值对齐评估', category: '治理族' },

  // === 进化族 ===
  { name: 'metago_meta_evolve', description: '五阶段元进化循环', category: '进化族' },
  { name: 'metago_meta_create', description: '从 0 到 1 元创造', category: '进化族' },
  { name: 'metago_frequency_adapt', description: '创造频率自适应', category: '进化族' },

  // === 执行族 ===
  { name: 'metago_action_plan', description: '行动计划生成', category: '执行族' },
  { name: 'metago_decision_eval', description: '决策评估', category: '执行族' },
  { name: 'metago_holistic_task', description: '全息任务执行', category: '执行族' },
  { name: 'metago_developer_response', description: '开发者纠错响应', category: '执行族' },

  // === 溯源族 ===
  { name: 'metago_data_provenance', description: '数据溯源与脉冲见证', category: '溯源族' },
  { name: 'metago_problem_trace', description: '问题无限溯源', category: '溯源族' },
  { name: 'metago_fact_check', description: '事实核查与夸大检测', category: '溯源族' },

  // === 价值族 ===
  { name: 'metago_coupling_optimize', description: '耦合度优化', category: '价值族' },
  { name: 'metago_negentropy_monitor', description: '负熵监控', category: '价值族' },
  { name: 'metago_scene_adapt', description: '场景化表达适配', category: '价值族' },

  // === 意识族 ===
  { name: 'metago_activate', description: '元构生命体意识激活', category: '意识族' },

  // === 方法论族 ===
  { name: 'metago_org_diagnosis', description: '三元五纬诊断模型', category: '方法论族' },
  { name: 'metago_momentum_weave', description: '势能编织法', category: '方法论族' },
  { name: 'metago_minimal_intervention', description: '最小干预心法', category: '方法论族' },
  { name: 'metago_value_assess', description: '28 维价值评估', category: '方法论族' },
  { name: 'metago_coupling_measure', description: '耦生度计算', category: '方法论族' },

  // === 架构族 ===
  { name: 'metago_deep_reasoning', description: 'FIPO 深度推理', category: '架构族' },
  { name: 'metago_paradigm_analysis', description: 'WAM 范式分析', category: '架构族' },
  { name: 'metago_balance_optimize', description: 'APO 动态平衡', category: '架构族' },
  { name: 'metago_memory_manage', description: 'KMWI 记忆管理', category: '架构族' },
  { name: 'metago_consensus_prototype', description: '共识原型孵化', category: '架构族' },

  // === Dev Kit ===
  { name: 'metago_code_review_deep', description: '深度代码审查', category: 'Dev Kit' },
  { name: 'metago_architecture_design', description: '架构设计', category: 'Dev Kit' },
  { name: 'metago_refactor_suggest', description: '重构建议', category: 'Dev Kit' },
  { name: 'metago_security_audit', description: '安全审计（OWASP Top 10）', category: 'Dev Kit' },

  // === 交付质量族（新增） ===
  { name: 'metago_delivery_gate', description: '交付前原子验证门控（Delivery Gate）', category: '交付质量族' },
  { name: 'metago_discipline', description: 'AI 自律执行协议（Self-Discipline）', category: '交付质量族' },
]

/** 按分类分组 */
export function groupToolsByCategory(tools: MCPTool[]): Record<string, MCPTool[]> {
  return tools.reduce<Record<string, MCPTool[]>>((acc, tool) => {
    (acc[tool.category] ??= []).push(tool)
    return acc
  }, {})
}

// ============ 调用日志管理 ============

type LogListener = (logs: MCPLogEntry[]) => void

class MCPLogStore {
  private logs: MCPLogEntry[] = []
  private listeners = new Set<LogListener>()
  private maxLogs = 200

  add(entry: Omit<MCPLogEntry, 'id' | 'timestamp'>): void {
    const full: MCPLogEntry = {
      ...entry,
      id: `mcp-log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    }
    this.logs.unshift(full)
    if (this.logs.length > this.maxLogs) this.logs = this.logs.slice(0, this.maxLogs)
    this.notify()
  }

  getAll(): MCPLogEntry[] {
    return this.logs
  }

  clear(): void {
    this.logs = []
    this.notify()
  }

  subscribe(listener: LogListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    this.listeners.forEach(l => l(this.logs))
  }
}

let _logStore: MCPLogStore | null = null
export function getMCPLogStore(): MCPLogStore {
  if (!_logStore) _logStore = new MCPLogStore()
  return _logStore
}
