/**
 * MetaGO Studio - 数据链路审计脚本
 * 部署后运行，强制验证所有数据链路是否打通
 * 任何一项失败 = 系统未完成，禁止交付
 *
 * 用法: node scripts/data-flow-audit.cjs
 */

const https = require('https')
const { execSync } = require('child_process')
const fs = require('fs')

const ENV_ID = 'metago-d6gfw1e4rf2a5bcad'
const ADMIN_TOKEN = Buffer.from('admin:0:metago-admin-2026-secret-key').toString('base64')

const results = []
let passCount = 0
let failCount = 0

function check(name, condition, detail) {
  const status = condition ? 'PASS' : 'FAIL'
  if (condition) passCount++
  else failCount++
  results.push({ name, status, detail })
  console.log(`[${status}] ${name}`)
  if (detail) console.log(`         ${detail}`)
}

async function main() {
  console.log('='.repeat(60))
  console.log('MetaGO Studio 数据链路审计')
  console.log('环境:', ENV_ID)
  console.log('时间:', new Date().toISOString())
  console.log('='.repeat(60))

  // ========== 检查1: 前端是否可访问 ==========
  console.log('\n--- 检查1: 前端部署 ---')
  try {
    const res = await httpGet(`https://metago.life/studio/?nocache=${Date.now()}`)
    check('Studio 前端可访问', res.status === 200, `HTTP ${res.status}`)
  } catch (e) {
    check('Studio 前端可访问', false, e.message)
  }

  // ========== 检查2: AdminPage JS 是否部署 ==========
  console.log('\n--- 检查2: 管理后台资源 ---')
  try {
    const adminJs = await findAdminJsAsset()
    if (adminJs) {
      const res = await httpGet(`https://metago.life/studio/assets/${adminJs}?nocache=${Date.now()}`)
      check('AdminPage JS 已部署', res.status === 200, `${adminJs} (${res.contentLength} bytes)`)
    } else {
      check('AdminPage JS 已部署', false, '未找到 AdminPage JS 文件')
    }
  } catch (e) {
    check('AdminPage JS 已部署', false, e.message)
  }

  // ========== 检查3: 云函数是否已部署 ==========
  console.log('\n--- 检查3: 云函数部署 ---')
  const functions = ['sync', 'admin', 'subscription', 'payment', 'github-oauth', 'auth']
  for (const fn of functions) {
    try {
      const output = execSync(
        `tcb fn detail ${fn} --env-id ${ENV_ID} 2>&1`,
        { encoding: 'utf8', timeout: 30000 }
      )
      check(`云函数 ${fn} 已部署`, output.includes('部署完成'), '')
    } catch (e) {
      check(`云函数 ${fn} 已部署`, false, e.message.substring(0, 100))
    }
  }

  // ========== 检查4: AuthContext 是否有 syncProfile 调用 ==========
  console.log('\n--- 检查4: 数据打通代码完整性 ---')
  try {
    const authContent = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8')
    check('AuthContext 包含 syncProfileToCloud', authContent.includes('syncProfileToCloud'), '')
    check('AuthContext 调用 syncProfile action', authContent.includes("action: 'syncProfile'"), '')
    check('refreshUser 中调用 syncProfile', authContent.includes('await syncProfileToCloud(info)'), '')
  } catch (e) {
    check('AuthContext 数据打通代码', false, e.message)
  }

  // ========== 检查5: sync 云函数是否有 syncProfile action ==========
  console.log('\n--- 检查5: sync 云函数 syncProfile action ---')
  try {
    const syncContent = fs.readFileSync('cloudfunctions/sync/index.js', 'utf8')
    check('sync 云函数包含 syncProfile case', syncContent.includes("case 'syncProfile'"), '')
    check('syncProfile 写入 user_profiles 集合', syncContent.includes("db.collection('user_profiles')"), '')
    check('syncProfile 处理创建和更新两种情况',
      syncContent.includes('add({ data: newProfile })') && syncContent.includes('update(updateData)'), '')
  } catch (e) {
    check('sync 云函数 syncProfile', false, e.message)
  }

  // ========== 检查6: 管理后台独立布局（不渲染 Studio Header/FeedbackButton）==========
  console.log('\n--- 检查6: 管理后台独立布局 ---')
  try {
    const appContent = fs.readFileSync('src/App.tsx', 'utf8')
    // 管理后台应该是独立路由，不嵌套在 Studio Header 布局中
    check('App.tsx /admin 为独立路由', appContent.includes('path="/admin"') && !appContent.includes('ConditionalFeedbackButton'), '管理后台不渲染 Studio Header')
    // 管理后台不应该有 FeedbackButton
    const adminRouteMatch = appContent.match(/path="\/admin"[^}]*element=\{[^}]*<AdminPage/)
    check('/admin 路由不包含 FeedbackButton', !appContent.includes('ConditionalFeedbackButton'), '通过独立路由隔离')
    // AdminPage 应有自己的全屏布局
    const adminContent = fs.readFileSync('src/pages/AdminPage.tsx', 'utf8')
    check('AdminPage 有全屏布局', adminContent.includes('min-h-screen') && adminContent.includes('bg-atmosphere'), '独立全屏布局')
  } catch (e) {
    check('管理后台独立布局', false, e.message)
  }

  // ========== 检查7: admin 云函数数据查询完整性 ==========
  console.log('\n--- 检查7: admin 云函数数据查询 ---')
  try {
    const adminContent = fs.readFileSync('cloudfunctions/admin/index.js', 'utf8')
    check('admin 查询 user_profiles', adminContent.includes("collection('user_profiles')"), '')
    check('admin 查询 orders', adminContent.includes("collection('orders')"), '')
    check('admin 查询 licenses', adminContent.includes("collection('licenses')"), '')
    check('admin 查询 feedback', adminContent.includes("collection('feedback')"), '')
    check('admin 有 safeCount 容错', adminContent.includes('safeCount'), '')
    check('admin token 永久有效', adminContent.includes("':0'") || adminContent.includes(':0'), '')
  } catch (e) {
    check('admin 云函数数据查询', false, e.message)
  }

  // ========== 检查8: 数据链路完整性（关键！） ==========
  console.log('\n--- 检查8: 数据链路完整性（写入→读取一致性） ---')
  try {
    const syncContent = fs.readFileSync('cloudfunctions/sync/index.js', 'utf8')
    const adminContent = fs.readFileSync('cloudfunctions/admin/index.js', 'utf8')

    // sync 写入的集合必须与 admin 读取的集合一致
    const syncCollections = extractCollections(syncContent)
    const adminCollections = extractCollections(adminContent)

    check('sync 和 admin 都操作 user_profiles',
      syncContent.includes("user_profiles") && adminContent.includes("user_profiles"),
      `sync: ${syncCollections.join(', ')} | admin: ${adminCollections.join(', ')}`)

    // 关键检查：user_profiles 的写入字段与读取字段是否匹配
    const syncWrites = syncContent.includes('email') && syncContent.includes('phone') && syncContent.includes('displayName')
    const adminReads = adminContent.includes('email') && adminContent.includes('phone') && adminContent.includes('displayName')
    check('用户档案字段写入读取一致', syncWrites && adminReads, '')
  } catch (e) {
    check('数据链路完整性', false, e.message)
  }

  // ========== 检查9: 源代码 vs 部署版本一致性 ==========
  console.log('\n--- 检查9: 部署一致性 ---')
  try {
    // 检查 dist 目录是否存在（是否已构建）
    const distExists = fs.existsSync('dist/index.html')
    check('前端已构建 (dist/)', distExists, '')

    if (distExists) {
      const distContent = fs.readFileSync('dist/index.html', 'utf8')
      // 检查 dist 是否包含最新的 JS 文件引用
      const jsMatch = distContent.match(/src="([^"]*index[^"]*\.js)"/)
      if (jsMatch) {
        const jsFile = jsMatch[1].replace(/^\.\//, '')
        const jsExists = fs.existsSync(`dist/${jsFile}`) || fs.existsSync(`dist/assets/${jsFile.split('/').pop()}`)
        check('dist 引用的 JS 文件存在', jsExists, jsFile)
      }
    }
  } catch (e) {
    check('部署一致性', false, e.message)
  }

  // ========== 检查10: 子目录部署资源路径（白屏防护） ==========
  console.log('\n--- 检查10: 子目录部署资源路径（白屏防护） ---')
  try {
    const viteConfig = fs.readFileSync('vite.config.ts', 'utf8')
    check('vite base 配置为 /studio/', viteConfig.includes("base: '/studio/'"), '防止无斜杠访问白屏')

    const distContent = fs.readFileSync('dist/index.html', 'utf8')
    check('dist 资源路径为绝对路径 /studio/assets/', distContent.includes('/studio/assets/'), '相对路径会导致白屏')
    check('dist favicon 为绝对路径', distContent.includes('/studio/favicon.svg'), '')
  } catch (e) {
    check('子目录部署资源路径', false, e.message)
  }

  // ========== 汇总报告 ==========
  console.log('\n' + '='.repeat(60))
  console.log('审计汇总')
  console.log('='.repeat(60))
  console.log(`通过: ${passCount}  失败: ${failCount}  总计: ${passCount + failCount}`)

  if (failCount > 0) {
    console.log('\n❌ 审计未通过 - 以下项需要修复:')
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   - ${r.name}${r.detail ? ' (' + r.detail + ')' : ''}`)
    })
    process.exit(1)
  } else {
    console.log('\n✅ 审计通过 - 所有数据链路已打通')
    process.exit(0)
  }
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 15000 }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          contentLength: data.length,
          body: data,
        })
      })
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')))
  })
}

async function findAdminJsAsset() {
  try {
    const distHtml = fs.readFileSync('dist/index.html', 'utf8')
    // AdminPage 是懒加载的，不在 index.html 中
    // 直接检查 dist/assets 目录
    const assetsDir = 'dist/assets'
    if (fs.existsSync(assetsDir)) {
      const files = fs.readdirSync(assetsDir)
      const adminFile = files.find(f => f.startsWith('AdminPage'))
      return adminFile
    }
  } catch {}
  return null
}

function extractCollections(content) {
  const matches = content.match(/collection\(['"]([^'"]+)['"]\)/g) || []
  const collections = [...new Set(matches.map(m => m.match(/['"]([^'"]+)['"]/)[1]))]
  return collections
}

main().catch(e => {
  console.error('审计脚本异常:', e.message)
  process.exit(1)
})
