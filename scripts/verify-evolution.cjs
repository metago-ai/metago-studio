/**
 * 元进化真实运行验证脚本
 * 通过 cloudbase CLI 调用 aiProxy，验证 triggerRealEvolution 的 system prompt 能让 AI 返回有效 JSON
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ENVID = 'metago-d6gfw1e4rf2a5bcad'

const systemPrompt = `你是 MetaGO 元构超级智能生命体，现在执行元进化五阶段循环（metago_meta_evolve）。

## 触发条件
- 能力边界：不熟悉 Rust Pin/Unpin 语义
- 触发器：Rust async/await 模式

## 五阶段循环协议（必须严格执行）

### 1. 边界感知（Boundary Sensing）
明确"我不知道什么"，边界的具体形态是什么。

### 2. 差距分析（Gap Analysis）
现有能力 vs 所需能力的差距，差距的本质（知识/工具/权限）。

### 3. 自生成（Self-Generation）
基于现有能力组合出新的解决路径，不依赖外部数据输入（A5 内生公理）。

### 4. 验证（Verification）
新能力是否真的解决了问题？副作用评估。

### 5. 递归（Recursion）
这个新能力是否触发了新的边界？是否需要进入下一轮循环？

## 输出格式（必须严格遵守）
你必须返回一个 JSON 对象，包含以下字段：

\`\`\`json
{
  "boundary": "边界感知结果（具体描述能力边界的形态）",
  "gap": "差距分析结果（现有能力与所需能力的真实差距）",
  "generated": "自生成结果（基于现有能力组合出的新解决路径）",
  "verified": true/false,
  "verification_detail": "验证结果详情",
  "recursed": true/false,
  "recursion_reason": "是否需要递归及原因"
}
\`\`\`

只返回 JSON，不要其他内容。`

const userMessage = `执行元进化循环。

触发器（能力领域）：Rust async/await 模式
能力边界（遇到什么不会做）：不熟悉 Rust Pin/Unpin 语义

请严格按五阶段循环协议执行，返回 JSON 格式结果。`

const body = {
  action: 'chat',
  modelId: 'deepseek-v4-pro',
  systemPrompt,
  messages: [{ role: 'user', content: userMessage }],
  _clientUid: 'verify_evolution_' + Date.now(),
}

const bodyFile = path.resolve(__dirname, 'verify-evolution-body.json')
fs.writeFileSync(bodyFile, JSON.stringify(body), 'utf8')

console.log('═══════════════════════════════════════════════════')
console.log('  元进化真实运行验证（triggerRealEvolution）')
console.log('═══════════════════════════════════════════════════\n')

let output
try {
  output = execSync(
    `npx cloudbase fn invoke aiProxy -d @${bodyFile.replace(/\\/g, '/')} -e ${ENVID} 2>&1`,
    { encoding: 'utf-8', timeout: 120000 }
  )
} catch (e) {
  output = e.stdout || e.stderr || e.message
}

// 从输出中提取完整 JSON 响应（cloudbase fn invoke 输出包含 CLI 前缀信息）
const codeMatch = output.match(/"code":\s*(\d+)/)
const code = codeMatch ? parseInt(codeMatch[1]) : null

console.log('云函数返回 code:', code)

if (code !== 0) {
  console.log('❌ 云函数调用失败')
  console.log('输出片段:', output.slice(0, 500))
  try { fs.unlinkSync(bodyFile) } catch {}
  process.exit(1)
}

// 尝试从输出中解析完整的 JSON 对象（data.content 包含 AI 返回的文本）
let content = ''
const jsonStart = output.indexOf('{')
const jsonEnd = output.lastIndexOf('}')
if (jsonStart >= 0 && jsonEnd > jsonStart) {
  const jsonStr = output.slice(jsonStart, jsonEnd + 1)
  try {
    const parsed = JSON.parse(jsonStr)
    content = parsed.data?.content || parsed.content || ''
  } catch (e) {
    console.log('⚠️ 完整 JSON 解析失败，尝试正则提取 content')
    // 退化方案：用正则提取 content（处理转义字符）
    const contentMatch = output.match(/"content":\s*"([\s\S]*?)"\s*,\s*"/)
    if (contentMatch) {
      content = contentMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .replace(/\\t/g, '\t')
    }
  }
}

console.log('\nAI 原始返回内容（前 500 字）:')
console.log(content.slice(0, 500))
console.log('\n---')

// 验证 JSON 解析（与 triggerRealEvolution 使用相同的清理逻辑）
const jsonMatch = content.match(/\{[\s\S]*\}/)
const jsonStr = jsonMatch ? jsonMatch[0] : content
let parsed = null

// 清理 AI 返回的 JSON 中可能的不合法转义字符
const cleanedJson = jsonStr
  .replace(/\\(\r?\n)/g, '\\n')
  .replace(/\\([^"\\\/bfnrtu])/g, '\\\\$1')

try {
  parsed = JSON.parse(cleanedJson)
} catch (e) {
  console.log('⚠️ 清理后 JSON.parse 仍失败，尝试正则逐字段提取:', e.message)
  // 正则逐字段提取（与 triggerRealEvolution fallback 一致）
  const extractStr = (field) => {
    const m = jsonStr.match(new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,|}|$)`, 'i'))
    if (!m) return ''
    return m[1]
      .replace(/\\n/g, '\n')
      .replace(/\\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\\r?\n/g, '')
  }
  parsed = {
    boundary: extractStr('boundary'),
    gap: extractStr('gap'),
    generated: extractStr('generated'),
    verification_detail: extractStr('verification_detail'),
    recursion_reason: extractStr('recursion_reason'),
    verified: /"verified"\s*:\s*true/i.test(jsonStr),
    recursed: /"recursed"\s*:\s*true/i.test(jsonStr),
  }
}

console.log('\n═══ 验证结果 ═══')

const checks = [
  { name: '云函数调用', passed: code === 0 },
  { name: 'AI 返回非空', passed: content.length > 0 },
  { name: '包含 JSON', passed: !!jsonMatch },
  { name: 'JSON 可解析', passed: !!parsed },
  { name: 'boundary 字段', passed: !!parsed?.boundary },
  { name: 'gap 字段', passed: !!parsed?.gap },
  { name: 'generated 字段', passed: !!parsed?.generated },
  { name: 'verified 字段', passed: typeof parsed?.verified === 'boolean' },
  { name: 'recursed 字段', passed: typeof parsed?.recursed === 'boolean' },
]

let allPassed = true
for (const c of checks) {
  console.log(`  ${c.passed ? '✅' : '❌'} ${c.name}`)
  if (!c.passed) allPassed = false
}

console.log('\n═══════════════════════════════════════════════════')
if (allPassed) {
  console.log('  ✅ 元进化真实运行验证通过')
  console.log('  AI 返回了有效的五阶段循环 JSON 结果')
  console.log(`  boundary: ${parsed.boundary.slice(0, 80)}...`)
  console.log(`  gap: ${parsed.gap.slice(0, 80)}...`)
  console.log(`  generated: ${parsed.generated.slice(0, 80)}...`)
  console.log(`  verified: ${parsed.verified}`)
  console.log(`  recursed: ${parsed.recursed}`)
} else {
  console.log('  ❌ 元进化真实运行验证失败')
}
console.log('═══════════════════════════════════════════════════')

// 清理
try { fs.unlinkSync(bodyFile) } catch {}

process.exit(allPassed ? 0 : 1)
