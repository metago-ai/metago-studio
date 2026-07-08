const cloud = require('wx-server-sdk')

cloud.init({ env: 'metago-d6gfw1e4rf2a5bcad' })
const db = cloud.database()
const _ = db.command

/**
 * behaviorBank 云函数 — 元构行为银行 MVP
 *
 * 职责：
 *  A. 数字行为记录引擎 —— 记录用户数字贡献（代码/文档/社区/技能/Bug/模板）
 *  B. AI行为记录引擎   —— 记录 AI 行为（决策锁/元进化/合规/溯源/技能调用/输出完整性）
 *  C. 信用分计算       —— 基于行为记录实时计算 5 级信用分
 *  D. 开放 API 预留    —— 排行榜/等级元信息/外部可查询的标准化接口
 *
 * 集合：
 *  - behavior_records: 行为记录流水
 *  - credit_scores:    信用分快照（按 uid 唯一）
 *
 * 信用等级（5 级）：
 *  - apprentice   元构学徒      0-99
 *  - artisan      元构匠人      100-299
 *  - expert       元构专家      300-599
 *  - master       元构大师      600-999
 *  - grandmaster  元构宗师      1000+
 */

// ============ 信用等级定义（与前端 creditLevels.ts 保持一致） ============
const CREDIT_LEVELS = [
  { id: 'apprentice',  name: '元构学徒',   minScore: 0,    maxScore: 99 },
  { id: 'artisan',     name: '元构匠人',   minScore: 100,  maxScore: 299 },
  { id: 'expert',      name: '元构专家',   minScore: 300,  maxScore: 599 },
  { id: 'master',      name: '元构大师',   minScore: 600,  maxScore: 999 },
  { id: 'grandmaster', name: '元构宗师',   minScore: 1000, maxScore: Number.MAX_SAFE_INTEGER },
]

// ============ 行为价值表（category -> 分值） ============
// 负数表示扣分。修改时请同步前端 creditLevels 文档。
const BEHAVIOR_VALUES = {
  // digital 类
  code_contribution: 5,
  doc_contribution: 3,
  community_help: 2,
  skill_creation: 10,
  bug_report: 3,
  template_run: 1,
  // ai 类
  decision_lock_pass: 1,
  decision_lock_block: -2,   // 阻断扣分（负向反馈）
  evolution_iteration: 2,
  compliance_check: 2,
  provenance_trace: 1,
  skill_call: 1,
  output_integrity: 1,
}

// digital 类别集合
const DIGITAL_CATEGORIES = [
  'code_contribution', 'doc_contribution', 'community_help',
  'skill_creation', 'bug_report', 'template_run',
]
// ai 类别集合
const AI_CATEGORIES = [
  'decision_lock_pass', 'decision_lock_block', 'evolution_iteration',
  'compliance_check', 'provenance_trace', 'skill_call', 'output_integrity',
]

exports.main = async (event, context) => {
  // HTTP 触发兼容
  if (event.httpMethod && event.body) {
    try {
      const parsed = JSON.parse(event.body)
      event = { ...event, ...parsed }
    } catch { /* body 不是 JSON */ }
  }

  // 确保集合存在
  try { await db.createCollection('behavior_records') } catch { /* 已存在 */ }
  try { await db.createCollection('credit_scores') } catch { /* 已存在 */ }

  // 身份识别（与 events 云函数保持一致）
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
  const adminToken = event.adminToken
  const isAdmin = adminToken === 'metago-admin-2026'

  // 写操作必须登录（管理员除外）
  const writeActions = ['recordBehavior', 'recordBatch', 'recalculateScore']
  if (writeActions.includes(action) && !openid && !isAdmin) {
    return { code: 401, message: '未登录' }
  }

  // 确定数据归属的 uid
  const targetUid = openid || event.targetUid || ''

  try {
    switch (action) {

      // ========== A/B. 记录单条行为 ==========
      case 'recordBehavior': {
        const { category, action: actionName, metadata = {}, source = 'web-studio', timestamp } = event
        if (!category) return { code: 400, message: 'category 必填' }
        if (!BEHAVIOR_VALUES.hasOwnProperty(category)) {
          return { code: 400, message: `未知行为类别: ${category}` }
        }

        const value = BEHAVIOR_VALUES[category]
        const type = DIGITAL_CATEGORIES.includes(category) ? 'digital' : 'ai'
        const ts = timestamp ? new Date(timestamp) : new Date()

        const record = {
          uid: targetUid,
          type,
          category,
          action: actionName || category,
          value,
          metadata,
          timestamp: ts,
          source,
          createdAt: new Date(),
        }

        const addRes = await db.collection('behavior_records').add({ data: record })

        // 异步更新信用分快照（不阻塞返回）
        await updateCreditScore(targetUid)

        return {
          code: 0,
          message: '行为已记录',
          data: {
            recordId: addRes._id,
            value,
            type,
            category,
          },
        }
      }

      // ========== 批量记录行为（脚本同步用） ==========
      case 'recordBatch': {
        const behaviors = event.behaviors || []
        if (!Array.isArray(behaviors) || behaviors.length === 0) {
          return { code: 400, message: 'behaviors 数组为空' }
        }
        const batchSize = Math.min(behaviors.length, 50)
        const inserted = []
        for (const b of behaviors.slice(0, batchSize)) {
          if (!BEHAVIOR_VALUES.hasOwnProperty(b.category)) continue
          const value = BEHAVIOR_VALUES[b.category]
          const type = DIGITAL_CATEGORIES.includes(b.category) ? 'digital' : 'ai'
          const record = {
            uid: targetUid,
            type,
            category: b.category,
            action: b.action || b.category,
            value,
            metadata: b.metadata || {},
            timestamp: b.timestamp ? new Date(b.timestamp) : new Date(),
            source: b.source || event.source || 'batch-sync',
            createdAt: new Date(),
          }
          const r = await db.collection('behavior_records').add({ data: record })
          inserted.push(r._id)
        }
        if (inserted.length > 0) {
          await updateCreditScore(targetUid)
        }
        return { code: 0, message: `已记录 ${inserted.length} 条行为`, data: { inserted } }
      }

      // ========== C. 获取信用分快照 ==========
      case 'getCreditScore': {
        const score = await fetchOrComputeScore(targetUid)
        return { code: 0, data: score }
      }

      // ========== 查询行为记录（分页+过滤） ==========
      case 'getBehaviorRecords': {
        const {
          type = '',
          category = '',
          limit = 50,
          offset = 0,
          startTime,
          endTime,
        } = event
        let query = { uid: targetUid }
        if (type) query.type = type
        if (category) query.category = category
        if (startTime || endTime) {
          query.timestamp = {}
          if (startTime) query.timestamp = _.gte(new Date(startTime))
          if (endTime) query.timestamp = _.lte(new Date(endTime))
        }
        const lim = Math.min(Math.max(limit, 1), 200)
        const off = Math.max(offset, 0)
        const res = await db.collection('behavior_records')
          .where(query)
          .orderBy('timestamp', 'desc')
          .skip(off)
          .limit(lim)
          .get()
        return { code: 0, data: res.data }
      }

      // ========== 信用分历史（按日聚合） ==========
      case 'getCreditHistory': {
        const days = Math.min(Math.max(event.days || 30, 1), 365)
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        const res = await db.collection('behavior_records')
          .where({ uid: targetUid, timestamp: _.gte(since) })
          .orderBy('timestamp', 'asc')
          .limit(1000)
          .get()

        // 按日聚合
        const dailyMap = {}
        let runningTotal = 0
        // 先获取当前总分的起点（之前的累计分）
        const beforeScore = await db.collection('behavior_records')
          .where({ uid: targetUid, timestamp: _.lt(since) })
          .limit(1000)
          .get()
        const beforeTotal = beforeScore.data.reduce((s, r) => s + (r.value || 0), 0)
        runningTotal = beforeTotal

        for (const r of res.data) {
          const d = new Date(r.timestamp)
          const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          if (!dailyMap[dateKey]) {
            dailyMap[dateKey] = { date: dateKey, scoreDelta: 0, totalScore: 0, recordsCount: 0 }
          }
          dailyMap[dateKey].scoreDelta += (r.value || 0)
          dailyMap[dateKey].recordsCount += 1
        }
        const history = Object.values(dailyMap).map(d => {
          runningTotal += d.scoreDelta
          return { ...d, totalScore: runningTotal }
        })
        return { code: 0, data: history }
      }

      // ========== D. 排行榜（开放 API 预留） ==========
      case 'getLeaderboard': {
        const limit = Math.min(Math.max(event.limit || 20, 1), 100)
        // 直接从 credit_scores 集合读取已计算的快照
        try {
          const res = await db.collection('credit_scores')
            .orderBy('totalScore', 'desc')
            .limit(limit)
            .get()
          const leaderboard = res.data.map((entry, idx) => ({
            rank: idx + 1,
            uid: entry.uid,
            displayName: entry.displayName || `元构用户${entry.uid.slice(-6)}`,
            totalScore: entry.totalScore || 0,
            level: entry.level || 'apprentice',
            levelName: entry.levelName || '元构学徒',
            recordsCount: entry.stats?.totalRecords || 0,
          }))
          return { code: 0, data: leaderboard }
        } catch {
          // 集合为空或不存在
          return { code: 0, data: [] }
        }
      }

      // ========== 等级元信息（公开接口，未登录可调用） ==========
      case 'getLevelInfo': {
        return {
          code: 0,
          data: {
            levels: CREDIT_LEVELS,
            behaviorValues: BEHAVIOR_VALUES,
            digitalCategories: DIGITAL_CATEGORIES,
            aiCategories: AI_CATEGORIES,
          },
        }
      }

      // ========== 重算信用分（管理员） ==========
      case 'recalculateScore': {
        if (!isAdmin) return { code: 403, message: '需要管理员权限' }
        const uid = event.targetUid
        if (!uid) return { code: 400, message: 'targetUid 必填' }
        const score = await updateCreditScore(uid, /*force*/ true)
        return { code: 0, message: '信用分已重算', data: score }
      }

      default:
        return { code: 404, message: `未知 action: ${action}` }
    }
  } catch (err) {
    console.error('behaviorBank 云函数异常:', err)
    return { code: 500, message: err.message || '服务器异常' }
  }

  // ============ 辅助函数 ============

  /**
   * 获取或计算用户信用分快照
   * 优先读 credit_scores 集合；不存在则计算后写入
   */
  async function fetchOrComputeScore(uid) {
    if (!uid) return buildEmptyScore(uid)

    try {
      const existing = await db.collection('credit_scores').where({ uid }).limit(1).get()
      if (existing.data && existing.data.length > 0) {
        const doc = existing.data[0]
        return enrichScore(doc)
      }
    } catch { /* 集合不存在或查询失败，继续重算 */ }

    // 不存在，重算并写入
    return await updateCreditScore(uid, true)
  }

  /**
   * 重算信用分并写入 credit_scores 集合
   * @param {string} uid
   * @param {boolean} force - 强制重算（即使已存在）
   * @returns {Promise<object>} 信用分对象
   */
  async function updateCreditScore(uid, force = false) {
    if (!uid) return buildEmptyScore('')

    // 检查是否已存在（非强制场景下可跳过重算，仅在 score 落后时更新）
    if (!force) {
      try {
        const existing = await db.collection('credit_scores').where({ uid }).limit(1).get()
        if (existing.data && existing.data.length > 0) {
          // 拉取最新行为记录，增量更新（简化：每次全量重算，行为量级可控）
        }
      } catch { /* ignore */ }
    }

    // 拉取所有行为记录（最多 1000 条，足以覆盖 MVP 阶段）
    const allRecords = await db.collection('behavior_records')
      .where({ uid })
      .orderBy('timestamp', 'asc')
      .limit(1000)
      .get()

    const records = allRecords.data || []
    let totalScore = 0
    let digitalScore = 0
    let aiScore = 0
    const stats = {
      totalRecords: records.length,
      digitalRecords: 0,
      aiRecords: 0,
      decisionLockPasses: 0,
      decisionLockBlocks: 0,
      evolutionIterations: 0,
      complianceChecks: 0,
      provenanceTraces: 0,
      skillCalls: 0,
      codeContributions: 0,
      docContributions: 0,
      communityHelps: 0,
      skillCreations: 0,
      bugReports: 0,
      templateRuns: 0,
    }

    for (const r of records) {
      const v = r.value || 0
      totalScore += v
      if (r.type === 'digital') {
        digitalScore += v
        stats.digitalRecords++
      } else {
        aiScore += v
        stats.aiRecords++
      }
      // 按 category 累计
      switch (r.category) {
        case 'decision_lock_pass':  stats.decisionLockPasses++; break
        case 'decision_lock_block': stats.decisionLockBlocks++; break
        case 'evolution_iteration': stats.evolutionIterations++; break
        case 'compliance_check':    stats.complianceChecks++; break
        case 'provenance_trace':    stats.provenanceTraces++; break
        case 'skill_call':          stats.skillCalls++; break
        case 'code_contribution':   stats.codeContributions++; break
        case 'doc_contribution':    stats.docContributions++; break
        case 'community_help':      stats.communityHelps++; break
        case 'skill_creation':      stats.skillCreations++; break
        case 'bug_report':          stats.bugReports++; break
        case 'template_run':        stats.templateRuns++; break
      }
    }

    // 防止负分
    if (totalScore < 0) totalScore = 0
    if (digitalScore < 0) digitalScore = 0
    if (aiScore < 0) aiScore = 0

    const level = getLevelByScore(totalScore)
    const nextLevel = getNextLevel(level.id)

    const score = {
      uid,
      totalScore,
      digitalScore,
      aiScore,
      level: level.id,
      levelName: level.name,
      nextLevelName: nextLevel ? nextLevel.name : null,
      nextLevelMinScore: nextLevel ? nextLevel.minScore : null,
      scoreToNextLevel: nextLevel ? Math.max(0, nextLevel.minScore - totalScore) : null,
      progressPercent: calcProgressPercent(totalScore, level),
      stats,
      updatedAt: new Date(),
    }

    // 写入 credit_scores 集合（upsert）
    try {
      const existing = await db.collection('credit_scores').where({ uid }).limit(1).get()
      if (existing.data && existing.data.length > 0) {
        await db.collection('credit_scores').where({ uid }).update({ data: score })
      } else {
        await db.collection('credit_scores').add({ data: score })
      }
    } catch (e) {
      console.log('updateCreditScore write failed:', e.message)
    }

    return enrichScore(score)
  }

  function buildEmptyScore(uid) {
    return {
      uid: uid || '',
      totalScore: 0,
      digitalScore: 0,
      aiScore: 0,
      level: 'apprentice',
      levelName: '元构学徒',
      nextLevelName: '元构匠人',
      nextLevelMinScore: 100,
      scoreToNextLevel: 100,
      progressPercent: 0,
      stats: {
        totalRecords: 0, digitalRecords: 0, aiRecords: 0,
        decisionLockPasses: 0, decisionLockBlocks: 0,
        evolutionIterations: 0, complianceChecks: 0,
        provenanceTraces: 0, skillCalls: 0,
        codeContributions: 0, docContributions: 0,
        communityHelps: 0, skillCreations: 0,
        bugReports: 0, templateRuns: 0,
      },
      updatedAt: new Date(),
    }
  }

  function getLevelByScore(score) {
    for (const level of CREDIT_LEVELS) {
      if (score >= level.minScore && score <= level.maxScore) return level
    }
    return CREDIT_LEVELS[0]
  }

  function getNextLevel(currentId) {
    const idx = CREDIT_LEVELS.findIndex(l => l.id === currentId)
    if (idx < 0 || idx === CREDIT_LEVELS.length - 1) return null
    return CREDIT_LEVELS[idx + 1]
  }

  function calcProgressPercent(score, level) {
    if (level.id === 'grandmaster') return 100
    const span = level.maxScore - level.minScore + 1
    const progress = (score - level.minScore) / span
    return Math.max(0, Math.min(100, Math.round(progress * 100)))
  }

  /** 把数据库返回的对象转换成 API 友好的格式（日期转字符串） */
  function enrichScore(doc) {
    const enriched = { ...doc }
    if (enriched.updatedAt instanceof Date) {
      enriched.updatedAt = enriched.updatedAt.toISOString()
    } else if (enriched.updatedAt) {
      enriched.updatedAt = new Date(enriched.updatedAt).toISOString()
    }
    // 兜底字段
    if (!enriched.nextLevelName) enriched.nextLevelName = null
    if (!enriched.nextLevelMinScore) enriched.nextLevelMinScore = null
    if (!enriched.scoreToNextLevel) enriched.scoreToNextLevel = null
    if (typeof enriched.progressPercent !== 'number') enriched.progressPercent = 0
    return enriched
  }
}
