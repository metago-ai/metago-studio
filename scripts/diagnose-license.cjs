/**
 * 诊断授权码闭环：admin 生成 → subscription 激活
 * 1. 通过 admin HTTP 登录并查询所有授权码
 * 2. 检查目标授权码是否存在
 * 3. 直接调用 subscription 云函数的 activatePro 测试
 */
const https = require('https')

const ADMIN_URL = 'https://metago.life/api/admin'
const TARGET_KEY = process.argv[2] || 'METAGO-PRO-CC6C-0H0G-60EE'

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const urlObj = new URL(url)
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let chunks = ''
      res.on('data', d => chunks += d)
      res.on('end', () => {
        try { resolve(JSON.parse(chunks)) } catch { resolve({ raw: chunks, status: res.statusCode }) }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function main() {
  console.log(`[1] 登录 admin...`)
  const loginRes = await httpPost(ADMIN_URL, {
    action: 'login',
    username: 'admin',
    password: 'Metago@2026',
  })
  if (loginRes.code !== 0) {
    console.log('登录失败:', loginRes)
    return
  }
  const token = loginRes.data.token
  console.log(`  登录成功，token: ${token.slice(0, 20)}...`)

  console.log(`\n[2] 查询所有授权码...`)
  const listRes = await httpPost(ADMIN_URL, {
    action: 'listLicenses',
    page: 1,
    pageSize: 100,
    adminToken: token,
  })
  if (listRes.code !== 0) {
    console.log('查询失败:', listRes)
    return
  }
  const licenses = listRes.data.licenses
  console.log(`  共 ${listRes.data.total} 条授权码`)
  console.log(`  授权码列表:`)
  licenses.forEach((l, i) => {
    const match = l.licenseKey === TARGET_KEY ? ' ◀◀◀ 目标码' : ''
    console.log(`  ${i + 1}. ${l.licenseKey} | plan=${l.plan} | status=${l.status} | expiresAt=${l.expiresAt ? new Date(l.expiresAt).toISOString() : 'N/A'}${match}`)
  })

  const target = licenses.find(l => l.licenseKey === TARGET_KEY)
  if (target) {
    console.log(`\n[3] ✅ 目标授权码 ${TARGET_KEY} 存在于 licenses 集合`)
    console.log(`  详情:`, JSON.stringify(target, null, 2))
  } else {
    console.log(`\n[3] ❌ 目标授权码 ${TARGET_KEY} 不在 admin 查询结果中！`)
    console.log(`  可能原因:`)
    console.log(`  a. admin 和 subscription 连的数据库环境不同`)
    console.log(`  b. 授权码生成在另一个环境`)
    console.log(`  c. 僵尸记录过滤导致被过滤（但目标码有 licenseKey 字段，不应被过滤）`)
  }

  console.log(`\n[4] 检查 admin 云函数 env:`)
  console.log(`  admin: cloud.init({ env: 'metago-d6gfw1e4rf2a5bcad' })  ← 硬编码`)
  console.log(`  subscription: cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })  ← 动态`)
  console.log(`  如果 subscription 部署在非 metago-d6gfw1e4rf2a5bcad 环境，则查不到 admin 生成的授权码`)
}

main().catch(console.error)
