/**
 * MetaGO Studio - Sync Cloud Function
 * 数据同步 + 反馈提交
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  const { action, userInfo } = event
  const openid = userInfo?.openid || event.openid

  if (!openid) return { code: 401, message: '未登录' }

  const db = cloud.database()

  switch (action) {
    // ========== 进化档案 ==========
    case 'loadEvolution': {
      const res = await db.collection('evolution_records')
        .where({ _openid: openid })
        .orderBy('created_at', 'desc')
        .limit(1000)
        .get()
      return { code: 0, data: res.data || [] }
    }

    case 'saveEvolution': {
      const { record } = event
      await db.collection('evolution_records').add({
        _openid: openid,
        ...record,
        created_at: new Date().toISOString(),
      })
      return { code: 0, message: 'saved' }
    }

    case 'deleteEvolution': {
      const { recordId } = event
      await db.collection('evolution_records')
        .where({ _openid: openid, _id: recordId })
        .remove()
      return { code: 0, message: 'deleted' }
    }

    // ========== 决策锁 ==========
    case 'loadDecisionLocks': {
      const res = await db.collection('decision_locks')
        .where({ _openid: openid })
        .orderBy('created_at', 'desc')
        .limit(500)
        .get()
      return { code: 0, data: res.data || [] }
    }

    case 'saveDecisionLock': {
      const { record } = event
      await db.collection('decision_locks').add({
        _openid: openid,
        ...record,
        created_at: new Date().toISOString(),
      })
      return { code: 0, message: 'saved' }
    }

    case 'deleteDecisionLock': {
      const { recordId } = event
      await db.collection('decision_locks')
        .where({ _openid: openid, _id: recordId })
        .remove()
      return { code: 0, message: 'deleted' }
    }

    // ========== 私有技能 ==========
    case 'loadPrivateSkills': {
      const res = await db.collection('private_skills')
        .where({ _openid: openid })
        .orderBy('updated_at', 'desc')
        .limit(100)
        .get()
      return { code: 0, data: res.data || [] }
    }

    case 'savePrivateSkill': {
      const { skill } = event
      await db.collection('private_skills').add({
        _openid: openid,
        ...skill,
        updated_at: new Date().toISOString(),
      })
      return { code: 0, message: 'saved' }
    }

    case 'deletePrivateSkill': {
      const { skillId } = event
      await db.collection('private_skills')
        .where({ _openid: openid, _id: skillId })
        .remove()
      return { code: 0, message: 'deleted' }
    }

    // ========== 反馈 ==========
    case 'submitFeedback': {
      const { feedback } = event
      await db.collection('feedback').add({
        _openid: openid,
        ...feedback,
        status: 'pending',
        createdAt: new Date(),
      })
      return { code: 0, message: '反馈已提交' }
    }

    default:
      return { code: 400, message: '未知操作' }
  }
}
