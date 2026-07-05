/**
 * MetaGO Studio - BYOK Cloud Function
 *
 * 用户自带 API Key 管理（Bring Your Own Key）
 *
 * 支持 action：
 *   - syncBinding     同步 BYOK 绑定元信息到云端（仅元信息，不存密文）
 *   - unbind          解绑 BYOK
 *   - validateKey     验证 API Key 有效性（测试调用）
 *   - getBinding      查询当前用户的 BYOK 绑定状态
 *
 * 安全设计：
 *   - 永不存储明文 API Key（密文由前端 AES-GCM 加密后存 localStorage）
 *   - 云端只存"绑定元信息"（provider / baseUrl / model / boundAt），用于：
 *     a) 多端同步"是否已绑定"状态
 *     b) 审计日志
 *     c) aiProxy 路由判断
 *   - 实际 API Key 解密在前端进行，通过临时参数传递给 aiProxy
 *
 * V3 档位策略：
 *   - free：不允许 BYOK → syncBinding 返回 403
 *   - pro / pro_plus / team：允许 BYOK（作为超额替代）
 *   - enterprise：强制 BYOK（必须绑定才能使用 AI）
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// ============ 主入口 ============

exports.main = async (event) => {
  // HTTP 触发兼容
  if (event.httpMethod && event.body) {
    try {
      const parsed = JSON.parse(event.body)
      event = { ...event, ...parsed }
    } catch { /* body 不是 JSON */ }
  }

  const { action } = event

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || wxContext.UID || wxContext.APPID
    || event.userInfo?.openid || event.userInfo?.openId || event.userInfo?.uid
    || event.openid || event.uid || event._clientUid

  if (!openid) {
    return { code: 401, message: '未登录，无法获取用户身份' }
  }

  const db = cloud.database()
  const now = new Date()

  // 确保集合存在
  try { await db.createCollection('user_profiles') } catch { /* 已存在 */ }
  try { await db.createCollection('byok_bindings') } catch { /* 已存在 */ }

  switch (action) {
    case 'syncBinding':
      return await handleSyncBinding(event, openid, db, now)
    case 'unbind':
      return await handleUnbind(openid, db, now)
    case 'validateKey':
      return await handleValidateKey(event)
    case 'getBinding':
      return await handleGetBinding(openid, db)
    default:
      return { code: 400, message: `未知 action: ${action}` }
  }
}

// ============ Handlers ============

/**
 * 同步 BYOK 绑定元信息到云端
 * 仅存 provider/baseUrl/model/boundAt，不存 API Key 密文
 */
async function handleSyncBinding(event, openid, db, now) {
  const { provider, baseUrl, model } = event

  if (!provider) {
    return { code: 400, message: '缺少 provider 参数' }
  }

  // 查询用户档案，检查 tier 是否允许 BYOK
  const profileRes = await db.collection('user_profiles').where({ openid }).get()
  const profile = profileRes.data?.[0]
  const tier = profile?.tier || 'free'

  if (!isByokAllowed(tier)) {
    return {
      code: 403,
      message: `${tier} 档位不支持 BYOK，仅 Pro/Pro+/Team/Enterprise 可绑定`,
    }
  }

  // 写入 byok_bindings 集合（绑定元信息）
  const bindingRes = await db.collection('byok_bindings').where({ openid }).get()
  const existing = bindingRes.data?.[0]

  const bindingData = {
    openid,
    provider,
    baseUrl: baseUrl || '',
    model: model || '',
    boundAt: now,
    updatedAt: now,
    active: true,
  }

  if (existing) {
    await db.collection('byok_bindings').where({ openid }).update({ data: bindingData })
  } else {
    bindingData.createdAt = now
    await db.collection('byok_bindings').add(bindingData)
  }

  // 同时在 user_profiles 标记 byokBound = true（供 aiProxy 快速判断）
  if (profile) {
    await db.collection('user_profiles').where({ openid }).update({
      data: {
        byokBound: true,
        byokProvider: provider,
        byokBoundAt: now,
        updatedAt: now,
      },
    })
  }

  return {
    code: 0,
    data: {
      synced: true,
      provider,
      boundAt: now.toISOString(),
    },
    message: 'BYOK 绑定已同步到云端',
  }
}

/**
 * 解绑 BYOK
 */
async function handleUnbind(openid, db, now) {
  // 更新 byok_bindings
  const bindingRes = await db.collection('byok_bindings').where({ openid }).get()
  if (bindingRes.data?.[0]) {
    await db.collection('byok_bindings').where({ openid }).update({
      data: {
        active: false,
        unboundAt: now,
        updatedAt: now,
      },
    })
  }

  // 更新 user_profiles
  await db.collection('user_profiles').where({ openid }).update({
    data: {
      byokBound: false,
      byokProvider: '',
      updatedAt: now,
    },
  }).catch(() => { /* 用户档案不存在时忽略 */ })

  return {
    code: 0,
    data: { unbound: true },
    message: 'BYOK 已解绑',
  }
}

/**
 * 验证 API Key 有效性
 * 通过最小测试调用确认 Key 可用
 */
async function handleValidateKey(event) {
  const { provider, apiKey, baseUrl } = event

  if (!apiKey || !provider) {
    return { code: 400, message: '缺少 apiKey 或 provider' }
  }

  try {
    const result = await testApiKey(provider, apiKey, baseUrl)
    return {
      code: 0,
      data: {
        valid: result.valid,
        message: result.message,
        model: result.model,
      },
    }
  } catch (e) {
    return {
      code: 0,
      data: {
        valid: false,
        message: e?.message || '验证失败',
      },
    }
  }
}

/**
 * 查询当前用户的 BYOK 绑定状态
 */
async function handleGetBinding(openid, db) {
  const bindingRes = await db.collection('byok_bindings').where({ openid, active: true }).get()
  const binding = bindingRes.data?.[0]

  if (!binding) {
    return {
      code: 0,
      data: {
        bound: false,
      },
    }
  }

  return {
    code: 0,
    data: {
      bound: true,
      provider: binding.provider,
      baseUrl: binding.baseUrl,
      model: binding.model,
      boundAt: binding.boundAt ? new Date(binding.boundAt).toISOString() : null,
    },
  }
}

// ============ 辅助函数 ============

function isByokAllowed(tier) {
  // V3：free 不允许 BYOK；pro/pro_plus/team 允许；enterprise 强制
  return tier === 'pro' || tier === 'pro_plus' || tier === 'team' || tier === 'enterprise'
}

/**
 * 测试 API Key 是否有效
 * 通过最小请求（model list 或 1-token 对话）验证
 */
async function testApiKey(provider, apiKey, baseUrl) {
  const https = require('https')

  const endpoints = {
    deepseek: {
      url: 'https://api.deepseek.com/chat/completions',
      body: {
        model: 'deepseek-v4-pro',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      },
      authHeader: { Authorization: `Bearer ${apiKey}` },
    },
    openai: {
      url: baseUrl ? `${baseUrl.replace(/\/$/, '')}/chat/completions` : 'https://api.openai.com/v1/chat/completions',
      body: {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      },
      authHeader: { Authorization: `Bearer ${apiKey}` },
    },
    anthropic: {
      url: 'https://api.anthropic.com/v1/messages',
      body: {
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      },
      authHeader: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
    },
    glm: {
      url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      body: {
        model: 'glm-5v-turbo',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      },
      authHeader: { Authorization: `Bearer ${apiKey}` },
    },
  }

  const config = endpoints[provider]
  if (!config) {
    return { valid: false, message: `不支持的 provider: ${provider}` }
  }

  return new Promise((resolve) => {
    const urlObj = new URL(config.url)
    const postData = JSON.stringify(config.body)

    const req = https.request({
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...config.authHeader,
      },
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        // 200 = Key 有效
        if (res.statusCode === 200) {
          resolve({
            valid: true,
            message: 'API Key 验证通过',
            model: config.body.model,
          })
          return
        }
        // 401/403 = Key 无效或权限不足
        if (res.statusCode === 401 || res.statusCode === 403) {
          resolve({
            valid: false,
            message: `API Key 无效或权限不足 (${res.statusCode})`,
          })
          return
        }
        // 其他状态码（429 限流、400 参数错误等）：Key 本身可能有效，但请求被拒
        // 保守起见视为有效（Key 通过认证但触发其他限制）
        if (res.statusCode === 429 || res.statusCode === 400) {
          resolve({
            valid: true,
            message: `API Key 有效（${res.statusCode}: 请求被拒，但认证通过）`,
            model: config.body.model,
          })
          return
        }
        resolve({
          valid: false,
          message: `验证失败 (${res.statusCode}): ${data.slice(0, 200)}`,
        })
      })
    })

    req.on('error', (e) => {
      resolve({
        valid: false,
        message: `网络错误: ${e.message}`,
      })
    })

    req.setTimeout(15000, () => {
      req.destroy(new Error('验证超时'))
      resolve({ valid: false, message: '验证超时（15s）' })
    })

    req.write(postData)
    req.end()
  })
}
