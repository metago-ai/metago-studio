/**
 * SPA Fallback 生成器
 *
 * 为 Studio 的每个路由生成对应的 /route/index.html（内容与 dist/index.html 相同），
 * 解决 CloudBase 静态托管直接访问子路由返回 500 的问题。
 *
 * 原理：CloudBase 静态托管的"错误文档"是全局的，无法同时满足官网(/)和 Studio(/studio/)的 SPA fallback。
 * 通过为每个路由生成物理 index.html，让 CloudBase 直接返回该文件，SPA 路由器接管渲染。
 *
 * 用法：在 vite build 后、tcb hosting deploy 前运行
 *   node scripts/generate-spa-fallback.cjs
 */

const fs = require('fs')
const path = require('path')

const distDir = path.join(__dirname, '..', 'dist')
const indexHtmlPath = path.join(distDir, 'index.html')

// Studio 所有路由（从 src/App.tsx 提取，不含动态路由 /shared/:encoded）
const ROUTES = [
  'agent',
  'auth',
  'skills',
  'decision-lock',
  'evolution',
  'metrics',
  'templates',
  'kit',
  'pro',
  'settings',
  'private-skills',
  'terms',
  'privacy',
  'refund',
  'help',
  'profile',
  'roles',
  'behavior-bank',
  'certify',
  'admin',
]

if (!fs.existsSync(indexHtmlPath)) {
  console.error('❌ dist/index.html 不存在，请先运行 vite build')
  process.exit(1)
}

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8')
let generated = 0

for (const route of ROUTES) {
  const routeDir = path.join(distDir, route)
  const routeIndex = path.join(routeDir, 'index.html')

  try {
    if (!fs.existsSync(routeDir)) {
      fs.mkdirSync(routeDir, { recursive: true })
    }
    fs.writeFileSync(routeIndex, indexHtml)
    generated++
    console.log(`  ✅ ${route}/index.html`)
  } catch (e) {
    console.error(`  ❌ ${route}/index.html: ${e.message}`)
  }
}

console.log(`\n✅ 已生成 ${generated}/${ROUTES.length} 个 SPA fallback 文件`)
console.log('   现在直接访问 /studio/agent 等子路由将返回 index.html，SPA 路由器接管渲染')
