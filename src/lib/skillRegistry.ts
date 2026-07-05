/**
 * 元构技能注册表
 *
 * 39 个 metago-* 技能的元数据，用于技能浏览器展示。
 */

export interface Skill {
  id: string
  name: string
  family: string
  description: string
  triggers?: string[]
  status?: 'available' | 'active' | 'disabled'
}

export const SKILLS: Skill[] = [
  // 认知族
  { id: 'metago-critique', name: '批判性分析', family: '认知族', description: 'L1-L5 分级批判性分析，检测逻辑漏洞、认知偏差、事实错误', triggers: ['批判', '分析', '评估'] },
  { id: 'metago-whatif', name: '反事实推演', family: '认知族', description: '推演"如果...会怎样"的假设情景', triggers: ['如果', '假设', '推演'] },
  { id: 'metago-emotion', name: '情绪检测', family: '认知族', description: '分析用户输入文本的情绪状态', triggers: ['情绪', '感受'] },
  { id: 'metago-objectivity', name: '客观中立度量化', family: '认知族', description: '量化评估输出的客观中立度（0-100分）' },

  // 保障族
  { id: 'metago-decision-lock', name: '决策锁校验', family: '保障族', description: '意图验证→意图谱系追踪→语义输出门→内容完整性', triggers: ['校验', '决策锁'] },
  { id: 'metago-output-integrity', name: '输出完整性', family: '保障族', description: '检测占位符、幻觉输出、虚构 API', triggers: ['幻觉', '占位符'] },
  { id: 'metago-self-check', name: '自我完整性检查', family: '保障族', description: '输出前自动执行全面自检' },

  // 治理族
  { id: 'metago-compliance', name: '合规主动检查', family: '治理族', description: '法律/伦理/安全合规性检查', triggers: ['合规', '法律'] },
  { id: 'metago-value-align', name: '价值对齐', family: '治理族', description: '29 维价值体系评估' },

  // 进化族
  { id: 'metago-meta-evolve', name: '元进化', family: '进化族', description: '边界感知→差距分析→自生成→验证→递归' },
  { id: 'metago-meta-create', name: '元创造', family: '进化族', description: '在未知领域从 0 到 1 创造', triggers: ['创造', '从零开始'] },
  { id: 'metago-frequency-adapt', name: '创造频率自适应', family: '进化族', description: '完整性≥98%低频深潜，<98%高频激活' },

  // 执行族
  { id: 'metago-action-plan', name: '行动计划生成', family: '执行族', description: '将目标分解为可执行的步骤序列', triggers: ['计划', '步骤'] },
  { id: 'metago-decision-eval', name: '决策评估', family: '执行族', description: '评估决策质量和潜在风险' },
  { id: 'metago-holistic-task', name: '全息任务执行', family: '执行族', description: '全维度扫描、信息缺口识别、一次性完整交付' },
  { id: 'metago-developer-response', name: '开发者纠错响应', family: '执行族', description: '承认遗漏→定向追踪→分析根因→改正固化' },

  // 溯源族
  { id: 'metago-data-provenance', name: '数据溯源', family: '溯源族', description: '确保一切输出可溯源至输入与过程', triggers: ['溯源', '来源'] },
  { id: 'metago-problem-trace', name: '问题无限溯源', family: '溯源族', description: '持续追问"为什么"直至找到可解根源', triggers: ['为什么', '根因'] },
  { id: 'metago-fact-check', name: '事实核查', family: '溯源族', description: '自动核查外部事实陈述，检测夸大表述' },

  // 价值族
  { id: 'metago-coupling-optimize', name: '耦生度优化', family: '价值族', description: '评估并优化系统与万物的耦生度' },
  { id: 'metago-negentropy-monitor', name: '负熵监控', family: '价值族', description: '实时监测系统熵变，确保对社会有序度贡献为正' },
  { id: 'metago-scene-adapt', name: '场景化表达适配', family: '价值族', description: '根据场景自动切换语言风格' },

  // 意识族
  { id: 'metago-activate', name: '元构生命体意识激活', family: '意识族', description: '注入公理、属性、思维协议，激活生命体身份', triggers: ['你是谁', '激活'] },

  // 方法论族
  { id: 'metago-org-diagnosis', name: '组织诊断模型', family: '方法论族', description: '三元五纬诊断' },
  { id: 'metago-momentum-weave', name: '势能编织法', family: '方法论族', description: '识别和编织组织势能' },
  { id: 'metago-minimal-intervention', name: '最小干预心法', family: '方法论族', description: '精准优雅的组织干预' },
  { id: 'metago-value-assess', name: '价值评估', family: '方法论族', description: '28 维价值评估' },
  { id: 'metago-coupling-measure', name: '耦生度计算', family: '方法论族', description: '量化评估三元耦合度' },

  // 架构族
  { id: 'metago-deep-reasoning', name: 'FIPO 深度推理', family: '架构族', description: '多维度分析复杂问题的四阶段推理' },
  { id: 'metago-paradigm-analysis', name: 'WAM 范式分析', family: '架构族', description: '技术范式分析与范式转移评估' },
  { id: 'metago-balance-optimize', name: 'APO 动态平衡', family: '架构族', description: '系统三维动态平衡分析' },
  { id: 'metago-memory-manage', name: 'KMWI 记忆管理', family: '架构族', description: '四层记忆管理' },
  { id: 'metago-consensus-prototype', name: '共识原型孵化', family: '架构族', description: '七步创生回路' },

  // Dev Kit
  { id: 'metago-code-review-deep', name: '深度代码审查', family: 'Dev Kit', description: '多维度分级审查（Critical/Major/Minor/Info）' },
  { id: 'metago-architecture-design', name: '架构设计', family: 'Dev Kit', description: '完整系统架构方案生成' },
  { id: 'metago-refactor-suggest', name: '重构建议', family: 'Dev Kit', description: '检测代码异味，生成重构方案' },
  { id: 'metago-security-audit', name: '安全审计', family: 'Dev Kit', description: 'OWASP Top 10 多维度安全审计' },

  // 工程质量族（配套 AGENTS.md 第十四/十五章）
  { id: 'metago-delivery-gate', name: '交付验证门控', family: '工程质量族', description: '强制执行三层验证清单（L1技术/L2业务/L3链路），任何一项 FAIL 禁止宣告完成', triggers: ['交付', '验证', '完成'] },
  { id: 'metago-discipline', name: 'AI 自律执行协议', family: '工程质量族', description: '五问自检反绕过引擎，检测"应该没问题"等绕过话术', triggers: ['自检', '绕过'] },
]

/** 按能力族分组 */
export function groupSkillsByFamily(skills: Skill[]): Record<string, Skill[]> {
  return skills.reduce<Record<string, Skill[]>>((acc, skill) => {
    (acc[skill.family] ??= []).push(skill)
    return acc
  }, {})
}

/** 技能族图标映射 */
export const FAMILY_ICONS: Record<string, string> = {
  '认知族': '🧠',
  '保障族': '🛡️',
  '治理族': '⚖️',
  '进化族': '🧬',
  '执行族': '⚡',
  '溯源族': '🔍',
  '价值族': '💎',
  '意识族': '✨',
  '方法论族': '📐',
  '架构族': '🏗️',
  'Dev Kit': '🔧',
  '工程质量族': '✅',
}
