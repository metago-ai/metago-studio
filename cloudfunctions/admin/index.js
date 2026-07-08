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

  const db = cloud.database()
  const _ = db.command

  // ==================== FDE 服务模式项目管理（不需要 adminToken，使用 _clientUid 识别用户）====================
  // FDE 工作台面向普通用户，不依赖管理员登录态
  const FDE_ACTIONS = ['createFdeProject', 'listFdeProjects', 'getFdeProject', 'updateFdeProject', 'deleteFdeProject']
  if (FDE_ACTIONS.includes(action)) {
    const clientUid = event._clientUid || 'anonymous'
    switch (action) {
      case 'createFdeProject': {
        const { projectName, client, clientContact, description, budget, team, stages } = event
        if (!projectName || !client) {
          return { code: 400, message: '缺少 projectName 或 client' }
        }
        try {
          await db.createCollection('fde_projects').catch(() => {})
          const now = new Date()
          const project = {
            projectName,
            client,
            clientContact: clientContact || '',
            description: description || '',
            budget: budget || 0,
            team: team || [],
            stages: stages || [
              { name: '需求调研', status: 'in_progress', startDate: now.toISOString(), endDate: null },
              { name: '方案设计', status: 'pending', startDate: null, endDate: null },
              { name: '开发部署', status: 'pending', startDate: null, endDate: null },
              { name: '验收交付', status: 'pending', startDate: null, endDate: null },
              { name: '运维支持', status: 'pending', startDate: null, endDate: null },
            ],
            status: 'active',
            progress: 0,
            ownerUid: clientUid,
            createdAt: now,
            updatedAt: now,
          }
          const res = await db.collection('fde_projects').add({ data: project })
          return { code: 0, message: 'FDE 项目已创建', data: { _id: res._id } }
        } catch (e) {
          return { code: 500, message: '创建失败：' + e.message }
        }
      }

      case 'listFdeProjects': {
        const { status = '', page = 1, pageSize = 50 } = event
        try {
          let query = {}
          if (status) query.status = status
          const skip = (page - 1) * pageSize
          const res = await db.collection('fde_projects')
            .where(query)
            .orderBy('createdAt', 'desc')
            .skip(skip)
            .limit(pageSize)
            .get()
          const totalRes = await db.collection('fde_projects').where(query).count()
          return { code: 0, data: { list: res.data, total: totalRes.total } }
        } catch (e) {
          // 集合不存在时返回空列表（首次使用时 fde_projects 集合尚未创建）
          if (String(e.message).includes('not exist') || String(e.message).includes('COLLECTION_NOT_EXIST')) {
            return { code: 0, data: { list: [], total: 0 } }
          }
          return { code: 500, message: '查询失败：' + e.message }
        }
      }

      case 'getFdeProject': {
        const { projectId } = event
        if (!projectId) {
          return { code: 400, message: '缺少 projectId' }
        }
        try {
          const res = await db.collection('fde_projects').doc(projectId).get()
          if (!res.data || res.data.length === 0) {
            return { code: 404, message: '项目不存在' }
          }
          return { code: 0, data: res.data[0] }
        } catch (e) {
          return { code: 500, message: '查询失败：' + e.message }
        }
      }

      case 'updateFdeProject': {
        const { projectId, updates } = event
        if (!projectId || !updates || typeof updates !== 'object') {
          return { code: 400, message: '缺少 projectId 或 updates' }
        }
        try {
          const updateData = { ...updates, updatedAt: new Date() }
          // 保护字段：不允许通过 updates 覆盖 ownerUid
          delete updateData.ownerUid
          delete updateData._id
          delete updateData.createdAt
          // 如果更新了 stages，自动计算 progress
          if (updates.stages && Array.isArray(updates.stages)) {
            const completed = updates.stages.filter(s => s.status === 'completed').length
            updateData.progress = Math.round((completed / updates.stages.length) * 100)
            // 所有阶段完成则项目状态改为 completed
            if (completed === updates.stages.length) {
              updateData.status = 'completed'
            }
          }
          await db.collection('fde_projects').doc(projectId).update({ data: updateData })
          return { code: 0, message: '项目已更新' }
        } catch (e) {
          return { code: 500, message: '更新失败：' + e.message }
        }
      }

      case 'deleteFdeProject': {
        const { projectId } = event
        if (!projectId) {
          return { code: 400, message: '缺少 projectId' }
        }
        try {
          await db.collection('fde_projects').doc(projectId).remove()
          return { code: 0, message: '项目已删除' }
        } catch (e) {
          return { code: 500, message: '删除失败：' + e.message }
        }
      }
    }
    return
  }

  // 验证token（非 FDE action 需要 adminToken）
  const token = event.adminToken
  const admin = verifyToken(token)
  if (!admin) {
    return { code: 401, message: '未登录或登录已过期' }
  }

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
        // 过滤僵尸记录：必须至少有 openid 或 email 或 phone 之一
        const hasIdentifier = _.or([
          { openid: _.and([_.exists(true), _.neq(null), _.neq('')]) },
          { email: _.and([_.exists(true), _.neq(null), _.neq('')]) },
          { phone: _.and([_.exists(true), _.neq(null), _.neq('')]) },
        ])
        let query = db.collection('user_profiles').where(hasIdentifier)
        if (search) {
          query = query.where(_.and([
            hasIdentifier,
            _.or([
              { openid: db.RegExp({ regexp: search, options: 'i' }) },
              { email: db.RegExp({ regexp: search, options: 'i' }) },
              { phone: db.RegExp({ regexp: search, options: 'i' }) },
              { displayName: db.RegExp({ regexp: search, options: 'i' }) },
            ])
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
      const { targetId, targetOpenid, tier, expiresAt } = event
      const where = targetId ? { _id: targetId } : { openid: targetOpenid }
      await db.collection('user_profiles').where(where).update({
        data: { tier, expiresAt: expiresAt ? new Date(expiresAt) : null, updatedAt: new Date(), updatedBy: admin.username }
      })
      return { code: 0, message: '更新成功' }
    }

    case 'banUser': {
      const { targetId, targetOpenid, banned = true } = event
      const where = targetId ? { _id: targetId } : { openid: targetOpenid }
      const res = await db.collection('user_profiles').where(where).update({
        data: { banned, bannedAt: banned ? new Date() : null, updatedBy: admin.username }
      })
      if (res.stats.updated === 0) {
        return { code: 404, message: '未找到用户记录' }
      }
      return { code: 0, message: banned ? '已封禁' : '已解封' }
    }

    case 'resetUserQuota': {
      const { targetId, targetOpenid } = event
      const where = targetId ? { _id: targetId } : { openid: targetOpenid }
      await db.collection('user_profiles').where(where).update({
        data: { tokenUsage: { total: 0, input: 0, output: 0, updatedAt: new Date() }, updatedAt: new Date(), updatedBy: admin.username }
      })
      return { code: 0, message: '配额已重置' }
    }

    // ========== 订阅/订单管理 ==========
    case 'listOrders': {
      const { page = 1, pageSize = 20, status = '' } = event
      const skip = (page - 1) * pageSize
      try {
        // 过滤僵尸记录：必须有 orderId 字段
        let query = db.collection('orders').where({ orderId: _.and([_.exists(true), _.neq(null), _.neq('')]) })
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

    case 'cancelOrder': {
      const { orderId } = event
      if (!orderId) return { code: 400, message: '缺少 orderId' }
      const res = await db.collection('orders').where({ orderId }).update({
        data: { status: 'cancelled', cancelledAt: new Date(), cancelledBy: admin.username }
      })
      if (res.stats.updated === 0) return { code: 404, message: '订单不存在' }
      return { code: 0, message: '订单已取消' }
    }

    case 'markOrderPaid': {
      const { orderId } = event
      if (!orderId) return { code: 400, message: '缺少 orderId' }
      const res = await db.collection('orders').where({ orderId }).update({
        data: { status: 'completed', paidAt: new Date(), updatedAt: new Date(), updatedBy: admin.username }
      })
      if (res.stats.updated === 0) return { code: 404, message: '订单不存在' }
      return { code: 0, message: '订单已标记为已付' }
    }

    // ========== 授权码管理 ==========
    case 'listLicenses': {
      const { page = 1, pageSize = 20, status = '' } = event
      const skip = (page - 1) * pageSize
      try {
        // 过滤僵尸记录：必须有 licenseKey 字段
        let query = db.collection('licenses').where({ licenseKey: _.and([_.exists(true), _.neq(null), _.neq('')]) })
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
          data: {
            licenseKey: key,
            plan: tier,
            durationDays,
            expiresAt,
            status: 'unused',
            note,
            seats: tier === 'team' ? 5 : 1,
            createdBy: admin.username,
            createdAt: now,
          }
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

      // 对话总数（events 集合中 type=chat）
      let totalChats = 0, todayChats = 0, weekChats = 0, monthChats = 0
      try {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
        const weekStart = new Date(Date.now() - 7 * 24 * 3600 * 1000)
        const monthStart = new Date(Date.now() - 30 * 24 * 3600 * 1000)

        const countRes = await db.collection('events').where({ type: 'chat' }).count()
        totalChats = countRes.total
        const todayRes = await db.collection('events').where({ type: 'chat', createdAt: _.gte(todayStart) }).count()
        todayChats = todayRes.total
        const weekRes = await db.collection('events').where({ type: 'chat', createdAt: _.gte(weekStart) }).count()
        weekChats = weekRes.total
        const monthRes = await db.collection('events').where({ type: 'chat', createdAt: _.gte(monthStart) }).count()
        monthChats = monthRes.total
      } catch (e) { /* events 集合可能不存在 */ }

      // Token 消耗总量（从 token_usage_logs 集合查询，aiProxy 实际写入位置）
      let totalTokens = 0, todayTokens = 0
      try {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
        const aggRes = await db.collection('token_usage_logs')
          .aggregate()
          .group({ _id: null, total: $.sum('$totalTokens') })
          .end()
        if (aggRes.data.length > 0) totalTokens = aggRes.data[0].total || 0

        const aggToday = await db.collection('token_usage_logs')
          .aggregate()
          .match({ timestamp: $.gte(todayStart) })
          .group({ _id: null, total: $.sum('$totalTokens') })
          .end()
        if (aggToday.data.length > 0) todayTokens = aggToday.data[0].total || 0
      } catch (e) { /* 集合为空 */ }

      // 按模型分布（从 token_usage_logs 查询）
      let byModel = {}
      try {
        const modelAgg = await db.collection('token_usage_logs')
          .aggregate()
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

      // 桌面端下载量（events 集合中 type=download）
      let desktopDownloads = 0
      try {
        const dl = await db.collection('events').where({ type: 'download' }).count()
        desktopDownloads = dl.total
      } catch (e) { /* */ }

      // 活跃用户
      let activeUsersDAU = 0, activeUsersWAU = 0, activeUsersMAU = 0
      try {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
        const weekStart = new Date(Date.now() - 7 * 24 * 3600 * 1000)
        const monthStart = new Date(Date.now() - 30 * 24 * 3600 * 1000)
        const dau = await db.collection('events').where({ type: 'chat', createdAt: _.gte(todayStart) }).count()
        activeUsersDAU = dau.total // 近似（去重需要更复杂聚合）
        const wau = await db.collection('events').where({ type: 'chat', createdAt: _.gte(weekStart) }).count()
        activeUsersWAU = wau.total
        const mau = await db.collection('events').where({ type: 'chat', createdAt: _.gte(monthStart) }).count()
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

      const where = { type: 'chat' }
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
              userId: l.uid || l.userId || 'anonymous',
              model: l.data?.model || l.model || 'unknown',
              inputPreview: (l.data?.input || l.input || '').slice(0, 80),
              tokensIn: l.data?.tokensIn || l.data?.promptTokens || l.tokensIn || 0,
              tokensOut: l.data?.tokensOut || l.data?.completionTokens || l.tokensOut || 0,
              tokensTotal: l.data?.tokensTotal || l.data?.totalTokens || l.tokensTotal || (l.data?.tokensIn || l.tokensIn || 0) + (l.data?.tokensOut || l.tokensOut || 0),
              hasToolCalls: (l.data?.toolCalls && l.data.toolCalls.length > 0) || (l.toolCalls && l.toolCalls.length > 0) || !!l.hasToolCalls,
              toolCallCount: l.data?.toolCalls ? l.data.toolCalls.length : (l.toolCalls ? l.toolCalls.length : (l.toolCallCount || 0)),
              hasWebSearch: !!l.data?.hasWebSearch || !!l.hasWebSearch,
              durationMs: l.data?.durationMs || l.durationMs || 0,
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
            type: 'admin_recharge',
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

    // ==================== 通用集合查询（白名单） ====================
    case 'listCollection': {
      const ALLOWED_COLLECTIONS = [
        'decision_locks', 'evolution_records', 'behavior_records', 'credit_scores',
        'private_skills', 'byok_bindings', 'token_usage_logs', 'subscriptions',
        'certify_orders', 'sync_logs', 'platform_configs', 'feedback', 'events',
        'orders', 'licenses', 'user_profiles',
      ]
      const { collection, page = 1, pageSize = 20, search = '', searchFields = [], orderBy = 'createdAt', orderDir = 'desc' } = event
      if (!ALLOWED_COLLECTIONS.includes(collection)) {
        return { code: 403, message: `集合 ${collection} 不在白名单` }
      }
      const skip = (page - 1) * pageSize
      try {
        let query = db.collection(collection)
        if (search && Array.isArray(searchFields) && searchFields.length > 0) {
          const orConditions = searchFields.map(field => {
            const c = {}
            c[field] = db.RegExp({ regexp: search, options: 'i' })
            return c
          })
          query = query.where(_.or(orConditions))
        }
        const countRes = await query.count()
        const orderCmd = orderDir === 'asc' ? 'asc' : 'desc'
        let res
        try {
          res = await query.orderBy(orderBy, orderCmd).skip(skip).limit(pageSize).get()
        } catch {
          // orderBy 字段不存在时降级
          res = await query.skip(skip).limit(pageSize).get()
        }
        return {
          code: 0,
          data: { rows: res.data, total: countRes.total, page, pageSize },
        }
      } catch (e) {
        return { code: 0, data: { rows: [], total: 0, page, pageSize } }
      }
    }

    // ==================== 集合数据量统计 ====================
    case 'getCollectionStats': {
      const collections = [
        'user_profiles', 'orders', 'licenses', 'feedback', 'events',
        'decision_locks', 'evolution_records', 'behavior_records', 'credit_scores',
        'private_skills', 'byok_bindings', 'token_usage_logs', 'subscriptions',
        'certify_orders', 'sync_logs', 'platform_configs',
      ]
      const stats = {}
      await Promise.all(collections.map(async (c) => {
        try {
          const r = await db.collection(c).count()
          stats[c] = r.total
        } catch {
          stats[c] = 0
        }
      }))
      return { code: 0, data: stats }
    }

    // ==================== 私有技能审核 ====================
    case 'reviewPrivateSkill': {
      const { skillId, status, note = '' } = event
      if (!skillId || !['approved', 'rejected', 'pending'].includes(status)) {
        return { code: 400, message: '参数错误' }
      }
      try {
        // 先校验技能是否存在
        const existing = await db.collection('private_skills').doc(skillId).get()
        if (!existing.data || existing.data.length === 0) {
          return { code: 404, message: `技能 ${skillId} 不存在` }
        }
        const updateRes = await db.collection('private_skills').doc(skillId).update({
          data: {
            reviewStatus: status,
            reviewNote: note,
            reviewedAt: new Date(),
            reviewedBy: admin.username,
          },
        })
        if (updateRes.stats && updateRes.stats.updated === 0) {
          return { code: 404, message: `技能 ${skillId} 不存在或未变更` }
        }
        return { code: 0, message: status === 'approved' ? '已通过' : status === 'rejected' ? '已拒绝' : '已重置' }
      } catch (e) {
        return { code: 500, message: '审核失败：' + e.message }
      }
    }

    // ==================== 信用分人工调整 ====================
    case 'adjustCreditScore': {
      const { uid, delta, reason } = event
      if (!uid || !delta || !reason) {
        return { code: 400, message: '参数错误' }
      }
      try {
        // 先校验用户是否存在，防止垃圾数据
        const userProfile = await db.collection('user_profiles').where({ openid: uid }).get()
        if (userProfile.data.length === 0) {
          return { code: 404, message: `用户 ${uid} 不存在` }
        }
        await db.collection('behavior_records').add({
          data: {
            uid,
            type: 'digital',
            category: 'admin_adjust',
            action: 'admin_manual_adjust',
            value: delta,
            metadata: { reason, adminUser: admin.username },
            timestamp: new Date(),
            source: 'admin-console',
            createdAt: new Date(),
          }
        })
        const existing = await db.collection('credit_scores').where({ uid }).get()
        if (existing.data.length > 0) {
          await db.collection('credit_scores').where({ uid }).update({
            data: {
              totalScore: _.inc(delta),
              digitalScore: _.inc(delta),
              lastAdjustedAt: new Date(),
              lastAdjustedBy: admin.username,
            }
          })
        } else {
          const level = delta >= 1000 ? 'grandmaster' : delta >= 600 ? 'master' : delta >= 300 ? 'expert' : delta >= 100 ? 'artisan' : 'apprentice'
          await db.collection('credit_scores').add({
            data: {
              uid,
              totalScore: delta,
              digitalScore: delta,
              aiScore: 0,
              level,
              createdAt: new Date(),
            }
          })
        }
        return { code: 0, message: `已调整 ${delta > 0 ? '+' : ''}${delta} 分` }
      } catch (e) {
        return { code: 500, message: '调整失败：' + e.message }
      }
    }

    // ==================== 平台配置管理 ====================
    case 'updatePlatformConfig': {
      const { key, value, note = '' } = event
      if (!key) return { code: 400, message: 'key 必填' }
      try {
        const existing = await db.collection('platform_configs').where({ key }).get()
        if (existing.data.length > 0) {
          await db.collection('platform_configs').where({ key }).update({
            data: { value, note, updatedAt: new Date(), updatedBy: admin.username }
          })
        } else {
          await db.collection('platform_configs').add({
            data: { key, value, note, createdAt: new Date(), updatedAt: new Date(), updatedBy: admin.username }
          })
        }
        return { code: 0, message: '配置已更新' }
      } catch (e) {
        return { code: 500, message: '更新失败：' + e.message }
      }
    }

    case 'deletePlatformConfig': {
      const { key } = event
      if (!key) return { code: 400, message: 'key 必填' }
      try {
        await db.collection('platform_configs').where({ key }).remove()
        return { code: 0, message: '配置已删除' }
      } catch (e) {
        return { code: 500, message: '删除失败：' + e.message }
      }
    }

    // ==================== BYOK 强制解绑 ====================
    case 'unbindByok': {
      const { openid } = event
      if (!openid) return { code: 400, message: 'openid 必填' }
      try {
        await db.collection('byok_bindings').where({ openid }).update({
          data: { active: false, unboundAt: new Date(), unboundBy: admin.username }
        })
        await db.collection('user_profiles').where({ openid }).update({
          data: { byokActive: false, updatedAt: new Date() }
        })
        return { code: 0, message: 'BYOK 已强制解绑' }
      } catch (e) {
        return { code: 500, message: '解绑失败：' + e.message }
      }
    }

    // ==================== 错误工单处理 ====================
    case 'resolveErrorTicket': {
      const { ticketId, resolution, status = 'resolved' } = event
      if (!ticketId) return { code: 400, message: 'ticketId 必填' }
      const collections = ['tickets', 'error_logs', 'error_tickets', 'error_reports', 'support_tickets']
      let updated = false
      for (const c of collections) {
        try {
          const r = await db.collection(c).doc(ticketId).update({
            data: { status, resolution, resolvedAt: new Date(), resolvedBy: admin.username }
          })
          if (r.stats.updated > 0) { updated = true; break }
        } catch { /* 集合或文档不存在 */ }
      }
      if (!updated) return { code: 404, message: '工单未找到' }
      return { code: 0, message: '工单已处理' }
    }

    // ==================== 导出集合 ====================
    case 'exportCollection': {
      const ALLOWED = [
        'decision_locks', 'evolution_records', 'behavior_records', 'credit_scores',
        'private_skills', 'byok_bindings', 'subscriptions', 'certify_orders',
        'sync_logs', 'token_usage_logs', 'feedback', 'events',
      ]
      const { collection, limit = 1000 } = event
      if (!ALLOWED.includes(collection)) {
        return { code: 403, message: `集合 ${collection} 不允许导出` }
      }
      try {
        const res = await db.collection(collection).orderBy('createdAt', 'desc').limit(Math.min(limit, 5000)).get()
        return {
          code: 0,
          data: { rows: res.data, count: res.data.length, exportedAt: new Date().toISOString() }
        }
      } catch (e) {
        return { code: 500, message: '导出失败：' + e.message }
      }
    }

    // ==================== 删除记录（管理员清理错误数据） ====================
    case 'deleteRecord': {
      const DELETE_ALLOWED = [
        'behavior_records', 'credit_scores', 'platform_configs',
        'private_skills', 'sync_logs', 'token_usage_logs', 'feedback', 'events',
      ]
      const { collection, recordId } = event
      if (!collection || !recordId) {
        return { code: 400, message: '缺少 collection 或 recordId' }
      }
      if (!DELETE_ALLOWED.includes(collection)) {
        return { code: 403, message: `集合 ${collection} 不允许删除操作` }
      }
      try {
        const delRes = await db.collection(collection).doc(recordId).remove()
        if (delRes.deleted === 0) {
          return { code: 404, message: `记录 ${recordId} 不存在` }
        }
        return { code: 0, message: '已删除', data: { deleted: delRes.deleted } }
      } catch (e) {
        return { code: 500, message: '删除失败：' + e.message }
      }
    }

    // ==================== 重建用户信用分（通过 callFunction 调用 behaviorBank） ====================
    case 'rebuildCreditScore': {
      const { targetUid } = event
      if (!targetUid) {
        return { code: 400, message: '缺少 targetUid' }
      }
      try {
        // 先校验用户是否存在，防止为不存在的 uid 创建垃圾信用分记录
        const userProfile = await db.collection('user_profiles').where({ openid: targetUid }).get()
        if (userProfile.data.length === 0) {
          return { code: 404, message: `用户 ${targetUid} 不存在` }
        }
        const result = await cloud.callFunction({
          name: 'behaviorBank',
          data: { action: 'recalculateScore', adminToken: 'metago-admin-2026', targetUid },
        })
        const resp = result.result || {}
        if (resp.code === 0) {
          return { code: 0, message: `用户 ${targetUid} 信用分已重建`, data: resp.data }
        }
        return { code: resp.code || 500, message: resp.message || '重建失败' }
      } catch (e) {
        return { code: 500, message: '重建失败：' + e.message }
      }
    }

    default:
      return { code: 400, message: '未知操作' }
  }
}
