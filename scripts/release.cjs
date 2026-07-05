/**
 * 发布脚本
 * 用法：
 *   node scripts/release.cjs patch  → 1.0.0 → 1.0.1
 *   node scripts/release.cjs minor  → 1.0.0 → 1.1.0
 *   node scripts/release.cjs major  → 1.0.0 → 2.0.0
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const type = process.argv[2] || 'patch'
const validTypes = ['patch', 'minor', 'major']
if (!validTypes.includes(type)) {
  console.error('用法: node scripts/release.cjs [patch|minor|major]')
  process.exit(1)
}

function run(cmd) {
  console.log(`> ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd: __dirname + '/..' })
}

console.log(`\n🚀 开始发布 (${type})\n`)

// 1. TypeScript 检查
console.log('📋 1/5 TypeScript 类型检查...')
run('npx tsc -b --noEmit')

// 2. 版本升级
console.log('\n📋 2/5 升级版本号...')
run(`npm version ${type} --no-git-tag-version`)

// 3. 读取新版本号
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))
const version = pkg.version
console.log(`\n✅ 版本号: v${version}`)

// 4. 构建前端
console.log('\n📋 3/5 构建前端...')
run('npm run build')

// 5. 构建桌面端
console.log('\n📋 4/5 构建 Windows 桌面端...')
run('npm run electron:build:win')

// 6. Git 提交 + 标签
console.log('\n📋 5/5 Git 提交 + 标签...')
run('git add -A')
run(`git commit -m "chore: release v${version}"`)
run(`git tag v${version}`)
run(`git push origin main --tags`)

console.log(`\n✅ 发布完成！v${version}`)
console.log('\n📌 CI/CD 将自动：')
console.log('   1. 运行 E2E 测试')
console.log('   2. 构建 Windows EXE')
console.log('   3. 部署到 metago.life')
console.log('\n⏳ 等待 GitHub Actions 完成部署...')
