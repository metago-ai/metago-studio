/**
 * MetaGO Studio - Subscription Cloud Function
 * 订阅管理：试用激活、授权码验证、订阅状态查询
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

function generateLicenseKey() {
  const crypto = require('crypto')
  const raw = crypto.randomBytes(24).toString('hex').toUpperCase()
  const parts = []
  for (let i = 0; i < raw.length; i += 4) {
    parts.push(raw.slice(i, i + 4))
  }
  return 'META-' + parts.slice(0, 5).join('-')
}

exports.main = async (event) => {
  const { action, userInfo } = event
  const openid = userInfo?.openid || event.openid

  if (!openid) return { code: 401, message: '未登录' }

  const db = cloud.database()
  const _ = db.command

  switch (action) {
    // ========== 激活试用 ==========
    case 'activateTrial': {
      const { email } = event
      if (!email || !email.includes('@')) {
        return { code: 400, message: '请输入有效邮箱' }
      }

      // 检查是否已试用过
      const existing = await db.collection('user_profiles').where({ openid }).get()
      const profile = existing.data?.[0]

      if (profile?.trialUsed) {
        return { code: 409, message: '您已使用过免费试用' }
      }

      const licenseKey = generateLicenseKey()
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

      // 更新或创建用户档案
      if (profile) {
        await db.collection('user_profiles').where({ openid }).update({
          tier: 'pro',
          email,
          licenseKey,
          licenseSource: 'trial',
          expiresAt,
          trialUsed: true,
          updatedAt: now,
        })
      } else {
        await db.collection('user_profiles').add({
          openid,
          email,
          tier: 'pro',
          licenseKey,
          licenseSource: 'trial',
          expiresAt,
          trialUsed: true,
          createdAt: now,
          updatedAt: now,
        })
      }

      // 记录订单
      await db.collection('orders').add({
        orderId: `trial_${Date.now()}`,
        openid,
        plan: 'trial',
        amount: 0,
        status: 'completed',
        licenseKey,
        createdAt: now,
      })

      return {
        code: 0,
        data: {
          tier: 'pro',
          licenseKey,
          expiresAt: expiresAt.toISOString(),
          source: 'trial',
        },
      }
    }

    // ========== 授权码激活 ==========
    case 'activateLicense': {
      const { licenseKey } = event
      if (!licenseKey) return { code: 400, message: '请输入授权码' }

      // 查询授权码
      const licenseRes = await db.collection('licenses').where({
        licenseKey,
        status: 'unused',
      }).get()

      if (!licenseRes.data || licenseRes.data.length === 0) {
        return { code: 404, message: '授权码无效或已被使用' }
      }

      const license = licenseRes.data[0]

      // 检查是否过期
      if (new Date(license.expiresAt) < new Date()) {
        await db.collection('licenses').where({ licenseKey }).update({
          status: 'expired',
        })
        return { code: 410, message: '授权码已过期' }
      }

      // 激活
      const now = new Date()
      const expiresAt = license.expiresAt

      const existing = await db.collection('user_profiles').where({ openid }).get()
      if (existing.data?.[0]) {
        await db.collection('user_profiles').where({ openid }).update({
          tier: 'pro',
          licenseKey,
          licenseSource: 'license',
          expiresAt,
          updatedAt: now,
        })
      } else {
        await db.collection('user_profiles').add({
          openid,
          tier: 'pro',
          licenseKey,
          licenseSource: 'license',
          expiresAt,
          createdAt: now,
          updatedAt: now,
        })
      }

      // 标记授权码已使用
      await db.collection('licenses').where({ licenseKey }).update({
        status: 'used',
        usedBy: openid,
        usedAt: now,
      })

      return {
        code: 0,
        data: {
          tier: 'pro',
          licenseKey,
          expiresAt: expiresAt.toISOString(),
          source: 'license',
        },
      }
    }

    // ========== 查询订阅状态 ==========
    case 'getStatus': {
      const res = await db.collection('user_profiles').where({ openid }).get()
      const profile = res.data?.[0]

      if (!profile) {
        return {
          code: 0,
          data: {
            tier: 'free',
            trialUsed: false,
          },
        }
      }

      // 检查是否过期
      let tier = profile.tier || 'free'
      if (tier === 'pro' && profile.expiresAt) {
        if (new Date(profile.expiresAt) < new Date()) {
          tier = 'free'
          await db.collection('user_profiles').where({ openid }).update({
            tier: 'free',
            expiredAt: new Date(),
          })
        }
      }

      return {
        code: 0,
        data: {
          tier,
          licenseKey: profile.licenseKey,
          licenseSource: profile.licenseSource,
          expiresAt: profile.expiresAt,
          trialUsed: profile.trialUsed || false,
          email: profile.email,
        },
      }
    }

    // ========== 生成授权码（管理员） ==========
    case 'generateLicense': {
      const ADMIN_OPENID = (process.env.ADMIN_OPENID || '').split(',').filter(Boolean)
      if (!ADMIN_OPENID.includes(openid)) {
        return { code: 403, message: '无权限' }
      }
      const { plan = 'monthly', count = 1, note = '' } = event
      const days = plan === 'yearly' ? 365 : plan === 'monthly' ? 30 : 14
      const licenses = []

      for (let i = 0; i < count; i++) {
        const key = generateLicenseKey()
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
        await db.collection('licenses').add({
          licenseKey: key,
          plan,
          expiresAt,
          status: 'unused',
          note,
          createdBy: openid,
          createdAt: new Date(),
        })
        licenses.push({ key, expiresAt: expiresAt.toISOString() })
      }

      return { code: 0, data: { licenses } }
    }

    default:
      return { code: 400, message: '未知操作' }
  }
}
