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
  // HTTP 触发兼容：解析 HTTP body
  if (event.httpMethod && event.body) {
    try {
      const parsed = JSON.parse(event.body)
      event = { ...event, ...parsed }
    } catch { /* body 不是 JSON */ }
  }

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
        data: { tier, expiresAt: expiresAt ? new Date(expiresAt) : null, updatedAt: new Date(), updatedBy: admin.username }
      })
      return { code: 0, message: '更新成功' }
    }

    case 'banUser': {
      const { targetOpenid, banned = true } = event
      await db.collection('user_profiles').where({ openid: targetOpenid }).update({
        data: { banned, bannedAt: banned ? new Date() : null, updatedBy: admin.username }
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
        data: { status: 'revoked', revokedAt: new Date(), revokedBy: admin.username }
      })
      await db.collection('user_profiles').where({ licenseKey }).update({
        data: { tier: 'free', licenseKey: null, expiresAt: null, updatedAt: new Date() }
      })
      return { code: 0, message: '授权码已作废' }
    }

    case 'generateLicense': {
      const { plan = 'pro', count = 1, durationDays = 30, note = '' } = event
      const tier = plan === 'team' ? 'team' : 'pro'
      const crypto = require('crypto')
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      const seg = () => {
        const buf = crypto.randomBytes(4)
        let s = ''
        for (let i = 0; i < 4; i++) {
          s += chars[buf[i] % chars.length]
        }
        return s
      }
      const licenses = []
      const now = new Date()
      // 确保 licenses 集合存在
      try { await db.createCollection('licenses') } catch { /* 已存在 */ }
      for (let i = 0; i < count; i++) {
        const key = `METAGO-${tier.toUpperCase()}-${seg()}-${seg()}-${seg()}`
        const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)
        await db.collection('licenses').add({
          licenseKey: key,
          plan: tier,
          durationDays,
          expiresAt,
          status: 'unused',
          note,
          seats: tier === 'team' ? 5 : 1,
          createdBy: admin.username,
          createdAt: now,
        })
        licenses.push({ licenseKey: key, expiresAt: expiresAt.toISOString(), plan: tier })
      }
      return { code: 0, data: { licenses } }
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
        proUsers, proPlusUsers, teamUsers, enterpriseUsers,
        totalOrders, paidOrders, certifyOrders,
        todayNewUsers, totalLicenses, usedLicenses,
      ] = await Promise.all([
        safeCount('user_profiles'),
        safeCount('user_profiles', { lastActiveAt: _.gte(todayStart) }),
        safeCount('user_profiles', { lastActiveAt: _.gte(weekAgo) }),
        safeCount('user_profiles', { lastActiveAt: _.gte(monthAgo) }),
        safeCount('user_profiles', { tier: 'pro' }),
        safeCount('user_profiles', { tier: 'pro_plus' }),
        safeCount('user_profiles', { tier: 'team' }),
        safeCount('user_profiles', { tier: 'enterprise' }),
        safeCount('orders'),
        safeCount('orders', { status: 'completed', amount: _.gt(0) }),
        safeCount('certify_orders', { status: 'paid' }),
        safeCount('user_profiles', { createdAt: _.gte(todayStart) }),
        safeCount('licenses'),
        safeCount('licenses', { status: 'used' }),
      ])

      const paidOrdersData = await safeGet('orders', { status: 'completed', amount: _.gt(0) })
      const totalRevenue = paidOrdersData.reduce((sum, o) => sum + (o.amount || 0), 0)
      // V3 五档付费用户数（不含 trial，已下线）
      const paidSubscribers = proUsers + proPlusUsers + teamUsers + enterpriseUsers

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
            // V3 五档定价
            pro: proUsers,
            proPlus: proPlusUsers,
            team: teamUsers,
            enterprise: enterpriseUsers,
            free: totalUsers - paidSubscribers,
            paidTotal: paidSubscribers,
            conversionRate: totalUsers > 0 ? (paidSubscribers / totalUsers * 100).toFixed(1) : 0,
          },
          orders: {
            total: totalOrders,
            paid: paidOrders,
            certify: certifyOrders,
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
        data: { reply, repliedAt: new Date(), repliedBy: admin.username, status: 'replied' }
      })
      return { code: 0, message: '回复成功' }
    }

    // ==================== Agent 管理 ====================
    case 'getAgentStats': {
      const db = cloud.database()
      const _ = db.command
      const $ = db.command.aggregate

      // 对话总数（events 集合中 eventType=chat）
      let totalChats = 0, todayChats = 0, weekChats = 0, monthChats = 0
      try {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
        const weekStart = new Date(Date.now() - 7 * 24 * 3600 * 1000)
        const monthStart = new Date(Date.now() - 30 * 24 * 3600 * 1000)

        const countRes = await db.collection('events').where({ eventType: 'chat' }).count()
        totalChats = countRes.total
        const todayRes = await db.collection('events').where({ eventType: 'chat', createdAt: _.gte(todayStart) }).count()
        todayChats = todayRes.total
        const weekRes = await db.collection('events').where({ eventType: 'chat', createdAt: _.gte(weekStart) }).count()
        weekChats = weekRes.total
        const monthRes = await db.collection('events').where({ eventType: 'chat', createdAt: _.gte(monthStart) }).count()
        monthChats = monthRes.total
      } catch (e) { /* events 集合可能不存在 */ }

      // Token 消耗总量
      let totalTokens = 0, todayTokens = 0
      try {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
        const aggRes = await db.collection('events')
          .aggregate()
          .match({ eventType: 'chat' })
          .group({ _id: null, total: $.sum('$tokensTotal') })
          .end()
        if (aggRes.data.length > 0) totalTokens = aggRes.data[0].total || 0

        const aggToday = await db.collection('events')
          .aggregate()
          .match({ eventType: 'chat', createdAt: $.gte(todayStart) })
          .group({ _id: null, total: $.sum('$tokensTotal') })
          .end()
        if (aggToday.data.length > 0) todayTokens = aggToday.data[0].total || 0
      } catch (e) { /* 集合为空 */ }

      // 按模型分布
      let byModel = {}
      try {
        const modelAgg = await db.collection('events')
          .aggregate()
          .match({ eventType: 'chat' })
          .group({ _id: '$model', count: $.sum(1) })
          .end()
        byModel = modelAgg.data.reduce((acc, r) => { acc[r._id] = r.count; return acc }, {})
      } catch (e) { /* */ }

      // BYOK 渗透率
      let byokRate = 0
      try {
        const totalUsers = await db.collection('user_profiles').count()
        const byokUsers = await db.collection('user_profiles').where({ byokActive: true }).count()
        byokRate = totalUsers.total > 0 ? (byokUsers.total / totalUsers.total) * 100 : 0
      } catch (e) { /* */ }

      // 桌面端下载量（events 集合中 eventType=download）
      let desktopDownloads = 0
      try {
        const dl = await db.collection('events').where({ eventType: 'download' }).count()
        desktopDownloads = dl.total
      } catch (e) { /* */ }

      // 活跃用户
      let activeUsersDAU = 0, activeUsersWAU = 0, activeUsersMAU = 0
      try {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
        const weekStart = new Date(Date.now() - 7 * 24 * 3600 * 1000)
        const monthStart = new Date(Date.now() - 30 * 24 * 3600 * 1000)
        const dau = await db.collection('events').where({ eventType: 'chat', createdAt: _.gte(todayStart) }).count()
        activeUsersDAU = dau.total // 近似（去重需要更复杂聚合）
        const wau = await db.collection('events').where({ eventType: 'chat', createdAt: _.gte(weekStart) }).count()
        activeUsersWAU = wau.total
        const mau = await db.collection('events').where({ eventType: 'chat', createdAt: _.gte(monthStart) }).count()
        activeUsersMAU = mau.total
      } catch (e) { /* */ }

      return {
        code: 0,
        data: {
          totalChats, todayChats, weekChats, monthChats,
          totalTokens, todayTokens,
          byModel,
          byokRate,
          desktopDownloads,
          activeUsersDAU, activeUsersWAU, activeUsersMAU,
        }
      }
    }

    case 'getAgentLogs': {
      const db = cloud.database()
      const _ = db.command
      const { page = 1, pageSize = 20, userId = '', model = '' } = event
      const skip = (page - 1) * pageSize

      const where = { eventType: 'chat' }
      if (userId) where.userId = userId
      if (model) where.model = model

      try {
        const totalRes = await db.collection('events').where(where).count()
        const listRes = await db.collection('events')
          .where(where)
          .orderBy('createdAt', 'desc')
          .skip(skip)
          .limit(pageSize)
          .get()

        return {
          code: 0,
          data: {
            logs: listRes.data.map(l => ({
              _id: l._id,
              userId: l.userId || 'anonymous',
              model: l.model || 'unknown',
              inputPreview: (l.input || '').slice(0, 80),
              tokensIn: l.tokensIn || 0,
              tokensOut: l.tokensOut || 0,
              tokensTotal: l.tokensTotal || (l.tokensIn || 0) + (l.tokensOut || 0),
              hasToolCalls: (l.toolCalls && l.toolCalls.length > 0) || !!l.hasToolCalls,
              toolCallCount: l.toolCalls ? l.toolCalls.length : (l.toolCallCount || 0),
              hasWebSearch: !!l.hasWebSearch,
              durationMs: l.durationMs || 0,
              createdAt: l.createdAt,
            })),
            total: totalRes.total,
          }
        }
      } catch (e) {
        return { code: 0, data: { logs: [], total: 0 } }
      }
    }

    case 'getAgentQuota': {
      const db = cloud.database()
      const { page = 1, pageSize = 20, search = '' } = event
      const skip = (page - 1) * pageSize

      const where = {}
      if (search) {
        const _ = db.command
        where.email = db.RegExp({ regexp: search, options: 'i' })
      }

      try {
        const totalRes = await db.collection('user_profiles').where(where).count()
        const listRes = await db.collection('user_profiles')
          .where(where)
          .orderBy('lastActiveAt', 'desc')
          .skip(skip)
          .limit(pageSize)
          .get()

        return {
          code: 0,
          data: {
            quotas: listRes.data.map(u => ({
              userId: u._id,
              email: u.email || '',
              tier: u.tier || 'free',
              todayTokens: (u.tokenUsage && u.tokenUsage.today) || 0,
              monthTokens: (u.tokenUsage && u.tokenUsage.month) || 0,
              monthCap: (u.tokenUsage && u.tokenUsage.monthCap) || 0,
              lastActiveAt: u.lastActiveAt || '',
            })),
            total: totalRes.total,
          }
        }
      } catch (e) {
        return { code: 0, data: { quotas: [], total: 0 } }
      }
    }

    case 'rechargeTokens': {
      const db = cloud.database()
      const _ = db.command
      const { userId, amount } = event
      if (!userId || !amount || amount <= 0) {
        return { code: 400, message: '参数错误' }
      }
      try {
        // 给用户加临时额度（写到 tokenUsage.bonus 字段）
        await db.collection('user_profiles').doc(userId).update({
          data: {
            'tokenUsage.bonus': _.inc(amount),
            lastRechargeAt: new Date(),
          }
        })
        // 记录充值日志
        await db.collection('events').add({
          data: {
            eventType: 'admin_recharge',
            userId,
            amount,
            adminUser: verifyToken(event.adminToken || event.token)?.username || 'unknown',
            createdAt: new Date(),
          }
        })
        return { code: 0, message: `已充值 ${amount} tokens` }
      } catch (e) {
        return { code: 500, message: '充值失败：' + e.message }
      }
    }

    default:
      return { code: 400, message: '未知操作' }
  }
}
