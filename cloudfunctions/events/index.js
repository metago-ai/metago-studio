const cloud = require('wx-server-sdk')

cloud.init({ env: 'metago-d6gfw1e4rf2a5bcad' })
const db = cloud.database()
const _ = db.command

/**
 * events 云函数 — MetaGO Studio 统一数据上报接收器
 *
 * 数据来源：
 * 1. MCP Server 的 report_event 工具（本地 AI 工具自动上报）
 * 2. metago-sync.ps1 本地扫描脚本（手动/定时上报）
 * 3. Studio 前端（模板运行、手动操作等）
 *
 * 事件类型：
 * - decision_lock: 决策锁校验事件
 * - evolution: 进化事件
 * - skill_usage: 技能调用事件
 * - activity: 通用活动事件
 */
exports.main = async (event, context) => {
  // HTTP 触发兼容：解析 HTTP body
  if (event.httpMethod && event.body) {
    try {
      const parsed = JSON.parse(event.body)
      event = { ...event, ...parsed }
    } catch { /* body 不是 JSON */ }
  }

  // 确保集合存在
  try { await db.createCollection('events') } catch { /* 已存在 */ }

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

  // allowAnonymous: submitEvent 允许匿名上报（MCP Server 用 adminToken 认证）
  const action = event.action
  const adminToken = event.adminToken
  const isAdmin = adminToken === 'metago-admin-2026'

  // 非查询类操作必须登录（除非是 MCP Server 通过 adminToken 上报）
  const writeActions = ['reportEvent', 'reportBatch', 'reportDecisionLock', 'reportEvolution', 'reportSkillUsage']
  if (writeActions.includes(action) && !openid && !isAdmin) {
    return { code: 401, message: '未登录' }
  }

  // 确定数据归属的 uid（MCP Server 上报时用 adminToken + targetUid）
  const targetUid = openid || event.targetUid || ''

  try {
    switch (action) {
      // ========== 单条事件上报 ==========
      case 'reportEvent':
      case 'reportDecisionLock':
      case 'reportEvolution':
      case 'reportSkillUsage': {
        const evtType = event.eventType || action.replace('report', '').toLowerCase()
        const evt = {
          type: evtType,
          uid: targetUid,
          platform: event.platform || 'unknown', // trae/cursor/codex/claude-code/web-studio
          timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
          data: event.data || {},
          createdAt: new Date(),
        }

        await db.collection('events').add({ data: evt })

        // 决策锁事件：同步更新 user_profiles 的 lockStats 缓存
        if (evtType === 'decision_lock') {
          await updateLockStatsCache(targetUid, evt.data)
        }
        // 进化事件：同步写入 evolution_records
        if (evtType === 'evolution' && evt.data.trigger) {
          await syncEvolutionRecord(targetUid, evt.data)
        }

        return { code: 0, message: '事件已记录' }
      }

      // ========== 批量上报（本地脚本同步用） ==========
      case 'reportBatch': {
        const events = event.events || []
        if (!Array.isArray(events) || events.length === 0) {
          return { code: 400, message: 'events 数组为空' }
        }
        // 批量插入（每次最多 20 条）
        const batchSize = Math.min(events.length, 20)
        const batch = events.slice(0, batchSize).map(e => ({
          type: e.type || 'activity',
          uid: targetUid,
          platform: e.platform || event.platform || 'unknown',
          timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
          data: e.data || {},
          createdAt: new Date(),
        }))
        // 使用批量插入
        for (const item of batch) {
          await db.collection('events').add({ data: item })
        }
        return { code: 0, message: `已记录 ${batch.length} 条事件` }
      }

      // ========== 查询事件 ==========
      case 'getEvents': {
        const { type = '', platform = '', limit = 50, startTime, endTime } = event
        let query = { uid: targetUid }
        if (type) query.type = type
        if (platform) query.platform = platform
        if (startTime || endTime) {
          query.timestamp = {}
          if (startTime) query.timestamp = _.gte(new Date(startTime))
          if (endTime) query.timestamp = _.lte(new Date(endTime))
        }
        const res = await db.collection('events')
          .where(query)
          .orderBy('timestamp', 'desc')
          .limit(Math.min(limit, 200))
          .get()
        return { code: 0, data: res.data }
      }

      // ========== 统计聚合（度量页面用） ==========
      case 'getMetrics': {
        const days = event.days || 30
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        // adminToken 模式：查询所有用户数据（管理员看板用）；否则按 uid 过滤
        const uidFilter = isAdmin ? {} : { uid: targetUid }

        // 决策锁统计（adminToken 模式查询所有用户，否则按 uid 过滤）
        const dlEvents = await db.collection('events')
          .where({ ...uidFilter, type: 'decision_lock', timestamp: _.gte(since) })
          .limit(500)
          .get()
        const dlPassed = dlEvents.data.filter(e => e.data?.passed).length
        const dlBlocked = dlEvents.data.filter(e => !e.data?.passed).length
        const dlTotal = dlEvents.data.length

        // 进化统计
        const evoEvents = await db.collection('events')
          .where({ ...uidFilter, type: 'evolution', timestamp: _.gte(since) })
          .limit(500)
          .get()
        const evoSuccess = evoEvents.data.filter(e => e.data?.verified).length

        // 技能调用统计
        const skillEvents = await db.collection('events')
          .where({ ...uidFilter, type: 'skill_usage', timestamp: _.gte(since) })
          .limit(500)
          .get()
        const skillSet = new Set(skillEvents.data.map(e => e.data?.skillId).filter(Boolean))

        // 决策锁关卡阻断分布（前置：shieldDimensions.reliability 需要）
        const stageBlocks = {}
        dlEvents.data.forEach(e => {
          if (e.data?.stages) {
            e.data.stages.forEach(s => {
              if (!s.ok) {
                stageBlocks[s.name] = (stageBlocks[s.name] || 0) + 1
              }
            })
          }
        })

        // 维度-技能映射（8维护盾各维度包含的技能）
        const DIMENSION_SKILLS = {
          traceability: ['metago_data_provenance', 'metago_problem_trace', 'metago_fact_check'],
          objectivity: ['metago_critique', 'metago_objectivity', 'metago_emotion'],
          compliance: ['metago_compliance', 'metago_value_align', 'metago_security_audit'],
          integrity: ['metago_output_integrity', 'metago_delivery_gate', 'metago_discipline', 'metago_self_check'],
          lifeform: ['metago_activate', 'metago_meta_evolve', 'metago_meta_create', 'metago_memory_manage', 'metago_frequency_adapt'],
        }

        // 按技能统计调用次数、成功次数、最后调用时间
        const skillStats = {}
        skillEvents.data.forEach(e => {
          const sid = e.data?.skillId
          if (!sid) return
          if (!skillStats[sid]) {
            skillStats[sid] = { count: 0, successCount: 0, lastCalled: null }
          }
          skillStats[sid].count++
          if (e.data?.success !== false) skillStats[sid].successCount++
          const ts = e.timestamp ? new Date(e.timestamp) : null
          if (ts && (!skillStats[sid].lastCalled || ts > new Date(skillStats[sid].lastCalled))) {
            skillStats[sid].lastCalled = e.timestamp
          }
        })

        // 时间排序辅助
        const sortByTimeDesc = (arr) => arr.slice().sort((a, b) => {
          const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0
          const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0
          return tb - ta
        })

        // 按维度聚合详细数据（P1 深度分析面板数据源）
        function buildDimension(skillIds) {
          const dimEvents = skillEvents.data.filter(e => skillIds.includes(e.data?.skillId))
          const skills = {}
          skillIds.forEach(sid => {
            if (skillStats[sid]) skills[sid] = skillStats[sid]
          })
          const recentCalls = sortByTimeDesc(dimEvents).slice(0, 5).map(e => ({
            skillId: e.data?.skillId,
            timestamp: e.timestamp,
            success: e.data?.success !== false,
            duration: e.data?.duration || 0,
          }))
          const successCount = dimEvents.filter(e => e.data?.success !== false).length
          return {
            callCount: dimEvents.length,
            successCount,
            successRate: dimEvents.length > 0 ? Math.round((successCount / dimEvents.length) * 100) : 0,
            skills,
            recentCalls,
          }
        }

        // 8维护盾聚合（含详细数据，P1 面板数据源）
        const shieldDimensions = {
          reliability: {
            callCount: dlTotal,
            passRate: dlTotal > 0 ? Math.round((dlPassed / dlTotal) * 100) : 0,
            blocked: dlBlocked,
            stageBlocks,
            recentCalls: sortByTimeDesc(dlEvents.data).slice(0, 5).map(e => ({
              passed: e.data?.passed,
              stages: e.data?.stages,
              timestamp: e.timestamp,
            })),
          },
          evolution: {
            callCount: evoEvents.data.length,
            successRate: evoEvents.data.length > 0
              ? Math.round((evoSuccess / evoEvents.data.length) * 100) : 0,
            maxDepth: Math.max(0, ...evoEvents.data.map(e => e.data?.depth || 0)),
            recentCalls: sortByTimeDesc(evoEvents.data).slice(0, 5).map(e => ({
              trigger: e.data?.trigger,
              boundary: e.data?.boundary,
              verified: e.data?.verified,
              depth: e.data?.depth || 1,
              timestamp: e.timestamp,
            })),
          },
          traceability: buildDimension(DIMENSION_SKILLS.traceability),
          objectivity: buildDimension(DIMENSION_SKILLS.objectivity),
          compliance: buildDimension(DIMENSION_SKILLS.compliance),
          integrity: buildDimension(DIMENSION_SKILLS.integrity),
          lifeform: buildDimension(DIMENSION_SKILLS.lifeform),
        }

        // 平台统计
        const platformEvents = await db.collection('events')
          .where({ ...uidFilter, timestamp: _.gte(since) })
          .limit(1000)
          .get()
        const platformMap = {}
        platformEvents.data.forEach(e => {
          const p = e.platform || 'unknown'
          platformMap[p] = (platformMap[p] || 0) + 1
        })

        return {
          code: 0,
          data: {
            decisionLock: {
              total: dlTotal,
              passed: dlPassed,
              blocked: dlBlocked,
              passRate: dlTotal > 0 ? Math.round((dlPassed / dlTotal) * 100) : 0,
              stageBlocks,
            },
            evolution: {
              total: evoEvents.data.length,
              successRate: evoEvents.data.length > 0
                ? Math.round((evoSuccess / evoEvents.data.length) * 100) : 0,
              maxDepth: Math.max(0, ...evoEvents.data.map(e => e.data?.depth || 0)),
              avgDuration: evoEvents.data.length > 0
                ? Math.round(evoEvents.data.reduce((s, e) => s + (e.data?.durationMs || 0), 0) / evoEvents.data.length) : 0,
            },
            skills: {
              uniqueUsed: skillSet.size,
              totalCalls: skillEvents.data.length,
              coverage: Math.round((skillSet.size / 39) * 100),
            },
            shieldDimensions,
            platforms: platformMap,
            recentEvents: platformEvents.data.slice(0, 10),
          },
        }
      }

      default:
        return { code: 404, message: `未知 action: ${action}` }
    }
  } catch (err) {
    console.error('events 云函数异常:', err)
    return { code: 500, message: err.message || '服务器异常' }
  }

  // ========== 辅助函数 ==========

  async function updateLockStatsCache(uid, lockData) {
    try {
      const existing = await db.collection('user_profiles').where({ openid: uid }).get()
      const profile = existing.data?.[0]
      if (!profile) return

      const stats = profile.lockStatsCache || { total: 0, passed: 0, blocked: 0 }
      stats.total++
      if (lockData.passed) stats.passed++
      else stats.blocked++
      stats.updatedAt = new Date()

      await db.collection('user_profiles').where({ openid: uid }).update({
        data: { lockStatsCache: stats }
      })
    } catch (e) {
      // 非关键路径，忽略错误
      console.log('updateLockStatsCache skipped:', e.message)
    }
  }

  async function syncEvolutionRecord(uid, evoData) {
    try {
      const now = new Date()
      await db.collection('evolution_records').add({
        data: {
          _openid: uid,
          uid,
          trigger: evoData.trigger || '',
          boundary: evoData.boundary || '',
          gap: evoData.gap || '',
          generated: evoData.generated || '',
          verified: evoData.verified || false,
          recursed: evoData.recursed || false,
          depth: evoData.depth || 1,
          durationMs: evoData.durationMs || 0,
          source: 'auto_report',
          created_at: now.toISOString(),
          createdAt: now,
        }
      })
    } catch (e) {
      console.log('syncEvolutionRecord skipped:', e.message)
    }
  }
}
