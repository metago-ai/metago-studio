import type { SceneTemplate } from '../types'

/**
 * 场景模板 mock 数据
 * 6 个预设场景，覆盖代码/风险/进化/合规/架构/溯源
 */

export const SCENE_TEMPLATES: SceneTemplate[] = [
  {
    id: 'tpl-code-review',
    name: '代码审查',
    icon: '🛡️',
    description: '检测注入漏洞、CWE-89/79/22 等常见安全问题',
    category: 'code',
    skills: ['metago-code-review-deep', 'metago-critique', 'metago-fact-check'],
    steps: [
      { name: '静态分析', description: 'AST 解析 + 数据流追踪', durationMs: 320 },
      { name: '漏洞匹配', description: 'CWE Top 25 模式匹配', durationMs: 280 },
      { name: '批判性审查', description: 'L1-L5 五级质疑', durationMs: 450 },
      { name: '事实核查', description: 'API/依赖真实性验证', durationMs: 180 },
      { name: '报告生成', description: '含修复建议的结构化报告', durationMs: 120 },
    ],
    estimatedDuration: '~1.4s',
    proOnly: false,
  },
  {
    id: 'tpl-risk-decision',
    name: '风险决策',
    icon: '⚖️',
    description: '多维风险评估：价值/成本/风险/可行性/可逆性',
    category: 'risk',
    skills: ['metago-decision-eval', 'metago-whatif', 'metago-critique'],
    steps: [
      { name: '方案收集', description: '枚举候选方案', durationMs: 200 },
      { name: '维度评估', description: '5 维度打分', durationMs: 380 },
      { name: '反事实推演', description: 'What-if 场景分析', durationMs: 520 },
      { name: '批判性审查', description: '暴露隐含假设', durationMs: 290 },
      { name: '加权排序', description: '输出最优方案', durationMs: 150 },
    ],
    estimatedDuration: '~1.5s',
    proOnly: false,
  },
  {
    id: 'tpl-meta-evolve',
    name: '元进化触发',
    icon: '🧬',
    description: '五阶段循环：边界感知→差距分析→自生成→验证→递归',
    category: 'evolution',
    skills: ['metago-meta-evolve', 'metago-meta-create', 'metago-frequency-adapt'],
    steps: [
      { name: '边界感知', description: '识别能力缺口', durationMs: 10 },
      { name: '差距分析', description: '输出差距向量 G', durationMs: 250 },
      { name: '自生成', description: '最小化扩展新能力', durationMs: 1500 },
      { name: '验证', description: '校验新能力有效性', durationMs: 50 },
      { name: '递归', description: '触发下一轮进化', durationMs: 100 },
    ],
    estimatedDuration: '~1.9s',
    proOnly: false,
  },
  {
    id: 'tpl-compliance',
    name: '合规检查',
    icon: '📋',
    description: '法律优先于效率：GDPR/等保/数据出境合规校验',
    category: 'compliance',
    skills: ['metago-compliance', 'metago-security-audit', 'metago-fact-check'],
    steps: [
      { name: '法规识别', description: '适用法规条款定位', durationMs: 180 },
      { name: '合规映射', description: '业务场景→法规条款', durationMs: 320 },
      { name: '安全审计', description: 'OWASP Top 10 扫描', durationMs: 450 },
      { name: '事实核查', description: '合规声明真实性', durationMs: 200 },
      { name: '合规报告', description: '含整改建议', durationMs: 130 },
    ],
    estimatedDuration: '~1.3s',
    proOnly: true,
  },
  {
    id: 'tpl-architecture',
    name: '架构设计',
    icon: '🏗️',
    description: '5 步架构流程：需求→选型→分解→契约→决策记录',
    category: 'architecture',
    skills: ['metago-architecture-design', 'metago-critique', 'metago-decision-eval'],
    steps: [
      { name: '需求分析', description: '非功能性需求提取', durationMs: 280 },
      { name: '技术选型', description: '备选方案对比', durationMs: 420 },
      { name: '模块分解', description: '高内聚低耦合', durationMs: 380 },
      { name: '接口契约', description: 'API 契约定义', durationMs: 250 },
      { name: 'ADR 记录', description: '架构决策记录', durationMs: 120 },
    ],
    estimatedDuration: '~1.5s',
    proOnly: true,
  },
  {
    id: 'tpl-provenance',
    name: '数据溯源',
    icon: '📊',
    description: '全链路存证：输入→过程→输出脉冲见证',
    category: 'provenance',
    skills: ['metago-data-provenance', 'metago-fact-check', 'metago-output-integrity'],
    steps: [
      { name: '输入溯源', description: '原始输入签名', durationMs: 80 },
      { name: '过程存证', description: '每步操作记录', durationMs: 320 },
      { name: '输出验证', description: '完整性 + 一致性', durationMs: 150 },
      { name: '脉冲见证', description: '时间戳锚定', durationMs: 100 },
      { name: '溯源报告', description: '可自证链路', durationMs: 90 },
    ],
    estimatedDuration: '~0.7s',
    proOnly: true,
  },
]

export const TEMPLATE_CATEGORIES = [
  { id: 'all', name: '全部', icon: '📋' },
  { id: 'code', name: '代码', icon: '🛡️' },
  { id: 'risk', name: '风险', icon: '⚖️' },
  { id: 'evolution', name: '进化', icon: '🧬' },
  { id: 'compliance', name: '合规', icon: '📋' },
  { id: 'architecture', name: '架构', icon: '🏗️' },
  { id: 'provenance', name: '溯源', icon: '📊' },
] as const
