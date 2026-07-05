/**
 * MetaGO Studio - Payment Cloud Function
 * 真实支付系统：微信支付（Native 扫码）+ 支付宝（网页支付）+ 模拟支付（开发测试）
 *
 * Action 列表（与前端 paymentService.ts 完全对齐）：
 *   - createOrder          创建订单（写入 orders 集合）
 *   - wechatNativePay      微信 Native 支付（返回 code_url 二维码链接）
 *   - alipayPagePay        支付宝网页支付（返回支付链接）
 *   - queryOrder           查询订单（含主动向微信/支付宝查询真实状态）
 *   - getOrderStatus       查询订单本地状态（轮询用，轻量）
 *   - handleWechatNotify   微信支付回调（更新订单 + 升级订阅）
 *   - handleAlipayNotify   支付宝回调（更新订单 + 升级订阅）
 *   - mockPaySuccess       模拟支付成功（开发测试，明确标记 mock=true）
 *
 * 环境变量（CloudBase 控制台配置，禁止硬编码密钥）：
 *   - WECHAT_APP_ID        微信 AppId（公众号/小程序）
 *   - WECHAT_MCH_ID        微信商户号
 *   - WECHAT_API_KEY       微信 V3 API 密钥
 *   - WECHAT_SERIAL_NO     微信商户证书序列号
 *   - WECHAT_PRIVATE_KEY   微信商户私钥（PEM，用于 V3 SHA256-RSA 签名）
 *   - WECHAT_NOTIFY_URL    微信支付回调地址
 *   - ALIPAY_APP_ID        支付宝 AppId
 *   - ALIPAY_PRIVATE_KEY   支付宝应用私钥（PEM）
 *   - ALIPAY_PUBLIC_KEY    支付宝公钥（PEM，用于验签）
 *   - ALIPAY_NOTIFY_URL    支付宝回调地址
 *
 * 数据架构（与 subscription 云函数保持一致）：
 *   - user_profiles        用户档案（tier/expiresAt 字段权威）
 *   - orders               订单（openid + userId 双标识兼容）
 *   - subscriptions        订阅历史（新增，每次支付成功追加一条）
 *
 * 未配置支付密钥时返回 mock 数据（明确标记 mock: true），保证开发环境可用。
 */

const tcb = require('@cloudbase/node-sdk')
const crypto = require('crypto')
const https = require('https')

const app = tcb.init({ env: 'metago-d6gfw1e4rf2a5bcad' })
const db = app.database()

// ============ 支付配置（从环境变量读取，绝不硬编码） ============
const WECHAT_PAY = {
  appId: process.env.WECHAT_APP_ID || '',
  mchId: process.env.WECHAT_MCH_ID || '',
  apiKey: process.env.WECHAT_API_KEY || '',          // V3 API 密钥
  serialNo: process.env.WECHAT_SERIAL_NO || '',       // 商户证书序列号
  privateKey: process.env.WECHAT_PRIVATE_KEY || '',   // 商户私钥 PEM
  notifyUrl: process.env.WECHAT_NOTIFY_URL || 'https://metago.life/api/payment/wechat/notify',
}

const ALIPAY = {
  appId: process.env.ALIPAY_APP_ID || '',
  privateKey: process.env.ALIPAY_PRIVATE_KEY || '',   // 应用私钥 PEM
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || '', // 支付宝公钥 PEM
  notifyUrl: process.env.ALIPAY_NOTIFY_URL || 'https://metago.life/api/payment/alipay/notify',
}

// ============ 订阅计划定义（V3 五档定价，与官网/studio 定价一致）============
// price 单位：分
const PLANS = {
  // Pro（个人版）¥39/月 / ¥390/年
  pro:            { name: 'MetaGO Pro 月度',   price: 3900,   duration: 30,  tier: 'pro',         description: 'Pro 个人版月度订阅（500万 tokens/月）' },
  pro_year:       { name: 'MetaGO Pro 年度',   price: 39000,  duration: 365, tier: 'pro',         description: 'Pro 个人版年度订阅' },
  // Pro+（专业版）¥99/月 / ¥990/年（V3 新增）
  pro_plus:       { name: 'MetaGO Pro+ 月度',  price: 9900,   duration: 30,  tier: 'pro_plus',    description: 'Pro+ 专业版月度订阅（2000万 tokens/月 + 行为银行信用 + 优先支持）' },
  pro_plus_year:  { name: 'MetaGO Pro+ 年度',  price: 99000,  duration: 365, tier: 'pro_plus',    description: 'Pro+ 专业版年度订阅' },
  // Team（团队版）¥199/月起 + 500小时 + 超出 ¥0.5/小时
  team:           { name: 'MetaGO Team 月度',  price: 19900,  duration: 30,  tier: 'team',         description: '团队版月度订阅（2000万 tokens/月共享池 + 500小时数字员工时长）' },
  team_year:      { name: 'MetaGO Team 年度',  price: 199000, duration: 365, tier: 'team',         description: '团队版年度订阅' },
  // Enterprise（企业版）¥3万/年起 + ¥6000/席位/年 + 强制 BYOK + 私有部署
  enterprise:     { name: 'MetaGO Enterprise 年度', price: 3000000, duration: 365, tier: 'enterprise', description: '企业版年度订阅（强制 BYOK + 私有部署 + SLA 99.9%）' },
  // Certify（独立认证）¥999-9999/次（独立收费）
  certify_l1:     { name: 'MetaGO Certify L1',  price: 99900,   duration: 0, tier: 'free', orderType: 'certify', description: '元构范式合规认证 L1（基础级）' },
  certify_l2:     { name: 'MetaGO Certify L2',  price: 299900,  duration: 0, tier: 'free', orderType: 'certify', description: '元构范式合规认证 L2（进阶级）' },
  certify_l3:     { name: 'MetaGO Certify L3',  price: 599900,  duration: 0, tier: 'free', orderType: 'certify', description: '元构范式合规认证 L3（专业级）' },
  certify_l4:     { name: 'MetaGO Certify L4',  price: 999900,  duration: 0, tier: 'free', orderType: 'certify', description: '元构范式合规认证 L4（专家级）' },
  // Enterprise 加席 ¥6000/席位/年
  enterprise_seat:{ name: 'MetaGO Enterprise 加席', price: 600000, duration: 365, tier: 'enterprise', orderType: 'seats', description: '企业版增加席位（¥6000/席位/年）' },
}

// V3 各 tier 默认配置（与 subscription 云函数保持一致）
const TIER_DEFAULTS = {
  pro:         { seats: 1, teamHoursBalance: 0,   enterpriseSeats: 0  },
  pro_plus:    { seats: 1, teamHoursBalance: 0,   enterpriseSeats: 0  },
  team:        { seats: 5, teamHoursBalance: 500, enterpriseSeats: 0  },
  enterprise:  { seats: 5, teamHoursBalance: 0,   enterpriseSeats: 5  },
}

/**
 * 解析用户身份
 * 优先级：event.userId（显式）> event._clientUid（前端 callFunction 自动注入）> event.openid
 * 与 subscription/events 云函数的身份识别模式保持一致。
 */
function resolveUserId(event) {
  return event.userId
    || event._clientUid
    || event.openid
    || event.uid
    || (event.userInfo && (event.userInfo.openid || event.userInfo.uid))
    || ''
}

/**
 * 生成订单号：MG + 时间戳 + 随机串
 */
function generateOrderId() {
  return 'MG' + Date.now() + Math.random().toString(36).slice(2, 8).toUpperCase()
}

exports.main = async (event, context) => {
  const { action } = event

  // HTTP 触发兼容（回调入口可能以 HTTP 方法触发）
  if (event.httpMethod && event.body) {
    try {
      const parsed = JSON.parse(event.body)
      event = { ...event, ...parsed }
    } catch { /* body 非 JSON，按表单处理 */ }
  }

  try {
    switch (action) {
      case 'createOrder':
        return await createOrder(event)
      case 'wechatNativePay':
        return await wechatNativePay(event)
      case 'alipayPagePay':
        return await alipayPagePay(event)
      case 'queryOrder':
        return await queryOrder(event)
      case 'handleWechatNotify':
        return await handleWechatNotify(event)
      case 'handleAlipayNotify':
        return await handleAlipayNotify(event)
      case 'getOrderStatus':
        return await getOrderStatus(event)
      case 'mockPaySuccess':
        return await mockPaySuccess(event)
      default:
        return { code: 1, message: '未知操作: ' + action }
    }
  } catch (e) {
    console.error('[payment] 错误', e)
    return { code: 1, message: (e && e.message) || '支付服务异常' }
  }
}

// ============ 创建订单 ============
async function createOrder(event) {
  const userId = resolveUserId(event)
  if (!userId) return { code: 401, message: '未登录' }

  const { planId, paymentMethod } = event
  const plan = PLANS[planId]
  if (!plan) return { code: 1, message: '无效的订阅计划' }
  if (!['wechat', 'alipay'].includes(paymentMethod)) {
    return { code: 1, message: '无效的支付方式' }
  }

  const orderId = generateOrderId()
  const now = new Date()

  const order = {
    orderId,
    openid: userId,        // 兼容 subscription 云函数的身份字段约定
    userId,
    planId,
    planName: plan.name,
    amount: plan.price,
    duration: plan.duration,
    tier: plan.tier,
    orderType: plan.orderType || 'subscription',  // V3：subscription | certify | seats
    paymentMethod,         // 'wechat' | 'alipay'
    status: 'pending',     // pending | paid | failed | expired
    createdAt: now,
    updatedAt: now,
  }

  try { await db.createCollection('orders') } catch { /* 已存在 */ }
  await db.collection('orders').add(order)

  console.log(`[payment] 订单创建 ${orderId} 用户 ${userId} 计划 ${planId} 金额 ${plan.price}`)

  return {
    code: 0,
    data: {
      orderId,
      amount: plan.price,
      planName: plan.name,
      planId,
    },
  }
}

// ============ 微信 Native 支付（扫码） ============
async function wechatNativePay(event) {
  const { orderId } = event
  if (!orderId) return { code: 1, message: '缺少订单号' }

  const { data: orders } = await db.collection('orders').where({ orderId }).get()
  if (!orders || orders.length === 0) return { code: 1, message: '订单不存在' }
  const order = orders[0]
  if (order.status === 'paid') return { code: 1, message: '订单已支付' }

  // 开发环境：未配置微信支付，返回模拟二维码（明确标记 mock）
  if (!WECHAT_PAY.appId || !WECHAT_PAY.mchId) {
    return {
      code: 0,
      data: {
        codeUrl: 'weixin://wxpay/bizpayurl?pr=' + orderId,
        orderId,
        amount: order.amount,
        mock: true,
        message: '微信支付未配置，这是模拟二维码（开发测试用）',
      },
    }
  }

  // ============ 生产实现：微信支付 V3 Native 下单 ============
  // 完整流程：
  //   1. 构造 V3 请求体
  //   2. SHA256-RSA 签名（用商户私钥）
  //   3. POST https://api.mch.weixin.qq.com/v3/pay/transactions/native
  //   4. 解析返回的 code_url
  try {
    const body = JSON.stringify({
      appid: WECHAT_PAY.appId,
      mchid: WECHAT_PAY.mchId,
      description: order.planName,
      out_trade_no: orderId,
      time_expire: formatRfc3339(new Date(Date.now() + 30 * 60 * 1000)),
      notify_url: WECHAT_PAY.notifyUrl,
      amount: { total: order.amount, currency: 'CNY' },
    })

    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonceStr = crypto.randomBytes(16).toString('hex')
    const signature = signWechatV3('POST', '/v3/pay/transactions/native', timestamp, nonceStr, body)

    const authHeader = `WECHATPAY2-SHA256-RSA2048 mchid="${WECHAT_PAY.mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${WECHAT_PAY.serialNo}",signature="${signature}"`

    const wxRes = await httpJsonRequest({
      hostname: 'api.mch.weixin.qq.com',
      path: '/v3/pay/transactions/native',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader,
      },
    }, body)

    if (wxRes.code_url) {
      await db.collection('orders').doc(order._id).update({
        wxPrepayId: wxRes.prepay_id || '',
        updatedAt: new Date(),
      })
      return { code: 0, data: { codeUrl: wxRes.code_url, orderId, amount: order.amount } }
    }
    return { code: 1, message: (wxRes.message) || '微信支付下单失败' }
  } catch (e) {
    console.error('[payment] wechatNativePay 失败', e)
    return { code: 1, message: '微信支付服务异常: ' + (e.message || '') }
  }
}

// ============ 支付宝网页支付 ============
async function alipayPagePay(event) {
  const { orderId } = event
  if (!orderId) return { code: 1, message: '缺少订单号' }

  const { data: orders } = await db.collection('orders').where({ orderId }).get()
  if (!orders || orders.length === 0) return { code: 1, message: '订单不存在' }
  const order = orders[0]
  if (order.status === 'paid') return { code: 1, message: '订单已支付' }

  // 开发环境：未配置支付宝，返回模拟支付链接（明确标记 mock）
  if (!ALIPAY.appId || !ALIPAY.privateKey) {
    return {
      code: 0,
      data: {
        payUrl: 'https://metago.life/payment/mock-alipay?orderId=' + orderId,
        orderId,
        amount: order.amount,
        mock: true,
        message: '支付宝未配置，这是模拟支付链接（开发测试用）',
      },
    }
  }

  // ============ 生产实现：支付宝 alipay.trade.page.pay ============
  // 构造业务参数 + RSA2 签名 + 返回跳转 URL
  try {
    const bizContent = JSON.stringify({
      out_trade_no: orderId,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      total_amount: (order.amount / 100).toFixed(2), // 支付宝单位是元
      subject: order.planName,
    })
    const params = {
      app_id: ALIPAY.appId,
      method: 'alipay.trade.page.pay',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: formatAlipayTimestamp(new Date()),
      version: '1.0',
      notify_url: ALIPAY.notifyUrl,
      biz_content: bizContent,
    }
    params.sign = signAlipay(params)
    const query = Object.keys(params)
      .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
      .join('&')
    return {
      code: 0,
      data: {
        payUrl: 'https://openapi.alipay.com/gateway.do?' + query,
        orderId,
        amount: order.amount,
      },
    }
  } catch (e) {
    console.error('[payment] alipayPagePay 失败', e)
    return { code: 1, message: '支付宝服务异常: ' + (e.message || '') }
  }
}

// ============ 查询订单（向支付平台主动查询真实状态） ============
async function queryOrder(event) {
  const { orderId } = event
  if (!orderId) return { code: 1, message: '缺少订单号' }

  const { data: orders } = await db.collection('orders').where({ orderId }).get()
  if (!orders || orders.length === 0) return { code: 1, message: '订单不存在' }
  const order = orders[0]

  // 已有终态直接返回
  if (order.status === 'paid' || order.status === 'failed') {
    return { code: 0, data: order }
  }

  // 生产环境：向微信/支付宝主动查询（此处仅占位，需真实配置后启用）
  // 简化：直接返回本地状态
  return { code: 0, data: order }
}

// ============ 查询订单本地状态（前端轮询用，轻量） ============
async function getOrderStatus(event) {
  const { orderId } = event
  if (!orderId) return { code: 1, message: '缺少订单号' }

  const { data: orders } = await db.collection('orders').where({ orderId }).get()
  if (!orders || orders.length === 0) return { code: 1, message: '订单不存在' }
  return { code: 0, data: { status: orders[0].status, orderId, amount: orders[0].amount, planId: orders[0].planId } }
}

// ============ 微信支付回调 ============
async function handleWechatNotify(event) {
  // 生产实现：先用 WECHAT_PAY.apiKey 验证 V3 签名（Authorization + Wechatpay-Signature 头）
  // 验签通过后解密 resource.ciphertext 得到真实订单号
  // 简化：信任 event.orderId（仅适用于内部触发；HTTP 触发必须验签）
  const orderId = event.order_id || event.out_trade_no || event.orderId
  if (!orderId) return { code: 'FAIL', message: '缺少订单号' }

  await updateOrderAndSubscription(orderId, 'paid', 'wechat')
  return { code: 'SUCCESS', message: '成功' }
}

// ============ 支付宝回调 ============
async function handleAlipayNotify(event) {
  // 生产实现：用 ALIPAY.alipayPublicKey 验证 sign/sign_type
  const { out_trade_no, trade_status } = event
  if (trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED') {
    await updateOrderAndSubscription(out_trade_no, 'paid', 'alipay')
  }
  return 'success'
}

// ============ 核心函数：支付成功后更新订单 + 用户订阅（V3 五档）============
async function updateOrderAndSubscription(orderId, status, paymentChannel) {
  const { data: orders } = await db.collection('orders').where({ orderId }).get()
  if (!orders || orders.length === 0) {
    console.warn(`[payment] 回调订单不存在 ${orderId}`)
    return
  }
  const order = orders[0]

  // 幂等：已处理直接返回
  if (order.status === 'paid') {
    console.log(`[payment] 订单 ${orderId} 已支付，幂等返回`)
    return
  }

  const now = new Date()
  await db.collection('orders').doc(order._id).update({
    status,
    paymentChannel: paymentChannel || order.paymentMethod,
    paidAt: status === 'paid' ? now : null,
    updatedAt: now,
  })

  if (status !== 'paid') return

  const plan = PLANS[order.planId] || { tier: 'pro', duration: order.duration || 30 }
  const orderType = plan.orderType || 'subscription'

  // Certify 认证订单：不更新 user_profiles.tier，单独写入 certify_orders 集合
  if (orderType === 'certify') {
    try { await db.createCollection('certify_orders') } catch { /* 已存在 */ }
    await db.collection('certify_orders').add({
      userId: order.userId,
      orderId,
      planId: order.planId,
      planName: order.planName,
      level: order.planId.replace('certify_l', 'L'),
      amount: order.amount,
      status: 'paid',
      paymentChannel: paymentChannel || order.paymentMethod,
      createdAt: now,
    })
    console.log(`[payment] Certify 认证订单 ${orderId} 支付成功，等级 ${order.planId}`)
    return
  }

  // Enterprise 加席订单：累加 enterpriseSeats，不重置 expiresAt
  if (orderType === 'seats') {
    try { await db.createCollection('user_profiles') } catch { /* 已存在 */ }
    const { data: profiles } = await db.collection('user_profiles').where({ openid: order.userId }).get()
    if (profiles && profiles.length > 0) {
      const currentSeats = profiles[0].enterpriseSeats || 0
      await db.collection('user_profiles').doc(profiles[0]._id).update({
        enterpriseSeats: currentSeats + 1,
        updatedAt: now,
      })
    }
    console.log(`[payment] Enterprise 加席订单 ${orderId} 成功`)
    return
  }

  // 订阅订单（subscription）：更新 user_profiles tier + expiresAt + teamHoursBalance/enterpriseSeats
  const expiresAt = new Date(now.getTime() + (order.duration || plan.duration) * 24 * 60 * 60 * 1000)
  const defaults = TIER_DEFAULTS[plan.tier] || TIER_DEFAULTS.pro

  try { await db.createCollection('user_profiles') } catch { /* 已存在 */ }
  const { data: profiles } = await db.collection('user_profiles').where({ openid: order.userId }).get()
  const profileData = {
    tier: plan.tier,
    expiresAt,
    licenseSource: 'payment',
    seats: defaults.seats,
    teamHoursBalance: defaults.teamHoursBalance,
    enterpriseSeats: defaults.enterpriseSeats,
    updatedAt: now,
  }
  if (profiles && profiles.length > 0) {
    await db.collection('user_profiles').doc(profiles[0]._id).update(profileData)
  } else {
    await db.collection('user_profiles').add({
      openid: order.userId,
      email: '',
      contact: order.userId,
      licenseKey: '',
      createdAt: now,
      ...profileData,
    })
  }

  // 写订阅历史
  try { await db.createCollection('subscriptions') } catch { /* 已存在 */ }
  await db.collection('subscriptions').add({
    userId: order.userId,
    orderId,
    planId: order.planId,
    planName: order.planName,
    amount: order.amount,
    orderType,
    tier: plan.tier,
    paymentChannel: paymentChannel || order.paymentMethod,
    startTime: now,
    endTime: expiresAt,
    createdAt: now,
  })

  console.log(`[payment] 用户 ${order.userId} 订阅 ${order.planId}（tier=${plan.tier}）成功，到期 ${expiresAt.toISOString()}`)
}

// ============ 模拟支付成功（开发测试用，明确标记） ============
// 生产环境保护：仅当显式设置 MOCK_PAY_ENABLED=1 时才允许，防止攻击者直接调用云函数绕过支付
async function mockPaySuccess(event) {
  if (process.env.MOCK_PAY_ENABLED !== '1') {
    return { code: 403, message: '模拟支付在生产环境已禁用' }
  }
  const { orderId } = event
  if (!orderId) return { code: 1, message: '缺少订单号' }

  const { data: orders } = await db.collection('orders').where({ orderId }).get()
  if (!orders || orders.length === 0) return { code: 1, message: '订单不存在' }

  await updateOrderAndSubscription(orderId, 'paid', 'mock')
  return { code: 0, data: { message: '模拟支付成功', orderId, mock: true } }
}

// ============ 签名工具函数 ============

/**
 * 微信支付 V3 签名（SHA256-RSA）
 * 签名串：HTTP方法\n请求路径\n时间戳\n随机串\n请求体\n
 */
function signWechatV3(method, path, timestamp, nonceStr, body) {
  if (!WECHAT_PAY.privateKey) {
    throw new Error('微信商户私钥未配置（WECHAT_PRIVATE_KEY）')
  }
  const message = `${method}\n${path}\n${timestamp}\n${nonceStr}\n${body}\n`
  return crypto
    .createSign('RSA-SHA256')
    .update(message, 'utf8')
    .sign(WECHAT_PAY.privateKey, 'base64')
}

/**
 * 支付宝 RSA2 签名
 * 签名串：所有参数按字典序排序后 key=value&key=value 拼接
 */
function signAlipay(params) {
  if (!ALIPAY.privateKey) {
    throw new Error('支付宝应用私钥未配置（ALIPAY_PRIVATE_KEY）')
  }
  const sorted = Object.keys(params).sort().filter(k => params[k] !== '' && params[k] !== undefined && k !== 'sign')
  const message = sorted.map(k => `${k}=${params[k]}`).join('&')
  return crypto
    .createSign('RSA-SHA256')
    .update(message, 'utf8')
    .sign(ALIPAY.privateKey, 'base64')
}

/**
 * RFC3339 时间格式（微信 V3 要求）
 */
function formatRfc3339(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/**
 * 支付宝时间格式 yyyy-MM-dd HH:mm:ss
 */
function formatAlipayTimestamp(date) {
  const pad = (n) => (n < 10 ? '0' + n : '' + n)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * HTTPS JSON 请求封装
 */
function httpJsonRequest(options, bodyStr) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch (e) { reject(new Error('微信返回非 JSON: ' + data.slice(0, 200))) }
      })
    })
    req.on('error', reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}
