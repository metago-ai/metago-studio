/**
 * 业务层验证脚本：验证用户反馈的 4 个核心问题是否修复
 * 1. 用户管理：封禁按钮是否可点击 + 是否有操作反馈
 * 2. 订单管理：是否有操作列（标记已付/取消）
 * 3. 授权码：生成后是否显示码
 * 4. 智能体配置：是否改为说明性看板
 */
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ bypassCSP: true, ignoreHTTPSErrors: true })
  const page = await context.newPage()

  const errors = []
  page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`))
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`)
  })

  console.log('[1] 打开 Admin 页面...')
  await page.goto('https://metago.life/studio/#/admin', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)

  console.log('[2] 登录 admin...')
  await page.fill('input[autocomplete="username"]', 'admin')
  await page.fill('input[autocomplete="current-password"]', 'Metago@2026')
  await page.click('button:has-text("登录管理后台")')
  await page.waitForTimeout(4000)

  const results = {}

  // ========== 验证 1: 用户管理 - 封禁按钮 ==========
  console.log('\n[3] 验证用户管理 Tab...')
  await page.click('button:has-text("用户管理")')
  await page.waitForTimeout(3000)
  const usersInfo = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t)
    const hasBanBtn = buttons.some(b => b === '封禁' || b === '解封')
    const hasResetBtn = buttons.some(b => b === '重置配额')
    const hasTierBtn = buttons.some(b => b === '改套餐')
    const rows = document.querySelectorAll('table tbody tr')
    const unknownCount = Array.from(document.querySelectorAll('td')).filter(td => td.textContent.trim() === '未知用户').length
    return { hasBanBtn, hasResetBtn, hasTierBtn, rowCount: rows.length, unknownCount, buttonCount: buttons.length }
  })
  console.log(`  用户管理: 行数=${usersInfo.rowCount}, 未知用户=${usersInfo.unknownCount}, 封禁按钮=${usersInfo.hasBanBtn}, 重置配额=${usersInfo.hasResetBtn}, 改套餐=${usersInfo.hasTierBtn}`)
  results.users = usersInfo

  // ========== 验证 2: 订单管理 - 操作列 ==========
  console.log('\n[4] 验证订单管理 Tab...')
  await page.click('button:has-text("订单管理")')
  await page.waitForTimeout(3000)
  const ordersInfo = await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll('table thead th')).map(th => th.textContent.trim())
    const hasActionCol = headers.includes('操作')
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t)
    const hasMarkPaid = buttons.some(b => b === '标记已付')
    const hasCancel = buttons.some(b => b === '取消')
    return { hasActionCol, headers, hasMarkPaid, hasCancel, buttonCount: buttons.length }
  })
  console.log(`  订单管理: 操作列=${ordersInfo.hasActionCol}, 标记已付=${ordersInfo.hasMarkPaid}, 取消=${ordersInfo.hasCancel}`)
  console.log(`  表头: ${ordersInfo.headers.join(', ')}`)
  results.orders = ordersInfo

  // ========== 验证 3: 授权码 - 生成后显示码 ==========
  console.log('\n[5] 验证授权码 Tab（生成授权码）...')
  await page.click('button:has-text("授权码")')
  await page.waitForTimeout(3000)
  // 点击生成按钮
  try {
    await page.click('button:has-text("生成")', { timeout: 5000 })
    await page.waitForTimeout(3000)
    const licenseInfo = await page.evaluate(() => {
      const text = document.body.innerText
      const hasLicenseKey = /METAGO-[A-Z]+-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/.test(text)
      const codes = Array.from(document.querySelectorAll('code')).map(c => c.textContent.trim()).filter(t => t.startsWith('METAGO-'))
      return { hasLicenseKey, codes, textPreview: text.slice(0, 500) }
    })
    console.log(`  授权码生成: 检测到码=${licenseInfo.hasLicenseKey}, 码数量=${licenseInfo.codes.length}`)
    if (licenseInfo.codes.length > 0) {
      console.log(`  示例码: ${licenseInfo.codes[0]}`)
    }
    results.licenses = licenseInfo
  } catch (e) {
    console.log(`  生成按钮点击失败: ${e.message.split('\n')[0]}`)
    results.licenses = { error: e.message.split('\n')[0] }
  }

  // ========== 验证 4: 智能体配置 - 说明性看板 ==========
  console.log('\n[6] 验证智能体配置 Tab...')
  await page.click('button:has-text("智能体配置")')
  await page.waitForTimeout(3000)
  const agentConfigInfo = await page.evaluate(() => {
    const text = document.body.innerText
    const hasManagementLabel = text.includes('用户本地管理') || text.includes('云端同步') || text.includes('管理方式')
    const hasByokLink = text.includes('BYOK') && (text.includes('前往') || text.includes('跳转'))
    const textLength = text.length
    return { hasManagementLabel, hasByokLink, textLength, textPreview: text.slice(0, 300) }
  })
  console.log(`  智能体配置: 文本长度=${agentConfigInfo.textLength}, 有管理方式标注=${agentConfigInfo.hasManagementLabel}, 有BYOK跳转=${agentConfigInfo.hasByokLink}`)
  results.agentConfig = agentConfigInfo

  // ========== 验证 5: Toast 反馈系统 ==========
  console.log('\n[7] 验证 Toast 反馈（通过封禁/解封操作触发）...')
  await page.click('button:has-text("用户管理")')
  await page.waitForTimeout(3000)
  // 取消所有 dialog（confirm）- 自动点击 OK
  page.on('dialog', async dialog => { await dialog.accept() })
  try {
    const banBtn = await page.$('button:has-text("解封")')
    if (banBtn) {
      await banBtn.click()
      await page.waitForTimeout(2000)
      const toastInfo = await page.evaluate(() => {
        const toast = document.querySelector('.fixed.bottom-6.right-6')
        return toast ? { found: true, text: toast.textContent.trim() } : { found: false }
      })
      console.log(`  Toast 反馈: 找到=${toastInfo.found}, 内容="${toastInfo.text || ''}"`)
      results.toast = toastInfo
    } else {
      const banBtn2 = await page.$('button:has-text("封禁")')
      if (banBtn2) {
        await banBtn2.click()
        await page.waitForTimeout(2000)
        const toastInfo = await page.evaluate(() => {
          const toast = document.querySelector('.fixed.bottom-6.right-6')
          return toast ? { found: true, text: toast.textContent.trim() } : { found: false }
        })
        console.log(`  Toast 反馈: 找到=${toastInfo.found}, 内容="${toastInfo.text || ''}"`)
        results.toast = toastInfo
      } else {
        console.log('  无封禁/解封按钮可测')
        results.toast = { found: false, reason: 'no_button' }
      }
    }
  } catch (e) {
    console.log(`  Toast 验证失败: ${e.message.split('\n')[0]}`)
    results.toast = { error: e.message.split('\n')[0] }
  }

  // ========== 汇总 ==========
  console.log('\n========== 验证汇总 ==========')
  console.log('页面错误数:', errors.length)
  if (errors.length > 0) {
    console.log('前5个错误:')
    errors.slice(0, 5).forEach(e => console.log('  ', e))
  }

  const pass = []
  const fail = []
  if (results.users.hasBanBtn && results.users.unknownCount === 0) { pass.push('用户管理(封禁按钮+无未知用户)') } else { fail.push('用户管理') }
  if (results.orders.hasActionCol) { pass.push('订单管理(操作列)') } else { fail.push('订单管理') }
  if (results.licenses.hasLicenseKey || (results.licenses.codes && results.licenses.codes.length > 0)) { pass.push('授权码(生成显示)') } else { fail.push('授权码') }
  if (results.agentConfig.hasManagementLabel) { pass.push('智能体配置(说明性看板)') } else { fail.push('智能体配置') }
  if (results.toast && results.toast.found) { pass.push('Toast反馈') } else { fail.push('Toast反馈') }

  console.log(`\n✅ 通过: ${pass.join(', ') || '无'}`)
  console.log(`❌ 失败: ${fail.join(', ') || '无'}`)

  await browser.close()
  process.exit(fail.length > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
