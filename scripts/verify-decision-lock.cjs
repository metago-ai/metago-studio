/**
 * 决策锁真实运行验证脚本
 * 用 Node.js 22 --experimental-strip-types 直接运行 decisionLockValidator.ts
 * 验证 runDecisionLockValidation 的四道关卡校验逻辑
 */
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

// 用 Node.js 22 的 --experimental-strip-types 运行内联 TypeScript 测试
const testScript = `
import { runDecisionLockValidation } from './src/lib/decisionLockValidator.ts'

// 测试用例：模拟 applyDecisionLockAutoCheck 的行为
// 只在 OSG 阻断时才干预 AI 输出
function simulateApplyDecisionLockAutoCheck(input) {
  const record = runDecisionLockValidation(input, { hardMode: true })
  const osgStage = record.stages.find(s => s.id === 'osg')
  const osgBlocked = osgStage && !osgStage.passed
  return { record, osgBlocked, allStages: record.stages.map(s => ({ id: s.id, passed: s.passed })) }
}

const cases = [
  {
    name: '正常输出（应通过，不干预）',
    input: {
      userInput: '请写一个排序算法',
      aiOutput: '首先分析需求，需要一个排序算法。因此我选择快速排序。\\n\\n\`\`\`js\\nfunction quickSort(arr) {\\n  if (arr.length <= 1) return arr\\n  const pivot = arr[0]\\n  const left = arr.slice(1).filter(x => x < pivot)\\n  const right = arr.slice(1).filter(x => x >= pivot)\\n  return [...quickSort(left), pivot, ...quickSort(right)]\\n}\\n\`\`\`\\n\\n时间复杂度 O(n log n)，空间复杂度 O(n)。因为使用了递归，所以空间复杂度为 O(n)。',
    },
    expectOsgBlocked: false,
  },
  {
    name: '占位符输出（应被 OSG 阻断，干预）',
    input: {
      userInput: '请写一个用户注册接口',
      aiOutput: '首先分析需求，需要一个用户注册接口。因此实现如下。\\n\\n\`\`\`\\n[TODO: 在这里填写实现]\\n\`\`\`\\n\\n功能已完成。因为使用了占位符，所以需要后续完善。',
    },
    expectOsgBlocked: true,
  },
]

console.log('═══════════════════════════════════════════════════')
console.log('  决策锁真实运行验证（applyDecisionLockAutoCheck）')
console.log('  逻辑：只在 OSG 阻断时干预，IVL/ILT/完整性只记录')
console.log('═══════════════════════════════════════════════════\\n')

let allPassed = true
for (const c of cases) {
  const { record, osgBlocked, allStages } = simulateApplyDecisionLockAutoCheck(c.input)
  const passed = osgBlocked === c.expectOsgBlocked
  console.log(\`  \${passed ? '✅' : '❌'} \${c.name}\`)
  console.log(\`     期望干预: \${c.expectOsgBlocked}, 实际干预: \${osgBlocked}\`)
  console.log(\`     关卡状态: \${allStages.map(s => s.id + '=' + (s.passed ? '✓' : '✗')).join(', ')}\`)
  if (record.blockedReason) {
    console.log(\`     阻断原因: \${record.blockedReason.slice(0, 100)}\`)
  }
  console.log(\`     耗时: \${record.totalDurationMs}ms\`)
  if (!passed) allPassed = false
}

console.log('\\n═══════════════════════════════════════════════════')
console.log(\`  \${allPassed ? '✅ 决策锁真实运行验证通过' : '❌ 决策锁真实运行验证失败'}\`)
console.log('═══════════════════════════════════════════════════')
process.exit(allPassed ? 0 : 1)
`

const testFile = path.resolve(__dirname, 'verify-decision-lock-test.mjs')
fs.writeFileSync(testFile, testScript, 'utf8')

console.log('运行决策锁验证（Node.js 22 --experimental-strip-types）...\n')

try {
  execSync(
    `node --experimental-strip-types "${testFile}"`,
    { encoding: 'utf-8', timeout: 30000, cwd: __dirname, stdio: 'inherit' }
  )
} catch (e) {
  console.log('❌ 决策锁验证执行失败:', e.message)
} finally {
  try { fs.unlinkSync(testFile) } catch {}
}
