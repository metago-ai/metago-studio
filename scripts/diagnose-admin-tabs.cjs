/**
 * Admin 后台 18 Tab 全面诊断脚本
 *
 * 对每个 Tab：
 * 1. 截图保存
 * 2. 记录页面主要文本内容
 * 3. 列出所有按钮和可交互元素
 * 4. 对关键按钮尝试点击，记录反应
 * 5. 捕获 console.error 和 pageerror
 *
 * 输出：screenshots/admin-diagnosis/ 目录下的截图 + 控制台诊断报告
 */

const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const SCREENSHOT_DIR = path.join(__dirname, '..', 'screenshots', 'admin-diagnosis')
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

const tabs = [
  { id: 'overview', name: '总览' },
  { id: 'users', name: '用户管理' },
  { id: 'orders', name: '订单管理' },
  { id: 'licenses', name: '授权码' },
  { id: 'subscriptions', name: '订阅记录' },
  { id: 'certify_orders', name: '认证订单' },
  { id: 'feedback', name: '用户反馈' },
  { id: 'agent', name: 'Agent 管理' },
  { id: 'token_logs', name: 'Token 日志' },
  { id: 'agent_config', name: '智能体配置' },
  { id: 'decision_locks', name: '决策锁审计' },
  { id: 'evolution', name: '进化记录' },
  { id: 'behavior_bank', name: '行为银行' },
  { id: 'private_skills', name: '私有技能审核' },
  { id: 'byok', name: 'BYOK 绑定' },
  { id: 'platform_config', name: '平台配置' },
  { id: 'error_monitor', name: '错误监控' },
  { id: 'sync_logs', name: '同步日志' },
]

async function diagnose() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  const allErrors = []
  page.on('pageerror', err => allErrors.push(`[pageerror] ${err.message}`))
  page.on('console', msg => {
    if (msg.type() === 'error') allErrors.push(`[console.error] ${msg.text()}`)
  })

  console.log('[1] 打开 Admin 页面...')
  await page.goto('https://metago.life/studio/#/admin', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)

  console.log('[2] 登录 admin...')
  await page.fill('input[autocomplete="username"]', 'admin')
  await page.fill('input[autocomplete="current-password"]', 'Metago@2026')
  await page.click('button:has-text("登录管理后台")')
  await page.waitForTimeout(3000)

  const diagnosis = []

  for (const tab of tabs) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`诊断 Tab: ${tab.name} (${tab.id})`)
    console.log('='.repeat(60))

    try {
      await page.click(`button:has-text("${tab.name}")`, { timeout: 5000 })
    } catch (e) {
      console.log(`  ❌ 点击失败: ${e.message.split('\n')[0]}`)
      diagnosis.push({ ...tab, status: 'click_fail', error: e.message })
      continue
    }
    await page.waitForTimeout(2500)

    // 截图
    const screenshotPath = path.join(SCREENSHOT_DIR, `${tab.id}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: true })
    console.log(`  截图: ${screenshotPath}`)

    // 记录页面内容
    const pageInfo = await page.evaluate(() => {
      const body = document.body.innerText
      const mainContent = document.querySelector('.flex-1, .min-h-screen, main, [class*="content"]')
      const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.innerText.trim(),
        disabled: b.disabled,
        visible: b.offsetParent !== null,
      })).filter(b => b.visible && b.text)

      const inputs = Array.from(document.querySelectorAll('input, select, textarea')).map(i => ({
        type: i.type,
        placeholder: i.placeholder,
        value: i.value,
        visible: i.offsetParent !== null,
      })).filter(i => i.visible)

      const tables = Array.from(document.querySelectorAll('table')).map(t => ({
        rows: t.querySelectorAll('tbody tr').length,
        headers: Array.from(t.querySelectorAll('th')).map(th => th.innerText.trim()),
      }))

      // 统计"未知用户"出现次数
      const unknownUserCount = (body.match(/未知用户/g) || []).length

      return {
        bodyLength: body.length,
        bodyPreview: body.slice(0, 500),
        buttons,
        inputs,
        tables,
        unknownUserCount,
      }
    })

    console.log(`  body 长度: ${pageInfo.bodyLength}`)
    console.log(`  按钮 (${pageInfo.buttons.length}):`)
    pageInfo.buttons.forEach(b => console.log(`    - "${b.text}"${b.disabled ? ' [禁用]' : ''}`))
    console.log(`  输入框 (${pageInfo.inputs.length}):`)
    pageInfo.inputs.forEach(i => console.log(`    - [${i.type}] ${i.placeholder || '(无placeholder)'}`))
    console.log(`  表格 (${pageInfo.tables.length}):`)
    pageInfo.tables.forEach(t => console.log(`    - ${t.rows} 行, 列: ${t.headers.join(', ')}`))
    if (pageInfo.unknownUserCount > 0) {
      console.log(`  ⚠️ "未知用户"出现 ${pageInfo.unknownUserCount} 次`)
    }

    // 对关键按钮做点击测试
    const clickTestResults = []
    const testButtons = pageInfo.buttons.filter(b =>
      !b.disabled && (
        b.text.includes('封禁') || b.text.includes('解封') ||
        b.text.includes('生成') || b.text.includes('复制') ||
        b.text.includes('刷新') || b.text.includes('回复') ||
        b.text.includes('导出') || b.text.includes('审核') ||
        b.text.includes('删除') || b.text.includes('保存')
      )
    )

    for (const btn of testButtons.slice(0, 3)) {
      console.log(`  点击测试: "${btn.text}"`)
      const beforeState = pageInfo.bodyLength
      try {
        // 对于需要确认的操作，先注入 confirm 覆盖
        await page.evaluate(() => { window.confirm = () => true })
        await page.click(`button:has-text("${btn.text}")`, { timeout: 3000 })
        await page.waitForTimeout(1500)

        const afterState = await page.evaluate(() => document.body.innerText.length)
        const afterPreview = await page.evaluate(() => document.body.innerText.slice(0, 300))

        if (afterState === beforeState) {
          console.log(`    ⚠️ 点击后无变化（可能无反应）`)
          clickTestResults.push({ button: btn.text, result: 'no_change' })
        } else {
          console.log(`    ✅ 点击后有变化（${beforeState} → ${afterState}）`)
          clickTestResults.push({ button: btn.text, result: 'changed', detail: afterPreview.slice(0, 100) })
        }
      } catch (e) {
        console.log(`    ❌ 点击失败: ${e.message.split('\n')[0]}`)
        clickTestResults.push({ button: btn.text, result: 'fail', error: e.message.split('\n')[0] })
      }
    }

    diagnosis.push({
      ...tab,
      status: 'ok',
      bodyLength: pageInfo.bodyLength,
      bodyPreview: pageInfo.bodyPreview,
      buttons: pageInfo.buttons.map(b => b.text),
      inputs: pageInfo.inputs.length,
      tables: pageInfo.tables,
      unknownUserCount: pageInfo.unknownUserCount,
      clickTests: clickTestResults,
    })
  }

  // 输出完整诊断报告
  console.log('\n' + '='.repeat(60))
  console.log('完整诊断报告')
  console.log('='.repeat(60))

  console.log('\n错误汇总:')
  if (allErrors.length === 0) {
    console.log('  无错误')
  } else {
    allErrors.forEach(e => console.log('  ' + e))
  }

  console.log('\n各 Tab 概况:')
  diagnosis.forEach(d => {
    console.log(`\n  [${d.id}] ${d.name}:`)
    console.log(`    状态: ${d.status}`)
    if (d.bodyLength) console.log(`    内容长度: ${d.bodyLength}`)
    if (d.buttons) console.log(`    按钮: ${d.buttons.join(' | ') || '(无)'}`)
    if (d.unknownUserCount > 0) console.log(`    ⚠️ 未知用户: ${d.unknownUserCount} 个`)
    if (d.clickTests && d.clickTests.length > 0) {
      d.clickTests.forEach(ct => {
        console.log(`    点击测试 [${ct.button}]: ${ct.result}`)
      })
    }
  })

  // 保存诊断结果到 JSON
  const reportPath = path.join(SCREENSHOT_DIR, 'diagnosis-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(diagnosis, null, 2))
  console.log(`\n诊断报告已保存: ${reportPath}`)

  await browser.close()
}

diagnose().catch(e => { console.error(e); process.exit(1) })
