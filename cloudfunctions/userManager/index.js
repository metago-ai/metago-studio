/**
 * MetaGO Studio - userManager 云函数
 * 真实用户系统：注册 / 登录 / 配额 / 使用记录
 *
 * Action 列表：
 *   - register           手机号+密码注册（bcrypt 哈希）
 *   - login              手机号+密码登录（返回 JWT）
 *   - getProfile         根据 token 获取用户信息 + 订阅状态
 *   - checkQuota         检查当日 AI 调用配额（Free:10/天，Pro:无限）
 *   - recordUsage        记录一次 AI 调用到 usage_logs
 *   - getUsageStats      获取用户使用统计
 *
 * 响应格式统一：{ code: 0, data: {...} } 或 { code: 1, message: "错误信息" }
 *
 * 注意：
 *   - 手机验证码登录由 CloudBase Auth SDK（auth.signInWithOtp）在前端直接处理，走腾讯云 SMS 真实下发
 *   - JWT secret 用环境变量 JWT_SECRET，未设置时用默认值
 *   - 使用 @cloudbase/node-sdk 操作数据库
 */

const tcb = require('@cloudbase/node-sdk')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

const app = tcb.init({ env: 'metago-d6gfw1e4rf2a5bcad' })
const db = app.database()

const JWT_SECRET = process.env.JWT_SECRET || 'metago-jwt-secret-2026'
const FREE_DAILY_LIMIT = 10

// ============ JWT 实现（HMAC-SHA256，零额外依赖）============

function base64UrlEncode(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function signToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const body = { ...payload, iat: now, exp: now + 7 * 24 * 3600 } // 7 天过期
  const encoded = `${base64UrlEncode(Buffer.from(JSON.stringify(header)))}.${base64UrlEncode(Buffer.from(JSON.stringify(body)))}`
  const sig = base64UrlEncode(crypto.createHmac('sha256', JWT_SECRET).update(encoded).digest())
  return `${encoded}.${sig}`
}

function verifyToken(token) {
  if (!token) return null
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const expected = base64UrlEncode(crypto.createHmac('sha256', JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest())
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]))) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

// ============ 辅助函数 ============

function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(String(phone || ''))
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function publicUser(u) {
  if (!u) return null
  return {
    userId: u._id,
    phone: u.phone,
    nickname: u.nickname || '',
    avatar: u.avatar || '',
    plan: u.plan || 'free',
    planExpiresAt: u.planExpiresAt ? new Date(u.planExpiresAt).toISOString() : null,
  }
}

/**
 * 判断用户当前是否为付费档位（plan != free 且未过期）
 */
function isProPlan(user) {
  if (!user || user.plan === 'free') return false
  if (!user.planExpiresAt) return true // 无过期时间视为永久
  return new Date(user.planExpiresAt) > new Date()
}

// ============ 主入口 ============

exports.main = async (event, context) => {
  const { action } = event
  try {
    switch (action) {
      case 'register':
        return await handleRegister(event)
      case 'login':
        return await handleLogin(event)
      case 'getProfile':
        return await handleGetProfile(event)
      case 'checkQuota':
        return await handleCheckQuota(event)
      case 'recordUsage':
        return await handleRecordUsage(event)
      case 'getUsageStats':
        return await handleGetUsageStats(event)
      default:
        return { code: 1, message: '未知操作: ' + action }
    }
  } catch (e) {
    console.error('[userManager] 错误', e)
    return { code: 1, message: e.message || '服务异常' }
  }
}

// ============ Handlers ============

async function handleRegister(event) {
  const { phone, password, nickname } = event
  if (!isValidPhone(phone)) return { code: 1, message: '手机号格式不正确' }
  if (!password || password.length < 6) return { code: 1, message: '密码至少 6 位' }

  const exist = await db.collection('users').where({ phone }).count()
  if (exist.total > 0) return { code: 1, message: '手机号已注册' }

  const now = new Date()
  const userDoc = {
    phone,
    passwordHash: bcrypt.hashSync(password, 10),
    nickname: nickname || `用户${phone.slice(-4)}`,
    avatar: '',
    plan: 'free',
    planExpiresAt: null,
    createdAt: now,
    updatedAt: now,
  }
  const res = await db.collection('users').add(userDoc)
  const token = signToken({ userId: res.id, phone })
  return { code: 0, data: { token, user: publicUser({ _id: res.id, ...userDoc }) } }
}

async function handleLogin(event) {
  const { phone, password } = event
  if (!isValidPhone(phone)) return { code: 1, message: '手机号或密码错误' }

  const { data } = await db.collection('users').where({ phone }).get()
  if (!data || data.length === 0) return { code: 1, message: '手机号或密码错误' }
  const user = data[0]
  if (!user.passwordHash || !bcrypt.compareSync(password, user.passwordHash)) {
    return { code: 1, message: '手机号或密码错误' }
  }
  // 检查订阅是否过期
  if (user.plan !== 'free' && user.planExpiresAt && new Date(user.planExpiresAt) <= new Date()) {
    await db.collection('users').doc(user._id).update({ plan: 'free', planExpiresAt: null, updatedAt: new Date() })
    user.plan = 'free'
    user.planExpiresAt = null
  }
  const token = signToken({ userId: user._id, phone: user.phone })
  return { code: 0, data: { token, user: publicUser(user) } }
}

async function handleGetProfile(event) {
  const payload = verifyToken(event.token)
  if (!payload) return { code: 1, message: '登录已过期，请重新登录' }

  const { data } = await db.collection('users').doc(payload.userId).get()
  if (!data || data.length === 0) return { code: 1, message: '用户不存在' }
  const user = data[0]
  // 检查订阅是否过期
  if (user.plan !== 'free' && user.planExpiresAt && new Date(user.planExpiresAt) <= new Date()) {
    await db.collection('users').doc(user._id).update({ plan: 'free', planExpiresAt: null, updatedAt: new Date() })
    user.plan = 'free'
    user.planExpiresAt = null
  }
  return { code: 0, data: publicUser(user) }
}

async function handleCheckQuota(event) {
  const payload = verifyToken(event.token)
  if (!payload) return { code: 1, message: '登录已过期' }

  const { data } = await db.collection('users').doc(payload.userId).get()
  if (!data || data.length === 0) return { code: 1, message: '用户不存在' }
  const user = data[0]

  // Pro 及以上：无限
  if (isProPlan(user)) {
    return { code: 0, data: { remaining: -1, total: -1, used: 0 } }
  }

  // Free 用户：按日计数
  const date = todayStr()
  const countRes = await db.collection('usage_logs')
    .where({ userId: payload.userId, date })
    .count()
  const used = countRes.total || 0
  const remaining = Math.max(0, FREE_DAILY_LIMIT - used)

  return { code: 0, data: { remaining, total: FREE_DAILY_LIMIT, used } }
}

async function handleRecordUsage(event) {
  const payload = verifyToken(event.token)
  if (!payload) return { code: 1, message: '登录已过期' }

  const date = todayStr()
  const countRes = await db.collection('usage_logs')
    .where({ userId: payload.userId, date })
    .count()

  // Free 用户检查配额
  const { data } = await db.collection('users').doc(payload.userId).get()
  if (data && data.length > 0) {
    const user = data[0]
    if (!isProPlan(user) && countRes.total >= FREE_DAILY_LIMIT) {
      return { code: 1, message: '今日免费配额已用完，请升级 Pro' }
    }
  }

  await db.collection('usage_logs').add({
    userId: payload.userId,
    date,
    modelId: event.modelId || 'unknown',
    timestamp: new Date(),
  })

  return { code: 0, data: { success: true } }
}

async function handleGetUsageStats(event) {
  const payload = verifyToken(event.token)
  if (!payload) return { code: 1, message: '登录已过期' }

  // 今日统计
  const date = todayStr()
  const todayCount = await db.collection('usage_logs')
    .where({ userId: payload.userId, date })
    .count()

  // 本月统计
  const monthStart = date.slice(0, 7) + '-01'
  const monthCount = await db.collection('usage_logs')
    .where({
      userId: payload.userId,
      date: db.command.gte(monthStart).and(db.command.lte(date))
    })
    .count()

  return {
    code: 0,
    data: {
      today: todayCount.total || 0,
      thisMonth: monthCount.total || 0,
    }
  }
}
