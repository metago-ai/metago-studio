/**
 * CloudBase 数据库初始化
 * 创建 users 和 usage_logs 集合 + 索引
 *
 * 运行：node scripts/init-database.cjs
 */
const tcb = require('@cloudbase/node-sdk')

const app = tcb.init({ env: 'metago-d6gfw1e4rf2a5bcad' })
const db = app.database()

async function init() {
  console.log('开始初始化数据库...')

  // users 集合
  try {
    await db.createCollection('users')
    console.log('✅ users 集合已创建')
  } catch (e) { console.log('users 集合可能已存在:', e.message) }

  // usage_logs 集合（记录每次 AI 调用）
  try {
    await db.createCollection('usage_logs')
    console.log('✅ usage_logs 集合已创建')
  } catch (e) { console.log('usage_logs 集合可能已存在:', e.message) }

  // subscriptions 集合（订阅记录）
  try {
    await db.createCollection('subscriptions')
    console.log('✅ subscriptions 集合已创建')
  } catch (e) { console.log('subscriptions 集合可能已存在:', e.message) }

  // 创建索引
  await db.collection('users').createIndex({ phone: 1 }, { name: 'phone_unique', unique: true })
  await db.collection('usage_logs').createIndex({ userId: 1, date: 1 }, { name: 'user_date' })
  await db.collection('subscriptions').createIndex({ userId: 1 }, { name: 'userId' })

  console.log('✅ 索引创建完成')
  console.log('数据库初始化完成！')
}

init().catch(e => { console.error('初始化失败:', e); process.exit(1) })
