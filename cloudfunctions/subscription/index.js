/**
 * MetaGO Studio - Subscription Cloud Function（V3 五档定价）
 * 订阅管理：授权码云端验证激活、订阅状态查询、取消订阅、Token 用量查询
 *
 * Action 列表（与前端 cloudFunctions.ts 完全对齐）：
 *   - getProfile          查询用户订阅状态（服务端权威）
 *   - activatePro         授权码云端验证激活
 *   - cancelSubscription  取消订阅（降级为 free）
 *   - generateLicense     管理员生成授权码
 *   - getTokenUsage       查询当月 Token 已用量
 *
 * V3 五档定价（2026-07-06 重构）：
 *   - free        社区版：10万 tokens/天，无 BYOK
 *   - pro         个人版 ¥39/月：500万 tokens/月，BYOK 可选
 *   - pro_plus    专业版 ¥99/月：2000万 tokens/月 + 行为银行信用 + 优先支持
 *   - team        团队版 ¥199/月起 + 500小时 + 超出 ¥0.5/小时
 *   - enterprise  企业版 ¥3万/年起 + ¥6000/席位/年 + 强制 BYOK + 私有部署
 *
 * 授权码格式：
 *   - METAGO-PRO-XXXX-XXXX-XXXX       → pro
 *   - METAGO-PROPLUS-XXXX-XXXX-XXXX   → pro_plus
 *   - METAGO-TEAM-XXXX-XXXX-XXXX      → team
 *   - METAGO-ENT-XXXX-XXXX-XXXX       → enterprise
 *
 * V3 已下线 14 天免费试用（trial）。startTrial action 保留兼容但返回失败提示。
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/**
 * 生成授权码（格式：METAGO-{TYPE}-XXXX-XXXX-XXXX）
 * @param {'pro'|'pro_plus'|'team'|'enterprise'} type
 */
function generateLicenseKey(type = 'pro') {
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
  // 各 tier 的前缀映射
  const prefixMap = {
    pro: 'PRO',
    pro_plus: 'PROPLUS',
    team: 'TEAM',
    enterprise: 'ENT',
  }
  const prefix = prefixMap[type] || 'PRO'
  return `METAGO-${prefix}-${seg()}-${seg()}-${seg()}`
}

/**
 * 从授权码解析档位类型（V3 支持 4 种前缀）
 */
function parseLicenseTier(licenseKey) {
  if (/^METAGO-PRO-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/.test(licenseKey)) {
    return 'pro'
  }
  if (/^METAGO-PROPLUS-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/.test(licenseKey)) {
    return 'pro_plus'
  }
  if (/^METAGO-TEAM-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/.test(licenseKey)) {
    return 'team'
  }
  if (/^METAGO-ENT-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/.test(licenseKey)) {
    return 'enterprise'
  }
  return null
}

/**
 * 各 tier 默认配置（V3）
 */
const TIER_DEFAULTS = {
  free:       { seats: 1, teamHoursBalance: 0,   enterpriseSeats: 0  },
  pro:        { seats: 1, teamHoursBalance: 0,   enterpriseSeats: 0  },
  pro_plus:   { seats: 1, teamHoursBalance: 0,   enterpriseSeats: 0  },
  team:       { seats: 5, teamHoursBalance: 500, enterpriseSeats: 0  },
  enterprise: { seats: 5, teamHoursBalance: 0,   enterpriseSeats: 5  },
}

/**
 * 构造标准 UserProfile 返回结构（V3，含 teamHoursBalance/enterpriseSeats）
 */
function buildProfile(profile) {
  if (!profile) {
    return {
      tier: 'free',
      email: '',
      licenseKey: '',
      activatedAt: null,
      expiresAt: null,
      seats: 1,
      teamHoursBalance: 0,
      enterpriseSeats: 0,
    }
  }
  let tier = profile.tier || 'free'
  // V3 数据迁移：旧 trial 数据降级为 free
  if (tier === 'trial') tier = 'free'
  // 服务端过期检查（V3 五档全包含）
  if (tier !== 'free' && profile.expiresAt) {
    if (new Date(profile.expiresAt) < new Date()) {
      tier = 'free'
    }
  }
  const defaults = TIER_DEFAULTS[tier] || TIER_DEFAULTS.free
  return {
    tier,
    email: profile.email || '',
    licenseKey: profile.licenseKey || '',
    activatedAt: profile.activatedAt ? new Date(profile.activatedAt).toISOString() : null,
    expiresAt: profile.expiresAt ? new Date(profile.expiresAt).toISOString() : null,
    seats: profile.seats || defaults.seats,
    teamHoursBalance: profile.teamHoursBalance ?? defaults.teamHoursBalance,
    enterpriseSeats: profile.enterpriseSeats ?? defaults.enterpriseSeats,
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

  // V3 身份标识（2026-07-07 修复严重 bug）：
  // _clientUid（手机号注册的稳定 userId）优先，wxContext.UID（匿名 UID）仅作 fallback
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

  if (!openid) return { code: 401, message: '未登录，无法获取用户身份', debug: { wxContextKeys: Object.keys(wxContext || {}) } }

  const db = cloud.database()
  const _ = db.command
  const now = new Date()

  // 确保必要集合存在
  for (const col of ['user_profiles', 'orders', 'licenses']) {
    try { await db.createCollection(col) } catch { /* 已存在 */ }
  }

  switch (action) {
    // ========== 查询用户订阅状态（服务端权威） ==========
    case 'getProfile': {
      let res = await db.collection('user_profiles').where({ openid }).get()
      let profile = res.data?.[0]

      // V4.5 修复（2026-07-08）：openid 不匹配时的 licenseKey fallback + 自动迁移
      // 场景：用户激活授权码时用的是 CloudBase 匿名 UID，后来登录了 userManager，
      //       metago_user_id 变成了新值，但 user_profiles 中的 openid 还是旧匿名 UID。
      // 解决：用 licenseKey 查找 Pro 记录，自动将 openid 迁移到当前用户。
      if (!profile && event.licenseKey) {
        const licenseRes = await db.collection('user_profiles').where({ licenseKey: event.licenseKey }).get()
        const licenseProfile = licenseRes.data?.[0]
        if (licenseProfile && licenseProfile.tier && licenseProfile.tier !== 'free') {
          await db.collection('user_profiles').where({ licenseKey: event.licenseKey }).update({
            data: { openid, updatedAt: now }
          })
          res = await db.collection('user_profiles').where({ openid }).get()
          profile = res.data?.[0]
        }
      }

      if (!profile) {
        return { code: 0, data: buildProfile(null) }
      }

      // V3 数据迁移：旧 trial 数据降级为 free
      let currentTier = profile.tier || 'free'
      let needUpdate = false
      if (currentTier === 'trial') {
        currentTier = 'free'
        await db.collection('user_profiles').where({ openid }).update({
          data: { tier: 'free', updatedAt: now }
        })
        profile.tier = 'free'
        needUpdate = true
      }

      // 过期自动降级（V3 五档全包含）
      if (currentTier !== 'free' && profile.expiresAt) {
        if (new Date(profile.expiresAt) < now) {
          await db.collection('user_profiles').where({ openid }).update({
            data: {
              tier: 'free',
              expiredAt: now,
              updatedAt: now,
            }
          })
          profile.tier = 'free'
          needUpdate = true
        }
      }

      return { code: 0, data: buildProfile(profile) }
    }

    // ========== 启动14天免费试用（V3 已下线，保留兼容返回失败）==========
    case 'startTrial': {
      // V3 已下线 14 天免费试用。新定价：直接订阅 Pro 或 Pro+
      return {
        code: 410,
        message: '14 天免费试用已下线，请直接订阅 Pro（¥39/月）或 Pro+（¥99/月）',
      }
    }

    // ========== 授权码云端验证激活 ==========
    case 'activatePro': {
      const { licenseKey, email } = event
      const contact = email || event.contact || ''
      if (!licenseKey) {
        return { code: 400, message: '请输入授权码' }
      }

      // 格式预检（V3 支持 4 种前缀）
      const licenseTier = parseLicenseTier(licenseKey)
      if (!licenseTier) {
        return { code: 400, message: '授权码格式错误，应为 METAGO-PRO/PROPLUS/TEAM/ENT-XXXX-XXXX-XXXX' }
      }

      // 查询授权码（服务端权威验证）
      const licenseRes = await db.collection('licenses').where({ licenseKey }).get()

      if (!licenseRes.data || licenseRes.data.length === 0) {
        return { code: 404, message: '授权码不存在，请检查后重试' }
      }

      const license = licenseRes.data[0]

      // 检查状态
      if (license.status === 'used') {
        return { code: 410, message: '授权码已被使用' }
      }
      if (license.status === 'revoked') {
        return { code: 403, message: '授权码已被吊销' }
      }
      if (license.status === 'expired' || (license.expiresAt && new Date(license.expiresAt) < now)) {
        await db.collection('licenses').where({ licenseKey }).update({ data: { status: 'expired' } })
        return { code: 410, message: '授权码已过期' }
      }
      if (license.status !== 'unused' && license.status !== 'active') {
        return { code: 403, message: `授权码状态异常（${license.status}）` }
      }

      // 计算到期时间
      const activatedAt = now
      let expiresAt
      if (license.expiresAt) {
        expiresAt = new Date(license.expiresAt)
      } else if (license.durationDays) {
        expiresAt = new Date(now.getTime() + license.durationDays * 24 * 60 * 60 * 1000)
      } else {
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      }

      // V3 各 tier 的默认 seats/teamHoursBalance/enterpriseSeats
      const defaults = TIER_DEFAULTS[licenseTier] || TIER_DEFAULTS.pro
      const seats = license.seats || defaults.seats
      const teamHoursBalance = defaults.teamHoursBalance
      const enterpriseSeats = defaults.enterpriseSeats

      // 查询现有档案
      const existing = await db.collection('user_profiles').where({ openid }).get()
      const profile = existing.data?.[0]

      const profileData = {
        tier: licenseTier,
        email: email || profile?.email || '',
        contact: contact || profile?.contact || email || '',
        licenseKey,
        licenseSource: 'license',
        activatedAt,
        expiresAt,
        seats,
        teamHoursBalance,
        enterpriseSeats,
        updatedAt: now,
      }

      if (profile) {
        await db.collection('user_profiles').where({ openid }).update({ data: profileData })
      } else {
        await db.collection('user_profiles').add({
          data: {
            openid,
            ...profileData,
            createdAt: now,
          }
        })
      }

      // 标记授权码已使用
      await db.collection('licenses').where({ licenseKey }).update({
        data: {
          status: 'used',
          usedBy: openid,
          usedAt: now,
          usedEmail: email || '',
          usedContact: contact || '',
        }
      })

      // 记录订单
      await db.collection('orders').add({
        data: {
          orderId: `license_${Date.now()}_${openid.slice(-8)}`,
          openid,
          userId: openid,
          plan: licenseTier,
          planId: `license_${licenseTier}`,
          tier: licenseTier,
          orderType: 'subscription',
          amount: license.amount || 0,
          status: 'completed',
          licenseKey,
          email: email || '',
          contact: contact || '',
          createdAt: now,
        }
      })

      const fullProfile = { ...profile, ...profileData }
      const tierLabel = {
        pro: 'Pro',
        pro_plus: 'Pro+',
        team: 'Team',
        enterprise: 'Enterprise',
      }[licenseTier] || 'Pro'
      return {
        code: 0,
        data: buildProfile(fullProfile),
        message: `${tierLabel} 授权激活成功`,
      }
    }

    // ========== 取消订阅（降级为 free） ==========
    case 'cancelSubscription': {
      const existing = await db.collection('user_profiles').where({ openid }).get()
      const profile = existing.data?.[0]

      if (!profile) {
        return { code: 0, data: buildProfile(null), message: '当前为免费版' }
      }

      await db.collection('user_profiles').where({ openid }).update({
        data: {
          tier: 'free',
          expiresAt: now,
          teamHoursBalance: 0,
          enterpriseSeats: 0,
          updatedAt: now,
        }
      })

      const updated = { ...profile, tier: 'free', expiresAt: now }
      return {
        code: 0,
        data: buildProfile(updated),
        message: '订阅已取消，已降级为社区版',
      }
    }

    // ========== 管理员生成授权码 ==========
    case 'generateLicense': {
      const ADMIN_OPENID = (process.env.ADMIN_OPENID || '').split(',').filter(Boolean)
      if (!ADMIN_OPENID.includes(openid)) {
        return { code: 403, message: '无权限' }
      }
      const { plan = 'pro', count = 1, durationDays = 30, note = '' } = event
      // V3 支持 4 种 tier
      const validTiers = ['pro', 'pro_plus', 'team', 'enterprise']
      const tier = validTiers.includes(plan) ? plan : 'pro'
      const licenses = []

      for (let i = 0; i < count; i++) {
        const key = generateLicenseKey(tier)
        const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)
        const defaults = TIER_DEFAULTS[tier]
        await db.collection('licenses').add({
          data: {
            licenseKey: key,
            plan: tier,
            durationDays,
            expiresAt,
            status: 'unused',
            note,
            seats: defaults.seats,
            teamHoursBalance: defaults.teamHoursBalance,
            enterpriseSeats: defaults.enterpriseSeats,
            createdBy: openid,
            createdAt: now,
          }
        })
        licenses.push({ key, expiresAt: expiresAt.toISOString(), plan: tier })
      }

      return {
        code: 0,
        data: { licenses },
      }
    }

    // ========== 查询当月 Token 用量（V3 按 tier 分档）==========
    case 'getTokenUsage': {
      const profileRes = await db.collection('user_profiles').where({ openid }).get()
      const profile = profileRes.data?.[0]

      if (!profile) {
        return { code: 0, data: { used: 0, tier: 'free' } }
      }

      const tier = profile.tier === 'trial' ? 'free' : (profile.tier || 'free')

      // Enterprise 强制 BYOK：不计量
      if (tier === 'enterprise') {
        return { code: 0, data: { used: 0, tier, byokRequired: true } }
      }

      const tokenUsage = profile.tokenUsage || { monthly: {}, daily: {} }
      const monthStr = now.toISOString().slice(0, 7)
      const todayStr = now.toISOString().slice(0, 10)

      // 月配额（Pro/Pro+/Team）
      const monthlyUsed = tokenUsage.monthly?.[monthStr] || 0
      // 日配额（Free）
      const dailyUsed = tokenUsage.daily?.[todayStr] || 0

      // 按 tier 返回不同维度
      // - free：返回当日用量（10万/天配额）
      // - pro：500万/月
      // - pro_plus：2000万/月
      // - team：2000万/月共享池（已计入 teamHoursBalance 单独计量）
      const used = (tier === 'free') ? dailyUsed : monthlyUsed

      return {
        code: 0,
        data: {
          used,
          tier,
          monthlyUsed,
          dailyUsed,
          month: monthStr,
          date: todayStr,
        },
      }
    }

    default:
      return { code: 400, message: `未知操作: ${action}` }
  }
}
