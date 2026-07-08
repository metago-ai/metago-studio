const cloud = require('wx-server-sdk')

cloud.init({ env: 'metago-d6gfw1e4rf2a5bcad' })
const db = cloud.database()
const _ = db.command

/**
 * support 云函数 — MetaGO Studio 工单系统
 *
 * action：
 * - createTicket:    创建工单（需登录）
 * - listTickets:     查询当前用户工单（支持 status 筛选 + 分页）
 * - replyTicket:     用户追加回复
 * - closeTicket:     关闭工单
 * - adminReply:      管理员回复（需 adminToken）
 * - adminListTickets:管理员查看全部工单（需 adminToken）
 */
const ADMIN_TOKEN = 'metago-admin-2026'
const VALID_CATEGORIES = ['bug', 'feature', 'billing', 'usage']
const VALID_PRIORITIES = ['normal', 'urgent']

exports.main = async (event, context) => {
  // HTTP 触发兼容：解析 HTTP body
  if (event.httpMethod && event.body) {
    try {
      const parsed = JSON.parse(event.body)
      event = { ...event, ...parsed }
    } catch { /* body 不是 JSON */ }
  }

  // 确保集合存在
  try { await db.createCollection('tickets') } catch { /* 已存在 */ }

  // 身份识别（兼容 Web SDK 的 UID + 前端注入的 _clientUid）
  const wxContext = cloud.getWXContext()
  const openid = event._clientUid
    || event.uid
    || event.openid
    || event.userInfo?.uid
    || event.userInfo?.openId
    || event.userInfo?.openid
    || wxContext.OPENID
    || wxContext.UID
    || wxContext.APPID

  const action = event.action
  const isAdmin = event.adminToken === ADMIN_TOKEN

  try {
    switch (action) {
      // ========== 创建工单 ==========
      case 'createTicket': {
        if (!openid) return { code: 401, message: '未登录' }

        const subject = (event.subject || '').trim()
        const body = (event.body || '').trim()
        if (!subject) return { code: 400, message: 'subject 不能为空' }
        if (!body) return { code: 400, message: 'body 不能为空' }

        const priority = VALID_PRIORITIES.includes(event.priority) ? event.priority : 'normal'
        const category = VALID_CATEGORIES.includes(event.category) ? event.category : 'usage'

        const ticket = {
          openid,
          uid: openid,
          subject,
          body,
          priority,
          category,
          status: 'open',
          replies: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        const res = await db.collection('tickets').add({ data: ticket })
        return { code: 0, message: '工单已创建', data: { _id: res._id, ...ticket } }
      }

      // ========== 查询当前用户工单 ==========
      case 'listTickets': {
        if (!openid) return { code: 401, message: '未登录' }

        const status = event.status
        const page = Math.max(1, parseInt(event.page, 10) || 1)
        const pageSize = Math.min(100, Math.max(1, parseInt(event.pageSize, 10) || 20))

        const query = { openid }
        if (status) query.status = status

        const countRes = await db.collection('tickets').where(query).count()
        const total = countRes.total || 0

        const res = await db.collection('tickets')
          .where(query)
          .orderBy('createdAt', 'desc')
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .get()

        return {
          code: 0,
          data: res.data,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
        }
      }

      // ========== 用户追加回复 ==========
      case 'replyTicket': {
        if (!openid) return { code: 401, message: '未登录' }
        const { ticketId, content } = event
        if (!ticketId) return { code: 400, message: 'ticketId 不能为空' }
        const text = (content || '').trim()
        if (!text) return { code: 400, message: 'content 不能为空' }

        // 仅允许工单所有者回复
        const exist = await db.collection('tickets').where({ _id: ticketId, openid }).get()
        if (!exist.data || exist.data.length === 0) {
          return { code: 404, message: '工单不存在或无权限' }
        }
        if (exist.data[0].status === 'closed') {
          return { code: 400, message: '工单已关闭，无法回复' }
        }

        const reply = {
          from: 'user',
          uid: openid,
          content: text,
          createdAt: new Date(),
        }

        await db.collection('tickets').doc(ticketId).update({
          data: {
            replies: _.push(reply),
            status: 'open',
            updatedAt: new Date(),
          }
        })

        return { code: 0, message: '回复已提交', data: reply }
      }

      // ========== 关闭工单 ==========
      case 'closeTicket': {
        if (!openid) return { code: 401, message: '未登录' }
        const { ticketId } = event
        if (!ticketId) return { code: 400, message: 'ticketId 不能为空' }

        const exist = await db.collection('tickets').where({ _id: ticketId, openid }).get()
        if (!exist.data || exist.data.length === 0) {
          return { code: 404, message: '工单不存在或无权限' }
        }

        await db.collection('tickets').doc(ticketId).update({
          data: {
            status: 'closed',
            closedAt: new Date(),
            updatedAt: new Date(),
          }
        })

        return { code: 0, message: '工单已关闭' }
      }

      // ========== 管理员回复 ==========
      case 'adminReply': {
        if (!isAdmin) return { code: 403, message: '无管理员权限' }
        const { ticketId, content } = event
        if (!ticketId) return { code: 400, message: 'ticketId 不能为空' }
        const text = (content || '').trim()
        if (!text) return { code: 400, message: 'content 不能为空' }

        const exist = await db.collection('tickets').doc(ticketId).get()
        if (!exist.data) {
          return { code: 404, message: '工单不存在' }
        }

        const reply = {
          from: 'admin',
          uid: 'admin',
          content: text,
          createdAt: new Date(),
        }

        await db.collection('tickets').doc(ticketId).update({
          data: {
            replies: _.push(reply),
            status: 'answered',
            updatedAt: new Date(),
          }
        })

        return { code: 0, message: '管理员回复已提交', data: reply }
      }

      // ========== 前端错误批量上报（errorMonitor.ts）==========
      case 'reportErrors': {
        const errors = Array.isArray(event.errors) ? event.errors : []
        // 确保 error_logs 集合存在
        try { await db.createCollection('error_logs') } catch { /* 已存在 */ }
        for (const err of errors) {
          await db.collection('error_logs').add({
            data: {
              ...err,
              openid: openid || '',
              createdAt: new Date(),
            },
          })
        }
        return { code: 0, data: { count: errors.length } }
      }

      // ========== 管理员查看全部工单 ==========
      case 'adminListTickets': {
        if (!isAdmin) return { code: 403, message: '无管理员权限' }

        const status = event.status
        const category = event.category
        const page = Math.max(1, parseInt(event.page, 10) || 1)
        const pageSize = Math.min(100, Math.max(1, parseInt(event.pageSize, 10) || 20))

        const query = {}
        if (status) query.status = status
        if (category) query.category = category

        const countRes = await db.collection('tickets').where(query).count()
        const total = countRes.total || 0

        const res = await db.collection('tickets')
          .where(query)
          .orderBy('updatedAt', 'desc')
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .get()

        return {
          code: 0,
          data: res.data,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
        }
      }

      default:
        return { code: 404, message: `未知 action: ${action}` }
    }
  } catch (err) {
    console.error('support 云函数异常:', err)
    return { code: 500, message: err.message || '服务器异常' }
  }
}
