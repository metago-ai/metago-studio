/**
 * MetaGO Studio - Admin Cloud Function
 * 运营管理后台API：账号密码登录 + 用户/订单/授权码/反馈管理
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: 'metago-d6gfw1e4rf2a5bcad' })

// 管理员账号（硬编码，无需控制台配置）
const ADMIN_ACCOUNTS = [
  { username: 'admin', password: 'Metago@2026', role: 'super' },
]

const TOKEN_SECRET = 'metago-admin-2026-secret-key'

function generateToken(username) {
  // token永久有效，不过期
  const payload = `${username}:0`
  const token = Buffer.from(`${payload}:${TOKEN_SECRET}`).toString('base64')
  return token
}

function verifyToken(token) {
  if (!token) return null
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const parts = decoded.split(':')
    if (parts.length < 3) return null
    const username = parts[0]
    const secret = parts.slice(2).join(':')
    if (secret !== TOKEN_SECRET) return null
    const admin = ADMIN_ACCOUNTS.find(a => a.username === username)
    return admin || null
  } catch {
    return null
  }
}

exports.main = async (event) => {
  const { action } = event

  // 登录接口：不需要token
  if (action === 'login') {
    const { username, password } = event
    const admin = ADMIN_ACCOUNTS.find(a => a.username === username && a.password === password)
    if (!admin) {
      return { code: 401, message: '账号或密码错误' }
    }
    return {
      code: 0,
      message: '登录成功',
      data: {
        token: generateToken(admin.username),
        username: admin.username,
        role: admin.role,
        expireAt: 0,
      },
    }
  }

  // 验证token
  const token = event.adminToken
  const admin = verifyToken(token)
  if (!admin) {
    return { code: 401, message: '未登录或登录已过期' }
  }

  const db = cloud.database()
  const _ = db.command

  switch (action) {
    // ========== 验证登录状态 ==========
    case 'checkAuth': {
      return { code: 0, data: { username: admin.username, role: admin.role } }
    }

    // ========== 用户管理 ==========
    case 'listUsers': {
      const { page = 1, pageSize = 20, search = '' } = event
      const skip = (page - 1) * pageSize
      try {
        let query = db.collection('user_profiles')
        if (search) {
          query = query.where(_.or([
            { openid: db.RegExp({ regexp: search, options: 'i' }) },
            { email: db.RegExp({ regexp: search, options: 'i' }) },
            { phone: db.RegExp({ regexp: search, options: 'i' }) },
            { displayName: db.RegExp({ regexp: search, options: 'i' }) },
          ]))
        }
        const countRes = await query.count()
        const res = await query.orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get()
        return {
          code: 0,
          data: {
            users: res.data,
            total: countRes.total,
            page,
            pageSize,
          },
        }
      } catch {
        return { code: 0, data: { users: [], total: 0, page, pageSize } }
      }
    }

    case 'getUser': {
      const { targetOpenid } = event
      const res = await db.collection('user_profiles').where({ openid: targetOpenid }).get()
      if (!res.data || res.data.length === 0) {
        return { code: 404, message: '用户不存在' }
      }
      const ordersRes = await db.collection('orders').where({ openid: targetOpenid }).orderBy('createdAt', 'desc').limit(50).get()
      return {
        code: 0,
        data: {
          profile: res.data[0],
          orders: ordersRes.data,
        },
      }
    }

    case 'updateUserTier': {
      const { targetOpenid, tier, expiresAt } = event
      await db.collection('user_profiles').where({ openid: targetOpenid }).update({
        tier,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        updatedAt: new Date(),
        updatedBy: admin.username,
      })
      return { code: 0, message: '更新成功' }
    }

    case 'banUser': {
      const { targetOpenid, banned = true } = event
      await db.collection('user_profiles').where({ openid: targetOpenid }).update({
        banned,
        bannedAt: banned ? new Date() : null,
        updatedBy: admin.username,
      })
      return { code: 0, message: banned ? '已封禁' : '已解封' }
    }

    // ========== 订阅/订单管理 ==========
    case 'listOrders': {
      const { page = 1, pageSize = 20, status = '' } = event
      const skip = (page - 1) * pageSize
      try {
        let query = db.collection('orders')
        if (status) query = query.where({ status })
        const countRes = await query.count()
        const res = await query.orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get()
        return {
          code: 0,
          data: { orders: res.data, total: countRes.total, page, pageSize },
        }
      } catch {
        return { code: 0, data: { orders: [], total: 0, page, pageSize } }
      }
    }

    // ========== 授权码管理 ==========
    case 'listLicenses': {
      const { page = 1, pageSize = 20, status = '' } = event
      const skip = (page - 1) * pageSize
      try {
        let query = db.collection('licenses')
        if (status) query = query.where({ status })
        const countRes = await query.count()
        const res = await query.orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get()
        return {
          code: 0,
          data: { licenses: res.data, total: countRes.total, page, pageSize },
        }
      } catch {
        return { code: 0, data: { licenses: [], total: 0, page, pageSize } }
      }
    }

    case 'revokeLicense': {
      const { licenseKey } = event
      await db.collection('licenses').where({ licenseKey }).update({
        status: 'revoked',
        revokedAt: new Date(),
        revokedBy: admin.username,
      })
      await db.collection('user_profiles').where({ licenseKey }).update({
        tier: 'free',
        licenseKey: null,
        expiresAt: null,
        updatedAt: new Date(),
      })
      return { code: 0, message: '授权码已作废' }
    }

    // ========== 数据统计 ==========
    case 'getStats': {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekAgo = new Date(now.getTime() - 7 * 86400000)
      const monthAgo = new Date(now.getTime() - 30 * 86400000)

      const safeCount = async (collection, where) => {
        try {
          let q = db.collection(collection)
          if (where) q = q.where(where)
          const res = await q.count()
          return res.total
        } catch { return 0 }
      }
      const safeGet = async (collection, where, limit = 1000) => {
        try {
          let q = db.collection(collection)
          if (where) q = q.where(where)
          const res = await q.limit(limit).get()
          return res.data
        } catch { return [] }
      }

      const [
        totalUsers, todayActive, weekActive, monthActive,
        proUsers, totalOrders, paidOrders, trialOrders,
        todayNewUsers, totalLicenses, usedLicenses,
      ] = await Promise.all([
        safeCount('user_profiles'),
        safeCount('user_profiles', { lastActiveAt: _.gte(todayStart) }),
        safeCount('user_profiles', { lastActiveAt: _.gte(weekAgo) }),
        safeCount('user_profiles', { lastActiveAt: _.gte(monthAgo) }),
        safeCount('user_profiles', { tier: 'pro' }),
        safeCount('orders'),
        safeCount('orders', { status: 'completed', amount: _.gt(0) }),
        safeCount('orders', { status: 'completed', amount: 0 }),
        safeCount('user_profiles', { createdAt: _.gte(todayStart) }),
        safeCount('licenses'),
        safeCount('licenses', { status: 'used' }),
      ])

      const paidOrdersData = await safeGet('orders', { status: 'completed', amount: _.gt(0) })
      const totalRevenue = paidOrdersData.reduce((sum, o) => sum + (o.amount || 0), 0)

      return {
        code: 0,
        data: {
          users: {
            total: totalUsers,
            todayNew: todayNewUsers,
            todayActive: todayActive,
            weekActive: weekActive,
            monthActive: monthActive,
          },
          subscriptions: {
            pro: proUsers,
            free: totalUsers - proUsers,
            conversionRate: totalUsers > 0 ? (proUsers / totalUsers * 100).toFixed(1) : 0,
          },
          orders: {
            total: totalOrders,
            paid: paidOrders,
            trial: trialOrders,
          },
          revenue: {
            total: totalRevenue,
            inYuan: (totalRevenue / 100).toFixed(2),
          },
          licenses: {
            total: totalLicenses,
            used: usedLicenses,
            available: totalLicenses - usedLicenses,
          },
        },
      }
    }

    // ========== 反馈管理 ==========
    case 'listFeedback': {
      const { page = 1, pageSize = 20 } = event
      const skip = (page - 1) * pageSize
      try {
        const countRes = await db.collection('feedback').count()
        const res = await db.collection('feedback').orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get()
        return { code: 0, data: { feedback: res.data, total: countRes.total, page, pageSize } }
      } catch {
        return { code: 0, data: { feedback: [], total: 0, page, pageSize } }
      }
    }

    case 'replyFeedback': {
      const { feedbackId, reply } = event
      await db.collection('feedback').doc(feedbackId).update({
        reply,
        repliedAt: new Date(),
        repliedBy: admin.username,
        status: 'replied',
      })
      return { code: 0, message: '回复成功' }
    }

    default:
      return { code: 400, message: '未知操作' }
  }
}
