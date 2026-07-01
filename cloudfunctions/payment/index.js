/**
 * MetaGO Studio - Payment Cloud Function
 * 微信支付集成：创建订单 + 支付回调 + 授权码生成
 * 环境变量（CloudBase控制台配置）:
 *   - WX_MCH_ID: 微信支付商户号
 *   - WX_API_KEY: 微信支付API密钥
 *   - WX_APP_ID: 微信AppID（公众号或小程序）
 *   - ADMIN_OPENID: 管理员openid（用于授权码生成）
 */

const crypto = require('crypto')
const https = require('https')
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const PLAN_CONFIG = {
  monthly: { price: 3900, name: 'Pro月度订阅', days: 30 },
  yearly: { price: 39000, name: 'Pro年度订阅', days: 365 },
  trial: { price: 0, name: '14天免费试用', days: 14 },
}

function getWxConfig() {
  return {
    mchId: process.env.WX_MCH_ID || '',
    apiKey: process.env.WX_API_KEY || '',
    appId: process.env.WX_APP_ID || '',
  }
}

function isConfigured() {
  const c = getWxConfig()
  return Boolean(c.mchId && c.apiKey && c.appId)
}

function generateLicenseKey() {
  const raw = crypto.randomBytes(24).toString('hex').toUpperCase()
  const parts = []
  for (let i = 0; i < raw.length; i += 4) {
    parts.push(raw.slice(i, i + 4))
  }
  return 'META-' + parts.slice(0, 5).join('-')
}

function generateSign(params, apiKey) {
  const sorted = Object.keys(params).sort().filter(k => params[k] !== '' && k !== 'sign')
  const str = sorted.map(k => `${k}=${params[k]}`).join('&') + `&key=${apiKey}`
  return crypto.createHash('md5').update(str, 'utf8').digest('hex').toUpperCase()
}

function xmlBuild(params) {
  let xml = '<xml>'
  for (const [k, v] of Object.entries(params)) {
    xml += `<${k}><![CDATA[${v}]]></${k}>`
  }
  xml += '</xml>'
  return xml
}

function xmlParse(xml) {
  const result = {}
  const regex = /<!\[CDATA\[([^\]]*)\]\]><\/([^>]+)>/g
  let match
  while ((match = regex.exec(xml)) !== null) {
    result[match[2]] = match[1]
  }
  return result
}

async function createWxPayOrder(params) {
  return new Promise((resolve, reject) => {
    const xml = xmlBuild(params)
    const options = {
      hostname: 'api.mch.weixin.qq.com',
      path: '/pay/unifiedorder',
      method: 'POST',
      headers: { 'Content-Type': 'application/xml', 'Content-Length': Buffer.byteLength(xml) },
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(xmlParse(data)) } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.write(xml)
    req.end()
  })
}

exports.main = async (event) => {
  const { action, userInfo } = event
  const openid = userInfo?.openid || event.openid

  if (!openid) {
    return { code: 401, message: '未登录' }
  }

  const db = await cloud.database()

  switch (action) {
    case 'createOrder': {
      const { plan } = event
      const config = PLAN_CONFIG[plan]
      if (!config) return { code: 400, message: '无效的套餐' }

      // 试用直接激活
      if (plan === 'trial') {
        const licenseKey = generateLicenseKey()
        const now = Date.now()
        const expiresAt = now + config.days * 24 * 60 * 60 * 1000

        await db.collection('user_profiles').where({ openid }).update({
          tier: 'pro',
          licenseKey,
          licenseSource: 'trial',
          expiresAt: new Date(expiresAt),
          updatedAt: new Date(),
        })

        await db.collection('orders').add({
          orderId: `trial_${now}`,
          openid,
          plan,
          amount: 0,
          status: 'completed',
          licenseKey,
          createdAt: new Date(),
        })

        return { code: 0, data: { licenseKey, expiresAt, plan } }
      }

      // 付费订单
      if (!isConfigured()) {
        return { code: 503, message: '支付未配置，请联系管理员' }
      }

      const wxConfig = getWxConfig()
      const orderId = `META${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      const nonceStr = crypto.randomBytes(16).toString('hex')
      const notifyUrl = `https://metago.life/api/payment/notify`

      const signParams = {
        appid: wxConfig.appId,
        mch_id: wxConfig.mchId,
        nonce_str: nonceStr,
        body: config.name,
        out_trade_no: orderId,
        total_fee: config.price,
        spbill_create_ip: '127.0.0.1',
        notify_url: notifyUrl,
        trade_type: 'NATIVE',
        product_id: plan,
      }
      signParams.sign = generateSign(signParams, wxConfig.apiKey)

      try {
        const wxRes = await createWxPayOrder(signParams)
        if (wxRes.return_code === 'SUCCESS' && wxRes.result_code === 'SUCCESS') {
          await db.collection('orders').add({
            orderId,
            openid,
            plan,
            amount: config.price,
            status: 'pending',
            wxPrepayId: wxRes.prepay_id,
            wxCodeUrl: wxRes.code_url,
            createdAt: new Date(),
          })
          return { code: 0, data: { orderId, codeUrl: wxRes.code_url, amount: config.price } }
        }
        return { code: 500, message: wxRes.return_msg || '微信支付下单失败' }
      } catch (e) {
        return { code: 500, message: '支付服务异常: ' + e.message }
      }
    }

    case 'notify': {
      // 微信支付回调
      const { orderId } = event
      if (!orderId) return { code: 400, message: '缺少订单号' }

      const orderRes = await db.collection('orders').where({ orderId, openid }).get()
      if (!orderRes.data || orderRes.data.length === 0) {
        return { code: 404, message: '订单不存在' }
      }

      const order = orderRes.data[0]
      if (order.status === 'completed') {
        return { code: 0, message: '订单已处理' }
      }

      const config = PLAN_CONFIG[order.plan]
      const licenseKey = generateLicenseKey()
      const now = Date.now()
      const expiresAt = now + config.days * 24 * 60 * 60 * 1000

      await db.collection('orders').doc(order._id).update({
        status: 'completed',
        paidAt: new Date(),
        licenseKey,
      })

      await db.collection('user_profiles').where({ openid }).update({
        tier: 'pro',
        licenseKey,
        licenseSource: 'payment',
        expiresAt: new Date(expiresAt),
        updatedAt: new Date(),
      })

      return { code: 0, data: { licenseKey, expiresAt } }
    }

    case 'queryOrder': {
      const { orderId } = event
      const res = await db.collection('orders').where({ orderId, openid }).get()
      if (!res.data || res.data.length === 0) {
        return { code: 404, message: '订单不存在' }
      }
      return { code: 0, data: res.data[0] }
    }

    case 'generateLicense': {
      // 管理员手动生成授权码
      const ADMIN_OPENID = process.env.ADMIN_OPENID || ''
      if (openid !== ADMIN_OPENID) {
        return { code: 403, message: '无权限' }
      }
      const { plan = 'monthly', count = 1, note = '' } = event
      const config = PLAN_CONFIG[plan]
      const licenses = []
      for (let i = 0; i < count; i++) {
        const key = generateLicenseKey()
        const expiresAt = Date.now() + config.days * 24 * 60 * 60 * 1000
        await db.collection('licenses').add({
          licenseKey: key,
          plan,
          expiresAt: new Date(expiresAt),
          status: 'unused',
          note,
          createdBy: openid,
          createdAt: new Date(),
        })
        licenses.push({ key, expiresAt })
      }
      return { code: 0, data: { licenses } }
    }

    default:
      return { code: 400, message: '未知操作' }
  }
}
