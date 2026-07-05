/**
 * MetaGO Studio - AI Proxy Cloud Function
 *
 * 代理所有外部 AI API 调用，保护 API Key 不暴露给浏览器端。
 *
 * 支持 action：
 *   - chat:               调用 LLM 对话（DeepSeek/GLM/自定义模型）
 *   - webSearch:          调用博查联网搜索
 *   - recordTokenUsage:   记录 Token 用量到云端（V2 新增）
 *
 * 环境变量（在 CloudBase 控制台配置）：
 *   - DEEPSEEK_API_KEY:  DeepSeek API Key
 *   - GLM_API_KEY:       智谱 GLM API Key
 *   - BOCHA_API_KEY:     博查 API Key
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: 'metago-d6gfw1e4rf2a5bcad' })

// ============ API Key（从环境变量读取，永不硬编码） ============

function getApiKeys() {
  return {
    deepseek: process.env.DEEPSEEK_API_KEY || '',
    glm: process.env.GLM_API_KEY || '',
    bocha: process.env.BOCHA_API_KEY || '',
  }
}

// ============ HTTP 请求封装 ============

/**
 * 发起 HTTPS 请求（Node.js 原生 http 模块，无需额外依赖）
 */
function httpsRequest(url, options = {}) {
  // 动态 require，避免在云端环境加载问题
  const https = require('https')
  const urlObj = new URL(url)

  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }

    const req = https.request(reqOptions, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) })
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data })
        }
      })
    })

    req.on('error', reject)
    req.setTimeout(60000, () => {
      req.destroy(new Error('请求超时'))
    })

    if (options.body) {
      req.write(JSON.stringify(options.body))
    }
    req.end()
  })
}

// ============ 主入口 ============

exports.main = async (event) => {
  const { action } = event

  // 身份验证（Web SDK 的 UID 字段）
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || wxContext.UID || wxContext.APPID
    || event.userInfo?.openid || event.userInfo?.openId || event.userInfo?.uid
    || event.openid || event.uid || event._clientUid

  if (!openid) {
    return { code: 401, message: '未登录' }
  }

  try {
    switch (action) {
      case 'chat':
        return await handleChat(event)
      case 'webSearch':
        return await handleWebSearch(event)
      case 'recordTokenUsage':
        return await handleRecordTokenUsage(event)
      default:
        return { code: 400, message: `未知 action: ${action}` }
    }
  } catch (e) {
    console.error('[aiProxy] error:', e)
    return { code: 500, message: e?.message || 'AI 代理服务异常' }
  }
}

// ============ 对话处理 ============

async function handleChat(event) {
  const {
    modelId, modelType,
    customBaseUrl, customApiKey, customModelName, provider,
    systemPrompt, messages, tools,
  } = event

  let apiUrl, apiKey, requestModel, requestBody, response

  if (modelType === 'custom') {
    // 用户自定义模型：直接透传到用户指定的 API
    apiUrl = `${customBaseUrl.replace(/\/$/, '')}/chat/completions`
    apiKey = customApiKey
    requestModel = customModelName

    requestBody = {
      model: requestModel,
      messages: systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages,
      stream: false,
      max_tokens: 4096,
      ...(tools && tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
    }

    response = await httpsRequest(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...(provider === 'anthropic-compatible'
          ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
          : {}),
      },
      body: requestBody,
    })
  } else if (modelId === 'deepseek-v4-pro') {
    // DeepSeek V4 Pro（支持 function call）
    const keys = getApiKeys()
    apiUrl = 'https://api.deepseek.com/chat/completions'
    apiKey = keys.deepseek
    requestModel = 'deepseek-v4-pro'

    requestBody = {
      model: requestModel,
      messages: systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages,
      ...(tools && tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
      thinking: { type: 'enabled' },
      reasoning_effort: 'high',
      stream: false,
      max_tokens: 8192,
    }

    response = await httpsRequest(apiUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: requestBody,
    })
  } else if (modelId === 'glm-5v-turbo') {
    // GLM-5V Turbo（原生支持 function call）
    const keys = getApiKeys()
    apiUrl = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
    apiKey = keys.glm
    requestModel = 'glm-5v-turbo'

    requestBody = {
      model: requestModel,
      messages: systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages,
      ...(tools && tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
      thinking: { type: 'enabled' },
      stream: false,
      max_tokens: 8192,
    }

    response = await httpsRequest(apiUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: requestBody,
    })
  } else {
    return { code: 400, message: `不支持的模型: ${modelId}` }
  }

  if (response.statusCode !== 200) {
    console.error('[aiProxy] LLM API error:', response.statusCode, response.data)
    return {
      code: 502,
      message: `模型 API 返回错误 (${response.statusCode})`,
      data: null,
    }
  }

  // 解析响应（OpenAI 兼容格式，支持 tool_calls）
  const choice = response.data?.choices?.[0]
  if (!choice) {
    return { code: 500, message: '模型返回为空' }
  }

  return {
    code: 0,
    data: {
      content: choice.message?.content || '',
      reasoning: choice.message?.reasoning_content || '',
      tool_calls: choice.message?.tool_calls || null,
      model: requestModel,
      usage: response.data.usage,
    },
  }
}

// ============ 联网搜索处理 ============

async function handleWebSearch(event) {
  const { query, count = 8 } = event

  if (!query || typeof query !== 'string') {
    return { code: 400, message: '搜索关键词不能为空' }
  }

  const keys = getApiKeys()
  if (!keys.bocha) {
    return { code: 500, message: '博查 API Key 未配置' }
  }

  const response = await httpsRequest('https://api.bochaai.com/v1/web-search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${keys.bocha}`,
    },
    body: {
      query: query.slice(0, 500),
      freshness: 'noLimit',
      summary: true,
      count: Math.min(count, 10),
    },
  })

  if (response.statusCode !== 200) {
    console.error('[aiProxy] Bocha API error:', response.statusCode, response.data)
    return { code: 502, message: '搜索服务异常' }
  }

  // 解析博查返回结构（适配多种格式）
  const rawData = response.data?.data || response.data
  const webPages = rawData?.webPages?.value || rawData?.result || rawData || []
  const results = (Array.isArray(webPages) ? webPages : []).map((item) => ({
    title: item.name || item.title || '',
    url: item.url || item.link || '',
    snippet: item.summary || item.snippet || item.description || '',
    source: item.siteName || item.source || '',
  })).filter(r => r.title || r.url)

  return {
    code: 0,
    data: {
      results,
      total: results.length,
    },
  }
}

// ============ Token 用量记录（V2 新增）============

/**
 * 记录 Token 用量到云端 user_profiles.tokenUsage
 *
 * 数据结构：
 *   user_profiles.tokenUsage = {
 *     monthly: { '2026-07': 1234567, '2026-08': 2345678, ... },
 *     daily:   { '2026-07-05': 12345, ... },
 *     lastUpdatedAt: '2026-07-05T...'
 *   }
 *
 * 策略：
 *   - Free 用户：仅记录 daily（按日累计 10万 tokens 配额）
 *   - Pro/Team：仅记录 monthly（按月累计 500万/2000万配额）
 *   - Enterprise/BYOK：跳过（用户自带 Key，不计平台配额）
 */
async function handleRecordTokenUsage(event) {
  const { usage } = event
  if (!usage || !usage.totalTokens) {
    return { code: 0, data: { recorded: false, reason: 'no usage' } }
  }

  const db = cloud.database()
  const _ = db.command

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)   // '2026-07-05'
  const monthStr = now.toISOString().slice(0, 7)    // '2026-07'

  // 查询用户档案（获取 tier）
  const profileRes = await db.collection('user_profiles').where({ openid }).get()
  const profile = profileRes.data?.[0]
  // V3 数据迁移：旧 trial 用户降级为 free 处理
  let tier = profile?.tier || 'free'
  if (tier === 'trial') tier = 'free'

  // Enterprise 强制 BYOK：跳过计量
  if (tier === 'enterprise') {
    return { code: 0, data: { recorded: false, reason: 'enterprise BYOK' } }
  }

  // 初始化 tokenUsage 字段（不存在则创建）
  const existingUsage = profile?.tokenUsage || { monthly: {}, daily: {} }
  const monthly = { ...(existingUsage.monthly || {}) }
  const daily = { ...(existingUsage.daily || {}) }

  // 累加
  monthly[monthStr] = (monthly[monthStr] || 0) + (usage.totalTokens || 0)
  daily[todayStr] = (daily[todayStr] || 0) + (usage.totalTokens || 0)

  // 写回 user_profiles
  if (profile) {
    await db.collection('user_profiles').where({ openid }).update({
      data: {
        tokenUsage: {
          monthly,
          daily,
          lastUpdatedAt: now,
        },
        updatedAt: now,
      },
    })
  } else {
    // 用户档案不存在（前端已登录但云函数从未创建档案）：创建
    await db.collection('user_profiles').add({
      openid,
      tier: 'free',
      tokenUsage: {
        monthly,
        daily,
        lastUpdatedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    })
  }

  // 同时写入 token_usage_logs 集合（明细审计日志，可独立查询）
  try {
    await db.collection('token_usage_logs').add({
      openid,
      tier,
      model: usage.model || 'unknown',
      promptTokens: usage.promptTokens || 0,
      completionTokens: usage.completionTokens || 0,
      totalTokens: usage.totalTokens || 0,
      cacheHitTokens: usage.cacheHitTokens || 0,
      date: todayStr,
      month: monthStr,
      timestamp: now,
    })
  } catch (e) {
    // 集合不存在时忽略（不影响主流程）
    console.warn('[aiProxy] token_usage_logs 写入失败', e?.message || e)
  }

  return {
    code: 0,
    data: {
      recorded: true,
      tier,
      dailyTotal: daily[todayStr],
      monthlyTotal: monthly[monthStr],
    },
  }
}
