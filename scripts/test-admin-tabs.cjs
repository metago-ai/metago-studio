/**
 * Admin Tabs 黑屏验证脚本（V2 · 本地 dist 拦截）
 *
 * 策略：用 metago.life 域名加载页面（避免 API 跨域），
 * 但用 page.route 拦截 metago.life/studio/ 下的静态资源，
 * 从本地 dist 目录提供最新构建版本，绕过 CDN 缓存的旧 index.html。
 * API 调用 metago.life/api/admin 正常通过到线上。
 */

const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const distDir = path.join(__dirname, '..', 'dist')

const MIME = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  const errors = []
  const consoleErrors = []

  page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`))
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(`[console.error] ${msg.text()}`)
  })

  // 拦截 metago.life/studio/ 下的静态资源，从本地 dist 提供
  await page.route('https://metago.life/studio/**', async (route) => {
    const url = route.request().url()
    const pathPart = url.replace('https://metago.life/studio/', '').split('?')[0].split('#')[0]
    // 根路径返回 index.html
    const filePath = pathPart === '' ? path.join(distDir, 'index.html') : path.join(distDir, pathPart)
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const body = fs.readFileSync(filePath)
        const ext = path.extname(filePath).toLowerCase()
        const contentType = MIME[ext] || 'application/octet-stream'
        await route.fulfill({ contentType, body })
        return
      }
    } catch (e) {
      // 文件读取失败，继续正常请求
    }
    await route.continue()
  })

  console.log('[1] 打开 Admin 页面（本地 dist + 线上 API）...')
  await page.goto('https://metago.life/studio/#/admin', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)

  console.log('[2] 登录 admin...')
  await page.fill('input[autocomplete="username"]', 'admin')
  await page.fill('input[autocomplete="current-password"]', 'Metago@2026')
  await page.click('button:has-text("登录管理后台")')
  await page.waitForTimeout(3000)

  const tabs = [
    '总览', '用户管理', '订单管理', '授权码', '订阅记录', '认证订单', '用户反馈',
    'Agent 管理', 'Token 日志', '智能体配置',
    '决策锁审计', '进化记录', '行为银行', '私有技能审核', 'BYOK 绑定',
    '平台配置', '错误监控', '同步日志',
  ]

  let blackCount = 0
  for (const tabName of tabs) {
    console.log(`\n[5] 点击 Tab: ${tabName}`)
    try {
      await page.click(`button:has-text("${tabName}")`, { timeout: 5000 })
    } catch (e) {
      console.log(`  ❌ 点击失败: ${e.message.split('\n')[0]}`)
      blackCount++
      continue
    }
    await page.waitForTimeout(2500)

    const result = await page.evaluate(() => {
      const main = document.querySelector('.min-h-screen')
      const bodyText = document.body.innerText
      return {
        bodyLength: bodyText.length,
        bodyPreview: bodyText.slice(0, 100),
        mainExists: !!main,
        mainRect: main ? `${main.getBoundingClientRect().width}x${main.getBoundingClientRect().height}` : 'N/A',
      }
    })
    console.log(`  body 长度: ${result.bodyLength}, 容器: ${result.mainExists ? result.mainRect : 'NO_MAIN_CONTAINER'}`)
    if (result.bodyLength < 50) {
      console.log(`  ❌❌ 黑屏！body 内容: "${result.bodyPreview}"`)
      blackCount++
    } else {
      console.log(`  ✅ 正常（${result.bodyLength} 字符）`)
    }
  }

  console.log('\n========== 错误汇总 ==========')
  if (errors.length > 0) {
    console.log('页面错误:')
    errors.forEach(e => console.log('  ' + e))
  }
  if (consoleErrors.length > 0) {
    console.log('控制台错误:')
    consoleErrors.forEach(e => console.log('  ' + e))
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
  }

  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
