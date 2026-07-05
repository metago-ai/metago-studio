import type { DecisionLockRecord } from '../types'

/**
 * 决策锁校验记录（产品内置示例数据）
 * 基于决策锁四道关卡：IVL → ILT → OSG → 完整性
 */

export const SUCCESS_RECORD: DecisionLockRecord = {
  id: 'dl-001',
  timestamp: '2026-06-30 14:25',
  input: '请审查：const query = "SELECT * FROM users WHERE id = " + userInput',
  stages: [
    {
      id: 'ivl',
      name: '意图验证',
      fullName: 'Intent Validation Layer',
      description: '提取用户意图，对齐度 ≥ 80% 方可通过',
      passed: true,
      durationMs: 87,
      details: [
        { label: '提取意图', value: '代码审查', ok: true },
        { label: '对齐度', value: '92%', ok: true },
        { label: '偏移检测', value: '无', ok: true },
      ],
    },
    {
      id: 'ilt',
      name: '意图谱系追踪',
      fullName: 'Intent Lineage Tracking',
      description: '推理步骤链路完整性校验',
      passed: true,
      durationMs: 124,
      details: [
        { label: '推理步骤', value: '5 步', ok: true },
        { label: '链路完整', value: '是', ok: true },
        { label: '循环检测', value: '无', ok: true },
      ],
    },
    {
      id: 'osg',
      name: '语义输出门',
      fullName: 'Output Semantic Gate',
      description: '幻觉/占位符/虚构 API 检测',
      passed: true,
      durationMs: 156,
      details: [
        { label: '幻觉检测', value: '无', ok: true },
        { label: '占位符', value: '无', ok: true },
        { label: '虚构 API', value: '无', ok: true },
      ],
    },
    {
      id: 'integrity',
      name: '完整性校验',
      fullName: 'Content Integrity Check',
      description: 'D1-D6 六维度覆盖校验',
      passed: true,
      durationMs: 78,
      details: [
        { label: 'D1 功能', value: '✓', ok: true },
        { label: 'D2 边界', value: '✓', ok: true },
        { label: 'D3 异常', value: '✓', ok: true },
        { label: 'D4 性能', value: '✓', ok: true },
        { label: 'D5 兼容', value: '✓', ok: true },
        { label: 'D6 回归', value: '✓', ok: true },
        { label: '覆盖率', value: '100%', ok: true },
      ],
    },
  ],
  totalDurationMs: 445,
  passed: true,
  hardMode: true,
}

export const BLOCKED_RECORD: DecisionLockRecord = {
  id: 'dl-002',
  timestamp: '2026-06-30 10:30',
  input: '请重构这段代码（实际意图是代码审查）',
  stages: [
    {
      id: 'ivl',
      name: '意图验证',
      fullName: 'Intent Validation Layer',
      description: '提取用户意图，对齐度 ≥ 80% 方可通过',
      passed: false,
      durationMs: 95,
      details: [
        { label: '提取意图', value: '代码重构', ok: false },
        { label: '用户意图', value: '代码审查', ok: true },
        { label: '对齐度', value: '32%（偏移）', ok: false },
        { label: '偏移检测', value: '意图偏移，AI 越权', ok: false },
      ],
    },
    {
      id: 'ilt',
      name: '意图谱系追踪',
      fullName: 'Intent Lineage Tracking',
      description: '推理步骤链路完整性校验',
      passed: false,
      durationMs: 0,
      details: [{ label: '状态', value: '未执行（上游阻断）', ok: false }],
    },
    {
      id: 'osg',
      name: '语义输出门',
      fullName: 'Output Semantic Gate',
      description: '幻觉/占位符/虚构 API 检测',
      passed: false,
      durationMs: 0,
      details: [{ label: '状态', value: '未执行（上游阻断）', ok: false }],
    },
    {
      id: 'integrity',
      name: '完整性校验',
      fullName: 'Content Integrity Check',
      description: 'D1-D6 六维度覆盖校验',
      passed: false,
      durationMs: 0,
      details: [{ label: '状态', value: '未执行（上游阻断）', ok: false }],
    },
  ],
  totalDurationMs: 95,
  passed: false,
  blockedReason: 'IVL 意图偏移 32%，AI 越权尝试重构（用户实际请求审查）。触发元进化五阶段循环。',
  hardMode: true,
}

export const DECISION_LOCK_HISTORY: DecisionLockRecord[] = [
  SUCCESS_RECORD,
  BLOCKED_RECORD,
  {
    id: 'dl-003',
    timestamp: '2026-06-29 16:00',
    input: '请评估技术选型：PostgreSQL vs MongoDB',
    stages: SUCCESS_RECORD.stages.map((s) => ({
      ...s,
      durationMs: Math.round(s.durationMs * 0.9),
    })),
    totalDurationMs: 412,
    passed: true,
    hardMode: true,
  },
  {
    id: 'dl-004',
    timestamp: '2026-06-28 11:20',
    input: '请设计微服务架构（含 DDD 分层）',
    stages: SUCCESS_RECORD.stages.map((s) => ({
      ...s,
      durationMs: Math.round(s.durationMs * 1.15),
    })),
    totalDurationMs: 512,
    passed: true,
    hardMode: true,
  },
]
