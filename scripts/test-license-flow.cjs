/**
 * 端到端测试：admin 生成授权码 → 查询确认 → subscription 激活
 */
const https = require('https')

const ADMIN_URL = 'https://metago.life/api/admin'

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
  const loginRes = await httpPost(ADMIN_URL, { action: 'login', username: 'admin', password: 'Metago@2026' })
  const token = loginRes.data.token
  console.log(`  登录成功`)

  console.log(`\n[2] 生成新授权码...`)
  const genRes = await httpPost(ADMIN_URL, {
    action: 'generateLicense',
    plan: 'pro',
    count: 1,
    durationDays: 30,
    note: '闭环测试',
    adminToken: token,
  })
  console.log(`  生成结果: code=${genRes.code}`, JSON.stringify(genRes.data || genRes.message))
  if (genRes.code !== 0 || !genRes.data?.licenses?.length) {
    console.log('  生成失败，终止')
    return
  }
  const newKey = genRes.data.licenses[0].licenseKey
  console.log(`  新授权码: ${newKey}`)

  console.log(`\n[3] 查询 licenses 集合，确认新码已写入...`)
  const listRes = await httpPost(ADMIN_URL, {
    action: 'listLicenses',
    page: 1,
    pageSize: 100,
    adminToken: token,
  })
  console.log(`  查询结果: 共 ${listRes.data?.total || 0} 条`)
  if (listRes.data?.licenses) {
    listRes.data.licenses.forEach((l, i) => {
      const match = l.licenseKey === newKey ? ' ◀◀◀ 新生成' : ''
      console.log(`  ${i + 1}. ${l.licenseKey} | status=${l.status} | note=${l.note || ''}${match}`)
    })
  }

  const found = listRes.data?.licenses?.find(l => l.licenseKey === newKey)
  if (found) {
    console.log(`\n[4] ✅ 新授权码 ${newKey} 已成功写入 licenses 集合`)
    console.log(`  详情: plan=${found.plan}, status=${found.status}, expiresAt=${found.expiresAt}`)
    console.log(`\n[5] 结论：admin generateLicense 闭环已修复`)
    console.log(`  请用普通账号在 Studio 输入 ${newKey} 激活，验证 subscription activatePro 闭环`)
  } else {
    console.log(`\n[4] ❌ 新授权码 ${newKey} 未出现在查询结果中！`)
    console.log(`  说明 add 仍写入失败，需进一步排查`)
  }
}

main().catch(console.error)
