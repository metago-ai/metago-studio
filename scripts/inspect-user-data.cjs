const https = require('https')

const token = Buffer.from('admin:0:metago-admin-2026-secret-key').toString('base64')

function callAdmin(action, params = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ action, adminToken: token, ...params })
    const req = https.request('https://metago.life/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch { resolve(data) } })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function main() {
  console.log('=== 查看前5个用户的数据结构 ===')
  const users = await callAdmin('listUsers', { page: 1, pageSize: 5 })
  if (users.code === 0 && users.data?.users) {
    console.log('总用户数:', users.data.total)
    console.log('前5个用户:')
    users.data.users.forEach((u, i) => {
      console.log(`\n--- 用户 ${i + 1} ---`)
      console.log('  _id:', u._id)
      console.log('  openid:', u.openid)
      console.log('  uid:', u.uid)
      console.log('  email:', u.email)
      console.log('  phone:', u.phone)
      console.log('  displayName:', u.displayName)
      console.log('  tier:', u.tier)
      console.log('  createdAt:', u.createdAt)
      console.log('  所有字段:', Object.keys(u).join(', '))
    })
  } else {
    console.log('查询失败:', JSON.stringify(users))
  }

  console.log('\n=== 查看前3个订单 ===')
  const orders = await callAdmin('listOrders', { page: 1, pageSize: 3 })
  if (orders.code === 0 && orders.data?.orders) {
    console.log('总订单数:', orders.data.total)
    orders.data.orders.forEach((o, i) => {
      console.log(`\n--- 订单 ${i + 1} ---`)
      console.log('  所有字段:', Object.keys(o).join(', '))
      console.log('  数据:', JSON.stringify(o, null, 2).slice(0, 500))
    })
  }

  console.log('\n=== 查看前3个授权码 ===')
  const licenses = await callAdmin('listLicenses', { page: 1, pageSize: 3 })
  if (licenses.code === 0 && licenses.data?.licenses) {
    console.log('总授权码数:', licenses.data.total)
    licenses.data.licenses.forEach((l, i) => {
      console.log(`\n--- 授权码 ${i + 1} ---`)
      console.log('  所有字段:', Object.keys(l).join(', '))
      console.log('  licenseKey:', l.licenseKey)
    })
  }

  console.log('\n=== 测试生成授权码 ===')
  const gen = await callAdmin('generateLicense', { plan: 'pro', count: 1, durationDays: 30, note: '测试' })
  console.log('返回数据结构:', JSON.stringify(gen, null, 2))
  if (gen.code === 0 && gen.data?.licenses) {
    console.log('licenses[0] 字段:', Object.keys(gen.data.licenses[0]).join(', '))
    console.log('licenseKey:', gen.data.licenses[0].licenseKey)
    console.log('key:', gen.data.licenses[0].key)
  }
}

main().catch(console.error)
