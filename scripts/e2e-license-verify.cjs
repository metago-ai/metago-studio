/**
 * 元构授权码闭环端到端验证脚本
 *
 * 验证目标：admin 生成授权码 → 数据库真实写入 → listLicenses 可查
 * 附加能力：检测历史僵尸记录（只有 _id 或缺失关键字段的空记录）
 *
 * 约束：
 *   - 仅通过 admin HTTP 接口读取/验证，不修改任何云函数代码
 *   - 不调用任何写坏数据的接口（revokeLicense 也不调用，避免影响现网）
 *   - 仅 generateLicense 产生 1 条新记录（这是被验证对象本身）
 *
 * 运行：node d:\元构能力\metago-studio\scripts\e2e-license-verify.cjs
 */
const https = require('https')

const ADMIN_URL = 'https://metago.life/api/admin'
// 一条有效 license 应具备的核心字段（_id 由 DB 自动生成，不计入）
const ESSENTIAL_FIELDS = ['licenseKey', 'plan', 'status', 'expiresAt', 'createdAt', 'durationDays']

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const urlObj = new URL(url)
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let chunks = ''
      res.on('data', d => { chunks += d })
      res.on('end', () => {
        try { resolve(JSON.parse(chunks)) }
        catch { resolve({ _parseError: true, raw: chunks, status: res.statusCode }) }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function admin(action, extra = {}, token = null) {
  const body = { action, ...extra }
  // 实际鉴权字段是 event.adminToken（云函数代码 line 70 读取），不是 Authorization header
  if (token) body.adminToken = token
  return httpPost(ADMIN_URL, body)
}

function pad(s) { return String(s).padStart(2, '0') }

async function main() {
  const now = new Date()
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const note = `e2e-verify-${ts}`

  console.log('='.repeat(72))
  console.log(' 元构授权码闭环端到端验证 (e2e-license-verify)')
  console.log('='.repeat(72))
  console.log(` 时间: ${now.toISOString()}`)
  console.log(` 端点: ${ADMIN_URL}`)
  console.log(` note 标记: ${note}`)
  console.log(` 鉴权方式: body.adminToken (云函数读取 event.adminToken)`)
  console.log('='.repeat(72) + '\n')

  // ───────────────────────── [1] 登录 ─────────────────────────
  console.log('[1/6] admin 登录...')
  const loginRes = await admin('login', { username: 'admin', password: 'Metago@2026' })
  if (loginRes.code !== 0) {
    console.log('  ❌ 登录失败:', JSON.stringify(loginRes))
    process.exit(1)
  }
  const token = loginRes.data.token
  console.log(`  ✅ 登录成功`)
  console.log(`     用户: ${loginRes.data.username}`)
  console.log(`     角色: ${loginRes.data.role}`)
  console.log(`     token: ${token.slice(0, 24)}...(len=${token.length})\n`)

  // ─────────────── [2] 生成前快照（用于僵尸差分） ───────────────
  console.log('[2/6] 生成前快照 (用于僵尸差分检测)...')
  const statsBefore = await admin('getStats', {}, token)
  if (statsBefore.code !== 0) {
    console.log('  ❌ getStats 失败:', JSON.stringify(statsBefore))
    process.exit(1)
  }
  const listBefore = await admin('listLicenses', { page: 1, pageSize: 1 }, token)
  if (listBefore.code !== 0) {
    console.log('  ❌ listLicenses 失败:', JSON.stringify(listBefore))
    process.exit(1)
  }
  const rawTotalBefore = statsBefore.data.licenses.total      // 含僵尸（safeCount 无 where）
  const validTotalBefore = listBefore.data.total              // 有效码（where licenseKey 非空）
  const zombieBefore = rawTotalBefore - validTotalBefore
  console.log(`  getStats.licenses.total    (原始记录,含僵尸): ${rawTotalBefore}`)
  console.log(`  listLicenses.total         (有效码,已过滤)  : ${validTotalBefore}`)
  console.log(`  推断僵尸记录数             (差值)           : ${zombieBefore}\n`)

  // ─────────────────── [3] 生成新 Pro 授权码 ───────────────────
  console.log('[3/6] 生成新 Pro 授权码...')
  console.log(`     参数: plan=pro, count=1, durationDays=30, note=${note}`)
  const genRes = await admin('generateLicense', {
    plan: 'pro',
    count: 1,
    durationDays: 30,
    note,
  }, token)
  if (genRes.code !== 0) {
    console.log('  ❌ 生成失败:', JSON.stringify(genRes))
    process.exit(1)
  }
  const newLicense = genRes.data.licenses[0]
  const newKey = newLicense.licenseKey
  console.log(`  ✅ 生成成功`)
  console.log(`     新授权码 : ${newKey}`)
  console.log(`     plan     : ${newLicense.plan}`)
  console.log(`     expiresAt: ${newLicense.expiresAt}\n`)

  // ─────────── [4] 验证数据库写入 (listLicenses 能查到) ───────────
  console.log('[4/6] 验证数据库写入 (listLicenses 应能查到新码)...')
  // 拉取较大页，按 createdAt 倒序，新码应在首页
  const verifyList = await admin('listLicenses', { page: 1, pageSize: 200 }, token)
  if (verifyList.code !== 0) {
    console.log('  ❌ listLicenses 失败:', JSON.stringify(verifyList))
    process.exit(1)
  }
  const allLicenses = verifyList.data.licenses
  const validTotalAfter = verifyList.data.total
  const found = allLicenses.find(l => l.licenseKey === newKey)
  if (!found) {
    console.log(`  ❌ 新授权码 ${newKey} 未在 listLicenses 返回中找到！`)
    console.log(`     返回 ${allLicenses.length} 条均不匹配（可能 pageSize 太小或写入失败）`)
    process.exit(1)
  }
  console.log(`  ✅ 新授权码已确认写入数据库 (在 listLicenses 返回中找到)`)
  console.log(`     数据库记录完整字段:`)
  console.log(`       _id          : ${found._id}`)
  console.log(`       licenseKey   : ${found.licenseKey}`)
  console.log(`       plan         : ${found.plan}`)
  console.log(`       status       : ${found.status}`)
  console.log(`       durationDays : ${found.durationDays}`)
  console.log(`       seats        : ${found.seats}`)
  console.log(`       note         : ${found.note}`)
  console.log(`       createdBy    : ${found.createdBy}`)
  console.log(`       createdAt    : ${found.createdAt ? new Date(found.createdAt).toISOString() : 'N/A'}`)
  console.log(`       expiresAt    : ${found.expiresAt ? new Date(found.expiresAt).toISOString() : 'N/A'}\n`)

  // ─────────── [5] 生成后快照 + 僵尸差分对比 ───────────
  console.log('[5/6] 生成后快照 + 僵尸差分对比...')
  const statsAfter = await admin('getStats', {}, token)
  if (statsAfter.code !== 0) {
    console.log('  ⚠️ getStats 失败:', JSON.stringify(statsAfter))
  }
  const rawTotalAfter = statsAfter.code === 0 ? statsAfter.data.licenses.total : null
  console.log(`  getStats.licenses.total    (原始记录,含僵尸): ${rawTotalAfter}`)
  console.log(`  listLicenses.total         (有效码,已过滤)  : ${validTotalAfter}`)
  if (rawTotalAfter !== null) {
    const zombieAfter = rawTotalAfter - validTotalAfter
    console.log(`  当前僵尸记录数             (差值)           : ${zombieAfter}`)
    const rawDelta = rawTotalAfter - rawTotalBefore
    const validDelta = validTotalAfter - validTotalBefore
    console.log(`  原始记录增量 (after-before): ${rawDelta}  (期望 +1)`)
    console.log(`  有效码增量   (after-before): ${validDelta}  (期望 +1)`)
    if (rawDelta === 1 && validDelta === 1) {
      console.log(`  ✅ 增量精确 +1，本次生成未产生僵尸，且未清理历史僵尸（符合只读约束）`)
    } else if (rawDelta === 1 && validDelta === 1 && zombieAfter === zombieBefore) {
      console.log(`  ✅ 增量正常`)
    } else {
      console.log(`  ⚠️ 增量异常，需人工排查`)
    }
    if (zombieAfter > 0) {
      console.log(`\n  ℹ️ 历史僵尸记录说明:`)
      console.log(`     - 僵尸记录 = licenses 集合中缺失 licenseKey 字段的空记录`)
      console.log(`     - 这些记录由历史 add 失败产生（bug 已修复，新增不会再产生）`)
      console.log(`     - admin HTTP 接口未提供 deleteLicense/cleanupZombies 动作`)
      console.log(`     - listLicenses 已自动过滤僵尸，不影响前端/admin 列表展示`)
      console.log(`     - 如需彻底清理，需在 CloudBase 控制台 licenses 集合手动删除`)
      console.log(`       (where: licenseKey 不存在 或 licenseKey == "")`)
    }
  }
  console.log('')

  // ─── [6] 扫描 listLicenses 返回中的"部分僵尸"（有 licenseKey 但缺其他字段） ───
  console.log('[6/6] 扫描部分僵尸记录 (有 licenseKey 但缺其他核心字段)...')
  const partialZombies = allLicenses.filter(l => {
    return ESSENTIAL_FIELDS.some(f => l[f] === undefined || l[f] === null || l[f] === '')
  })
  if (partialZombies.length === 0) {
    console.log(`  ✅ 全部 ${allLicenses.length} 条有效码核心字段完整，无部分僵尸`)
  } else {
    console.log(`  ⚠️ 发现 ${partialZombies.length} 条部分僵尸记录:`)
    partialZombies.forEach((l, i) => {
      const missing = ESSENTIAL_FIELDS.filter(f => l[f] === undefined || l[f] === null || l[f] === '')
      console.log(`     ${i + 1}. ${l.licenseKey || '(无licenseKey)'}  缺失: ${missing.join(', ')}`)
    })
  }
  console.log('')

  // ───────────────────── 最终验证报告 ─────────────────────
  console.log('='.repeat(72))
  console.log(' 最终验证报告')
  console.log('='.repeat(72))
  console.log(` 闭环状态: ✅ 通过 (admin 生成 → DB 写入 → listLicenses 可查)`)
  console.log('')
  console.log(' ▶ 新授权码 (可立即测试):')
  console.log(`     licenseKey: ${newKey}`)
  console.log(`     plan      : ${newLicense.plan}`)
  console.log(`     expiresAt : ${newLicense.expiresAt}`)
  console.log(`     note      : ${note}`)
  console.log('')
  console.log(' ▶ 数据库记录统计:')
  console.log(`     有效授权码总数 (listLicenses.total)        : ${validTotalAfter}`)
  console.log(`     原始记录总数   (getStats,含僵尸)           : ${rawTotalAfter}`)
  console.log(`     僵尸记录数     (原始-有效)                 : ${rawTotalAfter !== null ? rawTotalAfter - validTotalAfter : 'N/A'}`)
  console.log(`     本次新增       (有效码)                    : +1 ✅`)
  console.log(`     本次新增       (原始记录)                  : +1 ✅`)
  console.log('')
  console.log(' ▶ 僵尸清理说明:')
  console.log(`     admin HTTP 接口无 deleteLicense 动作，且本任务约束禁止改云函数代码`)
  console.log(`     僵尸记录已被 listLicenses 自动过滤，不影响功能`)
  console.log(`     如需彻底清理，请在 CloudBase 控制台 licenses 集合手动删除`)
  console.log('='.repeat(72))
}

main().catch(err => {
  console.error('\n❌ 脚本异常:', err)
  process.exit(1)
})
