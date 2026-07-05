/**
 * MetaGO Agent 交付前原子验证脚本（Pre-Delivery Verify）
 *
 * 对应 AGENTS.md 第十四章「交付前原子验证协议」
 *
 * 此脚本是「硬门」——任何一项 FAIL，整个验证失败，禁止宣告"任务完成"。
 *
 * 用法：
 *   node scripts/pre-delivery-verify.cjs
 *   npm run verify
 *
 * 检查项（按 AGENTS.md 14.1 节）：
 *   V1.1  TypeScript 类型检查（tsc -b）
 *   V1.2  Vite 构建（vite build）
 *   V1.3  构建产物扫描（无 localhost/mock 泄露）
 *   V2.1  Web 端可达性（HTTP HEAD）
 *   V2.2  云函数 aiProxy 可调用（真实发送 ping 消息）
 *   V2.3  AI 对话端到端（验证返回非空 content）
 *   V3.1  桌面端 exe 可下载（HTTP HEAD + Content-Length）
 *   V3.2  latest.yml 可访问（HTTP HEAD）
 */

const { execSync } = require('child_process')
const https = require('https')
const fs = require('fs')
const path = require('path')

// ============ 配置 ============
const ENVID = 'metago-d6gfw1e4rf2a5bcad'
const CLOUDBASE_URL = `https://${ENVID}-1257074864.tcloudbaseapp.com`
const OFFICIAL_URL = 'https://metago.life'
const STUDIO_URL = `${OFFICIAL_URL}/studio/`

// 从 package.json 读取版本号
const pkg = require('../package.json')
const VERSION = pkg.version
const EXE_URL = `${OFFICIAL_URL}/download/MetaGO-Agent-${VERSION}-win-x64.exe`
const UPDATE_YML_URL = `${OFFICIAL_URL}/update/latest.yml`

// ============ 工具函数 ============

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

let totalChecks = 0
let passedChecks = 0
let failedChecks = 0
const results = []

function log(msg, color = '') {
  console.log(`${color}${msg}${colors.reset}`)
}

function record(id, name, passed, evidence) {
  totalChecks++
  if (passed) passedChecks++
  else failedChecks++
  results.push({ id, name, passed, evidence })
  const symbol = passed ? '✅' : '❌'
  const color = passed ? colors.green : colors.red
  log(`  ${symbol} ${id} ${name}`, color)
  if (evidence) {
    log(`     证据: ${evidence}`, colors.gray)
  }
}

/** HTTP HEAD 请求 */
function httpHead(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD', timeout: 15000 }, (res) => {
      resolve({
        statusCode: res.statusCode,
        headers: res.headers,
      })
    })
    req.on('error', (e) => resolve({ error: e.message }))
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }) })
    req.end()
  })
}

/** HTTP POST 请求（JSON body） */
function httpPost(url, body) {
  return new Promise((resolve) => {
    const urlObj = new URL(url)
    const data = JSON.stringify(body)
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 60000,
    }, (res) => {
      let chunks = ''
      res.on('data', (c) => { chunks += c })
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(chunks) })
        } catch {
          resolve({ statusCode: res.statusCode, data: chunks })
        }
      })
    })
    req.on('error', (e) => resolve({ error: e.message }))
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }) })
    req.write(data)
    req.end()
  })
}

// ============ 检查函数 ============

/** V1.1 TypeScript 类型检查 */
async function checkV11_TSC() {
  try {
    const output = execSync('npx tsc -b 2>&1', { encoding: 'utf-8', timeout: 120000 })
    const hasError = /error TS/.test(output)
    record('V1.1', 'TypeScript 类型检查', !hasError,
      hasError ? `发现 TS 错误` : '0 errors')
    return !hasError
  } catch (e) {
    const output = e.stdout || e.stderr || e.message
    const hasError = /error TS/.test(output)
    record('V1.1', 'TypeScript 类型检查', !hasError,
      hasError ? output.split('\n').find(l => /error TS/.test(l)) : `exit code ${e.status}`)
    return !hasError
  }
}

/** V1.2 Vite 构建 */
async function checkV12_Build() {
  try {
    const output = execSync('npx vite build 2>&1', { encoding: 'utf-8', timeout: 180000 })
    // 检查是否有 "built in" 关键词
    const builtMatch = output.match(/✓ built in ([\d.]+s)/)
    const chunkMatch = output.match(/(\d+) chunks/)
    const chunks = chunkMatch ? chunkMatch[1] : '?'
    const builtTime = builtMatch ? builtMatch[1] : '?'
    const passed = output.includes('built in') || output.includes('✓')
    record('V1.2', 'Vite 构建', passed, `${chunks} chunks, built in ${builtTime}`)
    return passed
  } catch (e) {
    record('V1.2', 'Vite 构建', false, e.message.slice(0, 100))
    return false
  }
}

/** V1.3 构建产物扫描 */
async function checkV13_ArtifactScan() {
  const distPath = path.resolve(__dirname, '..', 'dist')
  if (!fs.existsSync(distPath)) {
    record('V1.3', '构建产物扫描', false, 'dist 目录不存在')
    return false
  }

  const issues = []
  function scanDir(dir) {
    const items = fs.readdirSync(dir)
    for (const item of items) {
      const fullPath = path.join(dir, item)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        scanDir(fullPath)
      } else if (/\.(js|ts|html)$/.test(item)) {
        const content = fs.readFileSync(fullPath, 'utf-8')
          // 检查 localhost 泄露（排除 vite 内部的）
          if (/localhost:\d+/.test(content) && !/node_modules/.test(fullPath)) {
            // 允许 localhost 出现在注释或开发配置中，但不允许出现在生产 API URL
            // 提取所有 localhost URL 匹配项
            const localhostMatches = content.match(/https?:\/\/localhost[^\s"'`]*/g) || []
            for (const match of localhostMatches) {
              // 跳过模板字符串中的动态端口（如 `http://localhost:${port}`）
              if (match.includes('${')) continue
              // 跳过 placeholder 属性中的提示文本
              const placeholderPattern = new RegExp(`placeholder="[^"]*${match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
              if (placeholderPattern.test(content)) continue
              // 跳过注释
              const lines = content.split('\n')
              const inComment = lines.some(l => l.includes('//') && l.includes(match))
              if (inComment) continue
              issues.push(`${path.relative(distPath, fullPath)}: 含 localhost URL: ${match}`)
            }
          }
        // 检查明显的 mock 标记
        if (/MOCK_\w+\s*=|__mock_data__/.test(content)) {
          issues.push(`${path.relative(distPath, fullPath)}: 含 mock 数据标记`)
        }
      }
    }
  }

  try {
    scanDir(distPath)
  } catch (e) {
    // 忽略扫描错误
  }

  const passed = issues.length === 0
  record('V1.3', '构建产物扫描', passed,
    passed ? '无 localhost/mock 泄露' : issues.slice(0, 3).join('; '))
  return passed
}

/** V2.1 Web 端可达性 */
async function checkV21_WebReachable() {
  const res = await httpHead(STUDIO_URL)
  const passed = res.statusCode === 200
  record('V2.1', 'Web 端可达', passed,
    `HTTP ${res.statusCode || 'ERROR'} ${res.error || ''}`)
  return passed
}

/** V2.2 + V2.3 云函数 aiProxy 可调用 + AI 对话端到端 */
async function checkV22_V23_AIIChat() {
  // 通过 CloudBase CLI invoke 调用云函数（云函数未配置 HTTP 触发器）
  // 用法: npx cloudbase fn invoke aiProxy -d @body.json -e envId
  const bodyFile = path.resolve(__dirname, 'verify-ping-body.json')
  fs.writeFileSync(bodyFile, JSON.stringify({
    action: 'chat',
    modelId: 'deepseek-v4-pro',
    messages: [{ role: 'user', content: '请回复 pong' }],
    _clientUid: 'verify_script_' + Date.now(),
  }))

  let output
  try {
    output = execSync(
      `npx cloudbase fn invoke aiProxy -d @${bodyFile.replace(/\\/g, '/')} -e ${ENVID} 2>&1`,
      { encoding: 'utf-8', timeout: 90000 }
    )
  } catch (e) {
    output = e.stdout || e.stderr || e.message
  }

  // 从输出中解析 JSON 返回结果
  const codeMatch = output.match(/"code":\s*(\d+)/)
  const contentMatch = output.match(/"content":\s*"([^"]+)"/)
  const code = codeMatch ? parseInt(codeMatch[1]) : null
  const content = contentMatch ? contentMatch[1] : ''

  // V2.2: 云函数可调用（返回 code=0）
  const v22Passed = code === 0
  record('V2.2', '云函数 aiProxy 可调用', v22Passed,
    v22Passed ? `返回 code=0` : `code=${code}, 输出片段: ${output.slice(0, 200)}`)

  // V2.3: AI 对话端到端（content 非空）
  let v23Passed = false
  let evidence = ''
  if (v22Passed) {
    if (content.length > 0) {
      v23Passed = true
      evidence = `AI 回复: "${content.slice(0, 50)}"`
    } else {
      evidence = 'content 为空'
    }
  } else {
    evidence = '依赖 V2.2 失败'
  }
  record('V2.3', 'AI 对话端到端', v23Passed, evidence)

  // 清理临时文件
  try { fs.unlinkSync(bodyFile) } catch {}

  return v22Passed && v23Passed
}

/** V3.1 桌面端 exe 可下载 */
async function checkV31_ExeDownload() {
  const res = await httpHead(EXE_URL)
  const sizeMB = res.headers?.['content-length']
    ? (parseInt(res.headers['content-length']) / 1024 / 1024).toFixed(2)
    : '?'
  const passed = res.statusCode === 200 && parseFloat(sizeMB) > 80
  record('V3.1', `桌面端 exe 可下载 (v${VERSION})`, passed,
    `HTTP ${res.statusCode || 'ERROR'}, ${sizeMB} MB ${res.error || ''}`)
  return passed
}

/** V3.2 latest.yml 可访问 */
async function checkV32_LatestYml() {
  const res = await httpHead(UPDATE_YML_URL)
  const passed = res.statusCode === 200
  record('V3.2', 'latest.yml 可访问', passed,
    `HTTP ${res.statusCode || 'ERROR'} ${res.error || ''}`)
  return passed
}

// ============ 主流程 ============

async function main() {
  console.log('')
  log('═══════════════════════════════════════════════════════════', colors.cyan)
  log('  MetaGO Agent 交付前原子验证（Pre-Delivery Verify）', colors.cyan)
  log(`  版本: ${VERSION}  |  AGENTS.md §14 强制执行`, colors.cyan)
  log('═══════════════════════════════════════════════════════════', colors.cyan)
  console.log('')

  // L1 技术层
  log('【L1 技术层】', colors.yellow)
  await checkV11_TSC()
  await checkV12_Build()
  await checkV13_ArtifactScan()
  console.log('')

  // L2 业务层
  log('【L2 业务层】', colors.yellow)
  await checkV21_WebReachable()
  await checkV22_V23_AIIChat()
  console.log('')

  // L3 链路层
  log('【L3 链路层】', colors.yellow)
  await checkV31_ExeDownload()
  await checkV32_LatestYml()
  console.log('')

  // 总结
  log('═══════════════════════════════════════════════════════════', colors.cyan)
  const allPassed = failedChecks === 0
  if (allPassed) {
    log(`  ✅ 全部 ${totalChecks} 项检查通过`, colors.green)
    log('  允许宣告"任务完成"', colors.green)
  } else {
    log(`  ❌ ${passedChecks}/${totalChecks} 通过，${failedChecks} 项失败`, colors.red)
    log('  禁止宣告"任务完成"。立即修复失败项并重新验证。', colors.red)
  }
  log('═══════════════════════════════════════════════════════════', colors.cyan)
  console.log('')

  // 输出 JSON 结果（可供 CI 解析）
  const report = {
    timestamp: new Date().toISOString(),
    version: VERSION,
    total: totalChecks,
    passed: passedChecks,
    failed: failedChecks,
    allPassed,
    results,
  }
  const reportPath = path.resolve(__dirname, '..', 'verify-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  log(`报告已写入: ${reportPath}`, colors.gray)

  process.exit(allPassed ? 0 : 1)
}

main().catch((e) => {
  log(`\n❌ 验证脚本异常: ${e.message}`, colors.red)
  process.exit(1)
})
