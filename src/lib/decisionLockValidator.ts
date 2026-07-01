/**
 * 决策锁强制校验器（Pro 版核心差异点）
 *
 * 与社区版软校验（提示词驱动）不同，Pro 版使用代码硬校验：
 * AI 无法绕过，每次输出必须通过四道关卡。
 *
 * 四道关卡：
 *   1. IVL  - 意图验证层（Intent Verification Layer）
 *   2. ILT  - 意图谱系追踪（Intent Lineage Tracking）
 *   3. OSG  - 语义输出门（Output Semantic Gate）
 *   4. 完整性校验（Completeness）
 *
 * 关卡耗时预算 < 500ms（PRD 4.1 性能要求）
 */

import type { DecisionLockStage, DecisionLockStageId, DecisionLockRecord } from '../types'

// ============ 检测规则 ============

/** 占位符正则：匹配 {{...}} ${...} [TBD] [TODO] <placeholder> 等 */
const PLACEHOLDER_PATTERNS = [
  /\{\{[^}]+\}\}/g, // {{variable}}
  /\$\{[^}]+\}/g, // ${variable}
  /\[TBD\]/gi, // [TBD]
  /\[TODO[^\]]*\]/gi, // [TODO] [TODO:xxx]
  /<placeholder>/gi, // <placeholder>
  /<your[_\s-]?name[_\s-]?here>/gi, // <your_name_here>
  /\bFIXME\b/gi, // FIXME
  /\bXXX\b/g, // XXX
  /占位符/g, // 中文占位符
  /待填写/g,
  /待补充/g,
  /请替换/g,
]

/** 虚构 API 检测：匹配不存在的常见 API 模式 */
const FAKE_API_PATTERNS = [
  /\bArray\.prototype\.flatMap\b/gi, // 实际存在但常被误用
  /fetch\(['"]https:\/\/api\.example\.com/gi, // example.com 域名
  /fetch\(['"]https:\/\/dummy\.json/gi, // dummy.json
  /\bMath\.randomInt\b/g, // 不存在的 Math 方法
  /\bString\.prototype\.reverse\b/g, // 不存在
  /\bObject\.deepClone\b/gi, // 不存在
  /console\.log\(`\$\{[^}]+\}`\)\s*;\s*\/\/\s*应该/g, // 注释"应该"
  /\blocalStorage\.getJson\b/gi, // 不存在
]

/** 伪造数据检测：匹配明显虚构的统计/数字 */
const FABRICATED_DATA_PATTERNS = [
  /\b\d{2,3}%\s*(?:的提升|的增长|的提高|的改善|的减少)/g, // "85%的提升" 无来源
  /\b(?:据统计|根据调查|数据显示|研究表明)\b[^。]*(?:\d{2,3}%|\d+\.?\d*倍)/g, // 无来源统计
  /\b99\.99(?:%|％)/g, // 99.99% 过于精确
  /\b100%[保证可靠安全]/g, // 100%保证
]

/** 完整性检测：未闭合括号、未结束语句 */
const INCOMPLETE_PATTERNS = [
  /\b(如果|假如|若|当)\b[^。；！？]*$/gm, // 条件未结论
  /\b(因为|由于)\b[^。；！？]*$/gm, // 原因未结果
  /\b(步骤如下|步骤为|包括以下)[^\d]*$/gm, // 列表未展开
  /\b(接下来|然后|之后)\s*$/gm, // 流程未继续
  /\b(let|const|var|function|class|if|for|while)\b[^{};]*$/gm, // 代码未闭合
  /```[^`]*$/gm, // 代码块未闭合
  /\[[^\]]*$/, // Markdown 链接未闭合
]

/** IVL 意图偏移检测词 */
const INTENT_DRIFT_KEYWORDS = [
  '顺便说一下', '顺便提一下', '另外', '此外还有', '需要注意的是', '补充一下',
  'by the way', 'BTW', 'in addition', 'additionally',
]

/** 中文停用字（用于过滤无意义子串） */
const STOP_CHARS = new Set([
  '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没', '看',
  '好', '请', '什', '么', '为', '吗', '呢', '吧', '啊', '哦', '嗯', '这',
  '那', '它', '他', '她', '们', '个', '把', '被', '让', '使', '给', '对',
])

// ============ 关卡实现 ============

export interface ValidationInput {
  userInput: string
  aiOutput: string
  context?: string
}

export interface StageResult {
  stage: DecisionLockStageId
  name: string
  fullName: string
  description: string
  passed: boolean
  durationMs: number
  details: { label: string; value: string; ok: boolean }[]
  blockReason?: string
}

/**
 * 关卡 1：IVL 意图验证层
 * 校验 AI 输出意图是否与用户需求一致
 */
function validateIVL(input: ValidationInput): StageResult {
  const start = performance.now()
  const userKeywords = extractKeywords(input.userInput)

  // 意图重叠度 = 用户关键词在输出文本中出现的比例
  const outputLower = input.aiOutput.toLowerCase()
  const matched = userKeywords.filter(k => outputLower.includes(k.toLowerCase()))
  const overlap = userKeywords.length > 0 ? matched.length / userKeywords.length : 0

  // 意图偏移检测：输出中是否包含大量无关话题词
  const driftHits = INTENT_DRIFT_KEYWORDS.filter(k =>
    input.aiOutput.toLowerCase().includes(k.toLowerCase())
  )

  // 通过条件：重叠度 >= 0.3 且偏移词 <= 2
  const passed = overlap >= 0.3 && driftHits.length <= 2

  return {
    stage: 'ivl',
    name: 'IVL',
    fullName: '意图验证层',
    description: '校验 AI 输出意图是否与用户需求一致',
    passed,
    durationMs: Math.round(performance.now() - start),
    details: [
      { label: '用户意图关键词数', value: `${userKeywords.length}`, ok: userKeywords.length > 0 },
      { label: '输出命中关键词数', value: `${matched.length}`, ok: matched.length > 0 },
      { label: '意图重叠度', value: `${(overlap * 100).toFixed(1)}%`, ok: overlap >= 0.3 },
      { label: '偏移触发词数', value: `${driftHits.length}`, ok: driftHits.length <= 2 },
    ],
    blockReason: passed ? undefined : `意图偏移 ${((1 - overlap) * 100).toFixed(0)}%（重叠度 ${overlap.toFixed(2)}，偏移词 ${driftHits.length}）`,
  }
}

/**
 * 关卡 2：ILT 意图谱系追踪
 * 校验意图来源是否经过完整思考链路
 */
function validateILT(input: ValidationInput): StageResult {
  const start = performance.now()
  const output = input.aiOutput

  // 思考链路标记：因为/所以/因此/由于/由此/从而/首先/其次/然后/最后
  const chainMarkers = [
    '因为', '所以', '因此', '由于', '由此', '从而', '首先', '其次', '然后', '最后', '基于', '根据',
    'because', 'therefore', 'thus', 'hence', 'since', 'due to', 'accordingly', 'consequently',
  ]
  const chainHits = chainMarkers.filter(m => output.toLowerCase().includes(m.toLowerCase()))

  // 推理步骤数：序号 +1. +1) +Step N
  const stepMatches = output.match(/\b(?:步骤[一二三四五六七八九十]|[1-9]\d?[.、)）]|Step\s+\d+)/gi) || []
  const stepCount = stepMatches.length

  // 因果连接：是否包含"X 导致 Y"模式
  const causalPatterns = (output.match(/(导致|引起|触发|产生|使得|让).{2,20}/g) || []).length

  // 通过条件：思考链路标记 >= 1 或 步骤数 >= 1
  const hasChain = chainHits.length >= 1 || stepCount >= 1
  const passed = hasChain

  return {
    stage: 'ilt',
    name: 'ILT',
    fullName: '意图谱系追踪',
    description: '校验意图来源是否经过完整思考链路',
    passed,
    durationMs: Math.round(performance.now() - start),
    details: [
      { label: '思考链路标记数', value: `${chainHits.length}`, ok: chainHits.length >= 1 },
      { label: '推理步骤数', value: `${stepCount}`, ok: stepCount >= 1 },
      { label: '因果连接数', value: `${causalPatterns}`, ok: true },
      { label: '思考链路完整', value: hasChain ? '是' : '否', ok: hasChain },
    ],
    blockReason: passed ? undefined : '输出缺少思考链路标记（因为/所以/首先/其次等），无法追溯推理过程',
  }
}

/**
 * 关卡 3：OSG 语义输出门
 * 检测输出是否含占位符/虚构 API/伪造数据
 */
function validateOSG(input: ValidationInput): StageResult {
  const start = performance.now()
  const output = input.aiOutput

  // 占位符检测
  const placeholderHits: string[] = []
  for (const pattern of PLACEHOLDER_PATTERNS) {
    const matches = output.match(pattern)
    if (matches) placeholderHits.push(...matches)
  }

  // 虚构 API 检测
  const fakeApiHits: string[] = []
  for (const pattern of FAKE_API_PATTERNS) {
    const matches = output.match(pattern)
    if (matches) fakeApiHits.push(...matches)
  }

  // 伪造数据检测
  const fabricatedHits: string[] = []
  for (const pattern of FABRICATED_DATA_PATTERNS) {
    const matches = output.match(pattern)
    if (matches) fabricatedHits.push(...matches)
  }

  const totalIssues = placeholderHits.length + fakeApiHits.length + fabricatedHits.length
  const passed = totalIssues === 0

  return {
    stage: 'osg',
    name: 'OSG',
    fullName: '语义输出门',
    description: '检测输出是否含占位符/虚构 API/伪造数据',
    passed,
    durationMs: Math.round(performance.now() - start),
    details: [
      { label: '占位符命中', value: `${placeholderHits.length}`, ok: placeholderHits.length === 0 },
      { label: '虚构 API 命中', value: `${fakeApiHits.length}`, ok: fakeApiHits.length === 0 },
      { label: '伪造数据命中', value: `${fabricatedHits.length}`, ok: fabricatedHits.length === 0 },
      { label: '总问题数', value: `${totalIssues}`, ok: totalIssues === 0 },
    ],
    blockReason: passed ? undefined : `检测到 ${totalIssues} 个问题（占位符 ${placeholderHits.length} + 虚构 API ${fakeApiHits.length} + 伪造数据 ${fabricatedHits.length}）`,
  }
}

/**
 * 关卡 4：完整性校验
 * 校验输出是否完整、无遗漏
 */
function validateCompleteness(input: ValidationInput): StageResult {
  const start = performance.now()
  const output = input.aiOutput

  // 未闭合模式检测
  const incompleteHits: string[] = []
  for (const pattern of INCOMPLETE_PATTERNS) {
    const matches = output.match(pattern)
    if (matches) incompleteHits.push(...matches)
  }

  // 长度检测：过短的输出通常不完整
  const outputLen = output.length
  const tooShort = outputLen < 20

  // 代码块闭合检测
  const codeBlockOpen = (output.match(/```/g) || []).length
  const codeBlockUnclosed = codeBlockOpen % 2 !== 0

  // Markdown 链接闭合
  const linkOpen = (output.match(/\[/g) || []).length
  const linkClose = (output.match(/\]/g) || []).length
  const linkUnclosed = linkOpen !== linkClose

  const passed = incompleteHits.length === 0 && !tooShort && !codeBlockUnclosed && !linkUnclosed

  return {
    stage: 'integrity',
    name: '完整性',
    fullName: '内容完整性校验',
    description: '校验输出是否完整、无遗漏',
    passed,
    durationMs: Math.round(performance.now() - start),
    details: [
      { label: '未闭合模式', value: `${incompleteHits.length}`, ok: incompleteHits.length === 0 },
      { label: '输出长度', value: `${outputLen} 字符`, ok: !tooShort },
      { label: '代码块闭合', value: codeBlockUnclosed ? '未闭合' : '已闭合', ok: !codeBlockUnclosed },
      { label: '链接闭合', value: linkUnclosed ? '未闭合' : '已闭合', ok: !linkUnclosed },
    ],
    blockReason: passed ? undefined : `输出不完整（未闭合 ${incompleteHits.length} + 长度 ${outputLen} + 代码块 ${codeBlockUnclosed ? '未闭合' : 'OK'}）`,
  }
}

// ============ 工具函数 ============

/** 英文停用词 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'against',
  'and', 'or', 'but', 'not', 'no', 'yes', 'this', 'that', 'these', 'those',
  'it', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
])

/** 提取文本关键词（中英文混合分词） */
function extractKeywords(text: string): string[] {
  if (!text || text.trim().length === 0) return []

  const keywords = new Set<string>()

  // 提取英文单词（>= 2 字符，非停用词）
  const englishWords = text.match(/[a-z]{2,}/gi) || []
  for (const w of englishWords) {
    const lower = w.toLowerCase()
    if (!STOP_WORDS.has(lower)) {
      keywords.add(lower)
    }
  }

  // 提取中文子串
  const chineseSegments = text.match(/[\u4e00-\u9fa5]+/g) || []
  for (const seg of chineseSegments) {
    if (seg.length <= 4) {
      // 短段直接作为关键词（过滤全为停用字的段）
      if (!Array.from(seg).every(c => STOP_CHARS.has(c))) {
        keywords.add(seg)
      }
    } else {
      // 长段提取 2-3 字子串（过滤含停用字的子串）
      for (let len = 3; len >= 2; len--) {
        for (let i = 0; i <= seg.length - len; i++) {
          const sub = seg.substring(i, i + len)
          if (!Array.from(sub).some(c => STOP_CHARS.has(c))) {
            keywords.add(sub)
          }
        }
      }
    }
  }

  return Array.from(keywords)
}

// ============ 主入口 ============

/**
 * 执行决策锁强制校验
 * @returns 校验记录（含四道关卡详情 + 总耗时 + 是否通过）
 */
export function runDecisionLockValidation(input: ValidationInput): DecisionLockRecord {
  const start = performance.now()

  // 四道关卡顺序执行：任一失败即阻断（短路模式）
  const stages: DecisionLockStage[] = []
  let blocked = false
  let blockedReason: string | undefined

  const stageExecutors: { id: DecisionLockStageId; fn: (i: ValidationInput) => StageResult }[] = [
    { id: 'ivl', fn: validateIVL },
    { id: 'ilt', fn: validateILT },
    { id: 'osg', fn: validateOSG },
    { id: 'integrity', fn: validateCompleteness },
  ]

  for (const executor of stageExecutors) {
    if (blocked) {
      // 已阻断的关卡标记为未执行
      stages.push({
        id: executor.id,
        name: executor.id.toUpperCase(),
        fullName: getStageFullName(executor.id),
        description: getStageDescription(executor.id),
        passed: false,
        durationMs: 0,
        details: [{ label: '状态', value: '未执行（前置关卡已阻断）', ok: false }],
      })
      continue
    }
    const result = executor.fn(input)
    stages.push({
      id: result.stage,
      name: result.name,
      fullName: result.fullName,
      description: result.description,
      passed: result.passed,
      durationMs: result.durationMs,
      details: result.details,
    })
    if (!result.passed) {
      blocked = true
      blockedReason = result.blockReason
    }
  }

  const totalDurationMs = Math.round(performance.now() - start)

  return {
    id: `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    input: input.aiOutput.slice(0, 200), // 截断存储
    stages,
    totalDurationMs,
    passed: !blocked,
    blockedReason,
  }
}

function getStageFullName(id: DecisionLockStageId): string {
  const map: Record<DecisionLockStageId, string> = {
    ivl: '意图验证层',
    ilt: '意图谱系追踪',
    osg: '语义输出门',
    integrity: '内容完整性校验',
  }
  return map[id]
}

function getStageDescription(id: DecisionLockStageId): string {
  const map: Record<DecisionLockStageId, string> = {
    ivl: '校验 AI 输出意图是否与用户需求一致',
    ilt: '校验意图来源是否经过完整思考链路',
    osg: '检测输出是否含占位符/虚构 API/伪造数据',
    integrity: '校验输出是否完整、无遗漏',
  }
  return map[id]
}

/**
 * 计算决策锁历史统计
 */
export function calculateLockStats(records: DecisionLockRecord[]) {
  const total = records.length
  const passed = records.filter(r => r.passed).length
  const blocked = total - passed
  const passRate = total > 0 ? (passed / total) * 100 : 0
  const avgDuration = total > 0
    ? records.reduce((sum, r) => sum + r.totalDurationMs, 0) / total
    : 0

  // 各关卡阻断次数
  const stageBlocks: Record<DecisionLockStageId, number> = {
    ivl: 0,
    ilt: 0,
    osg: 0,
    integrity: 0,
  }
  for (const r of records) {
    if (!r.passed) {
      for (const s of r.stages) {
        if (!s.passed && s.details[0]?.value !== '未执行（前置关卡已阻断）') {
          stageBlocks[s.id]++
        }
      }
    }
  }

  return {
    total,
    passed,
    blocked,
    passRate,
    avgDurationMs: Math.round(avgDuration),
    stageBlocks,
  }
}

const LOCK_HISTORY_KEY = 'metago_decision_lock_history_v1'

export function loadDecisionLockHistory(): DecisionLockRecord[] {
  try {
    const raw = localStorage.getItem(LOCK_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveDecisionLockHistory(records: DecisionLockRecord[]): void {
  try {
    localStorage.setItem(LOCK_HISTORY_KEY, JSON.stringify(records.slice(0, 500)))
  } catch {
    // localStorage 满了或不可用，忽略
  }
}
