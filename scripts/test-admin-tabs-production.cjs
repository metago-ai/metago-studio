/**
 * Admin Tabs 线上验证脚本（V3 · 真实 CDN · 无 route 拦截）
 *
 * 策略：直接访问 https://metago.life/studio/#/admin
 * 不做任何 route 拦截，验证真实用户访问场景。
 * 强制刷新浏览器缓存（context 的 bypassCSP + 每次新 context）。
 */

const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    bypassCSP: true,
    ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()

  const errors = []
  const consoleErrors = []

  page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`))
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(`[console.error] ${msg.text()}`)
  })

  console.log('[1] 打开线上 Admin 页面（真实 CDN）...')
  await page.goto('https://metago.life/studio/#/admin', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)

  console.log('[2] 检查当前引用的 chunk...')
  const chunkInfo = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script[src]'))
    return scripts.map(s => s.getAttribute('src'))
  })
  console.log('  加载的脚本:', chunkInfo)

  console.log('[3] 登录 admin...')
  await page.fill('input[autocomplete="username"]', 'admin')
  await page.fill('input[autocomplete="current-password"]', 'Metago@2026')
  await page.click('button:has-text("登录管理后台")')
  await page.waitForTimeout(4000)

  const tabs = [
    '总览', '用户管理', '订单管理', '授权码', '订阅记录', '认证订单', '用户反馈',
    'Agent 管理', 'Token 日志', '智能体配置',
    '决策锁审计', '进化记录', '行为银行', '私有技能审核', 'BYOK 绑定',
    '平台配置', '错误监控', '同步日志',
  ]

  let blackCount = 0
  const results = []
  for (const tabName of tabs) {
    console.log(`\n[5] 点击 Tab: ${tabName}`)
    try {
      await page.click(`button:has-text("${tabName}")`, { timeout: 5000 })
    } catch (e) {
      console.log(`  ❌ 点击失败: ${e.message.split('\n')[0]}`)
      blackCount++
      results.push({ tab: tabName, status: 'click_fail', detail: e.message.split('\n')[0] })
      continue
    }
    await page.waitForTimeout(2500)

    const result = await page.evaluate(() => {
      const main = document.querySelector('.min-h-screen')
      const bodyText = document.body.innerText
      return {
        bodyLength: bodyText.length,
        bodyPreview: bodyText.slice(0, 200),
        mainExists: !!main,
        mainRect: main ? `${main.getBoundingClientRect().width}x${main.getBoundingClientRect().height}` : 'N/A',
      }
    })
    console.log(`  body 长度: ${result.bodyLength}, 容器: ${result.mainExists ? result.mainRect : 'NO_MAIN_CONTAINER'}`)
    if (result.bodyLength < 50) {
      console.log(`  ❌❌ 黑屏！body 内容: "${result.bodyPreview}"`)
      blackCount++
      results.push({ tab: tabName, status: 'black', detail: result.bodyPreview })
    } else {
      console.log(`  ✅ 正常（${result.bodyLength} 字符）`)
      results.push({ tab: tabName, status: 'ok', detail: `${result.bodyLength} 字符` })
    }
  }

  console.log('\n========== 错误汇总 ==========')
  if (errors.length > 0) {
    console.log('页面错误:')
    errors.forEach(e => console.log('  ' + e))
  }
  if (consoleErrors.length > 0) {
    console.log('控制台错误（前10条）:')
    consoleErrors.slice(0, 10).forEach(e => console.log('  ' + e))
    if (consoleErrors.length > 10) console.log(`  ...共 ${consoleErrors.length} 条`)
  }
  if (errors.length === 0 && consoleErrors.length === 0) {
    console.log('无错误')
  }

  console.log(`\n========== 结果 ==========`)
  console.log(`总 Tab 数: ${tabs.length}, 黑屏数: ${blackCount}`)
  if (blackCount === 0) {
    console.log('✅ 全部 Tab 正常，无黑屏')
  } else {
    console.log(`❌ ${blackCount} 个 Tab 黑屏`)
    console.log('黑屏 Tab:', results.filter(r => r.status !== 'ok').map(r => r.tab).join(', '))
  }

  await browser.close()
  process.exit(blackCount === 0 ? 0 : 1)
}

main().catch(e => { console.error(e); process.exit(1) })
