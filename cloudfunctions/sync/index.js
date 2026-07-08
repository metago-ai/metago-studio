/**
 * MetaGO Studio - Sync Cloud Function
 * 数据同步 + 反馈提交 + 用户档案同步
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: 'metago-d6gfw1e4rf2a5bcad' })

exports.main = async (event) => {
  const { action } = event

  // 获取用户身份（兼容 Web SDK、小程序、HTTP 触发）
  // Web SDK 端 OPENID 可能为空，身份在 UID 字段；前端 callFunction 注入 _clientUid 作为终极 fallback
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

  if (!openid) return { code: 401, message: '未登录', debug: { wxContextKeys: Object.keys(wxContext || {}) } }

  const db = cloud.database()
  const _ = db.command

  switch (action) {
    // ========== 用户档案同步 ==========
    case 'syncProfile': {
      const { email, phone, displayName, loginType } = event
      // 查询是否已有记录
      const existing = await db.collection('user_profiles').where({ openid }).get()
      const now = new Date()
      if (existing.data && existing.data.length > 0) {
        // 更新已有记录
        const updateData = { lastActiveAt: now, updatedAt: now }
        if (email) updateData.email = email
        if (phone) updateData.phone = phone
        if (displayName) updateData.displayName = displayName
        if (loginType) updateData.loginType = loginType
        await db.collection('user_profiles').where({ openid }).update({ data: updateData })
        return { code: 0, data: { ...existing.data[0], ...updateData } }
      } else {
        // 创建新记录
        const newProfile = {
          openid,
          email: email || null,
          phone: phone || null,
          displayName: displayName || null,
          loginType: loginType || 'ANONYMOUS',
          tier: 'free',
          licenseKey: null,
          expiresAt: null,
          banned: false,
          createdAt: now,
          updatedAt: now,
          lastActiveAt: now,
        }
        await db.collection('user_profiles').add({ data: newProfile })
        return { code: 0, data: newProfile }
      }
    }

    case 'getProfile': {
      const res = await db.collection('user_profiles').where({ openid }).get()
      if (res.data && res.data.length > 0) {
        return { code: 0, data: res.data[0] }
      }
      return { code: 404, message: '用户档案不存在' }
    }

    case 'updateProfile': {
      const { displayName, avatar } = event
      const updateData = { updatedAt: new Date() }
      if (displayName) updateData.displayName = displayName
      if (avatar) updateData.avatar = avatar
      await db.collection('user_profiles').where({ openid }).update({ data: updateData })
      return { code: 0, message: '更新成功' }
    }

    // ========== 进化档案 ==========
    case 'loadEvolution': {
      try {
        const res = await db.collection('evolution_records')
          .where({ _openid: openid })
          .orderBy('created_at', 'desc')
          .limit(1000)
          .get()
        return { code: 0, data: res.data || [] }
      } catch { return { code: 0, data: [] } }
    }

    case 'saveEvolution': {
      const { record } = event
      await db.collection('evolution_records').add({
        data: {
          _openid: openid,
          ...record,
          created_at: new Date().toISOString(),
        },
      })
      return { code: 0, message: 'saved' }
    }

    case 'deleteEvolution': {
      const { recordId } = event
      await db.collection('evolution_records')
        .where({ _openid: openid, id: recordId })
        .remove()
      return { code: 0, message: 'deleted' }
    }

    // ========== 决策锁 ==========
    case 'saveDecisionLock': {
      const { record } = event
      await db.collection('decision_locks').add({
        data: {
          _openid: openid,
          ...record,
          created_at: new Date().toISOString(),
        },
      })
      return { code: 0, message: 'saved' }
    }

    case 'loadDecisionLocks': {
      try {
        const res = await db.collection('decision_locks')
          .where({ _openid: openid })
          .orderBy('created_at', 'desc')
          .limit(500)
          .get()
        return { code: 0, data: res.data || [] }
      } catch { return { code: 0, data: [] } }
    }

    case 'deleteDecisionLock': {
      const { recordId } = event
      await db.collection('decision_locks')
        .where({ _openid: openid, id: recordId })
        .remove()
      return { code: 0, message: 'deleted' }
    }

    // ========== 私有技能 ==========
    case 'savePrivateSkill': {
      const { skill } = event
      await db.collection('private_skills').add({
        data: {
          _openid: openid,
          ...skill,
          created_at: new Date().toISOString(),
        },
      })
      return { code: 0, message: 'saved' }
    }

    case 'loadPrivateSkills': {
      try {
        const res = await db.collection('private_skills')
          .where({ _openid: openid })
          .orderBy('created_at', 'desc')
          .get()
        return { code: 0, data: res.data || [] }
      } catch { return { code: 0, data: [] } }
    }

    case 'deletePrivateSkill': {
      const { skillId } = event
      await db.collection('private_skills')
        .where({ _openid: openid, id: skillId })
        .remove()
      return { code: 0, message: 'deleted' }
    }

    // ========== 反馈 ==========
    case 'submitFeedback': {
      const { feedback } = event
      await db.collection('feedback').add({
        data: {
          _openid: openid,
          ...feedback,
          status: 'pending',
          createdAt: new Date(),
        },
      })
      return { code: 0, message: '反馈已提交' }
    }

    default:
      return { code: 400, message: '未知操作' }
  }
}
