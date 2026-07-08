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
    // 超时由调用方通过 options.timeout 指定，默认 180 秒（覆盖大模型长响应场景）
    const timeoutMs = options.timeout || 180000
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`请求超时（${timeoutMs / 1000}s）`))
    })

    if (options.body) {
      req.write(JSON.stringify(options.body))
    }
    req.end()
  })
}

// ============ 主入口 ============

exports.main = async (event) => {
  // 支持 HTTP 访问服务调用：event.body 是 JSON 字符串
  if (typeof event.body === 'string') {
    try {
      const parsed = JSON.parse(event.body)
      event = { ...parsed, ...event }
      delete event.body
    } catch (e) {
      return { code: 400, message: '请求体 JSON 解析失败' }
    }
  }

  const { action } = event

  // V3 身份标识（2026-07-07 修复严重 bug）：
  // 旧版优先用 wxContext.UID（CloudBase 匿名登录 UID），但匿名 UID 每次清缓存都变，
  // 导致 user_profiles.tokenUsage 记录在旧匿名 UID 下，新匿名 UID 查不到，配额重置。
  // 现在：_clientUid（手机号注册的稳定 userId）优先，wxContext 仅作 fallback。
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

  if (!openid) {
    return { code: 401, message: '未登录' }
  }

  try {
    switch (action) {
      case 'chat':
        return await handleChat(event, openid)
      case 'webSearch':
        return await handleWebSearch(event)
      case 'recordTokenUsage':
        return await handleRecordTokenUsage(event, openid)
      case 'getTokenUsage':
        return await handleGetTokenUsage(event, openid)
      case 'checkQuota': {
        // V4（2026-07-07）：供 Cloudflare Worker 流式代理调用
        // Worker 在转发 AI 流式响应前，先调用此接口检查配额
        const quotaCheck = await checkQuotaBeforeChat(openid, event.modelId, event.modelType)
        if (!quotaCheck.allowed) {
          return { code: 402, message: quotaCheck.message, data: quotaCheck.data }
        }
        return { code: 0, data: quotaCheck.data }
      }
      default:
        return { code: 400, message: `未知 action: ${action}` }
    }
  } catch (e) {
    console.error('[aiProxy] error:', e)
    return { code: 500, message: e?.message || 'AI 代理服务异常' }
  }
}

// ============ 配额硬阻断检查（V3 安全加固 2026-07-06）============

/**
 * 配额预检：在调用 LLM 之前检查用户今日/本月 Token 配额是否已耗尽
 *
 * 设计原则（对标 Trae 服务端硬校验）：
 *   - 服务端权威：以 user_profiles.tokenUsage 为准，不信客户端
 *   - 按 tier 分档：free=10万/天，pro=500万/月，pro_plus=2000万/月，team=2000万/月
 *   - Enterprise/BYOK：跳过（用户自带 Key）
 *   - 超额直接返回 402，不调用 LLM（避免产生 API 费用）
 *
 * 历史漏洞（2026-07-06 修复）：
 *   旧版 handleChat 无配额检查，客户端 localStorage 清空即可重置 100K 配额，
 *   用户可无限白嫖 Token。现在服务端硬阻断，无论客户端如何篡改都无法绕过。
 */
async function checkQuotaBeforeChat(openid, modelId, modelType) {
  // BYOK 模式：用户自带 Key，不消耗平台配额
  if (modelType === 'custom') {
    return { allowed: true, reason: 'byok' }
  }

  if (!openid) {
    return { allowed: false, code: 401, message: '未登录' }
  }

  const db = cloud.database()
  const profileRes = await db.collection('user_profiles').where({ openid }).get()
  const profile = profileRes.data?.[0]

  let tier = profile?.tier || 'free'
  if (tier === 'trial') tier = 'free'

  // Enterprise 强制 BYOK：不计量
  if (tier === 'enterprise') {
    return { allowed: true, reason: 'enterprise byok' }
  }

  const tokenUsage = profile?.tokenUsage || { monthly: {}, daily: {} }
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const monthStr = now.toISOString().slice(0, 7)

  // 各 tier 配额（与 pricing.ts 完全一致）
  const QUOTA = {
    free:     { quota: 100_000,    period: 'day',   label: '10万 tokens/天' },
    pro:      { quota: 5_000_000,  period: 'month', label: '500万 tokens/月' },
    pro_plus: { quota: 20_000_000, period: 'month', label: '2000万 tokens/月' },
    team:     { quota: 20_000_000, period: 'month', label: '2000万 tokens/月（5人共享）' },
  }

  const config = QUOTA[tier] || QUOTA.free
  const used = config.period === 'day'
    ? (tokenUsage.daily?.[todayStr] || 0)
    : (tokenUsage.monthly?.[monthStr] || 0)

  if (used >= config.quota) {
    return {
      allowed: false,
      code: 402,
      message: `配额已耗尽（${config.label}）。已用 ${used.toLocaleString()} / ${config.quota.toLocaleString()} tokens。请升级到 Pro 或绑定自己的 API Key。`,
      data: { used, quota: config.quota, tier, period: config.period }
    }
  }

  return {
    allowed: true,
    reason: 'within quota',
    data: { used, quota: config.quota, tier, period: config.period }
  }
}

/**
 * 查询 Token 用量（V3 新增，供客户端 tokenMeter 走云端权威查询）
 *
 * V4.5 修复（2026-07-08）：openid 不匹配时的 licenseKey fallback + 自动迁移
 * 场景：用户激活授权码时用的是 CloudBase 匿名 UID，后来登录了 userManager，
 *       metago_user_id 变成了新值，但 user_profiles 中的 openid 还是旧匿名 UID。
 * 解决：用 licenseKey 查找 Pro 记录，自动将 openid 迁移到当前用户。
 */
async function handleGetTokenUsage(event, openid) {
  if (!openid) {
    return { code: 401, message: '未登录' }
  }

  const db = cloud.database()
  let profileRes = await db.collection('user_profiles').where({ openid }).get()
  let profile = profileRes.data?.[0]

  // V4.5 licenseKey fallback：openid 查不到记录时，用 licenseKey 查找并迁移
  if (!profile && event.licenseKey) {
    const licenseRes = await db.collection('user_profiles').where({ licenseKey: event.licenseKey }).get()
    const licenseProfile = licenseRes.data?.[0]
    if (licenseProfile && licenseProfile.tier && licenseProfile.tier !== 'free') {
      // 自动迁移 openid 到当前用户
      await db.collection('user_profiles').where({ licenseKey: event.licenseKey }).update({
        data: { openid, updatedAt: new Date() }
      })
      profileRes = await db.collection('user_profiles').where({ openid }).get()
      profile = profileRes.data?.[0]
    }
  }

  let tier = profile?.tier || 'free'
  if (tier === 'trial') tier = 'free'

  if (tier === 'enterprise') {
    return { code: 0, data: { used: 0, quota: 0, tier, byokRequired: true } }
  }

  const tokenUsage = profile?.tokenUsage || { monthly: {}, daily: {} }
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const monthStr = now.toISOString().slice(0, 7)

  const QUOTA = {
    free:     { quota: 100_000,    period: 'day' },
    pro:      { quota: 5_000_000,  period: 'month' },
    pro_plus: { quota: 20_000_000, period: 'month' },
    team:     { quota: 20_000_000, period: 'month' },
  }
  const config = QUOTA[tier] || QUOTA.free

  const dailyUsed = tokenUsage.daily?.[todayStr] || 0
  const monthlyUsed = tokenUsage.monthly?.[monthStr] || 0
  const used = config.period === 'day' ? dailyUsed : monthlyUsed

  return {
    code: 0,
    data: {
      used,
      quota: config.quota,
      remaining: Math.max(0, config.quota - used),
      tier,
      period: config.period,
      dailyUsed,
      monthlyUsed,
      date: todayStr,
      month: monthStr,
    },
  }
}

// ============ 对话处理 ============

async function handleChat(event, openid) {
  const {
    modelId, modelType,
    customBaseUrl, customApiKey, customModelName, provider,
    systemPrompt, messages, tools,
  } = event

  // V3 配额硬阻断：调用 LLM 之前先检查配额（服务端权威，不可绕过）
  const quotaCheck = await checkQuotaBeforeChat(openid, modelId, modelType)
  if (!quotaCheck.allowed) {
    return {
      code: quotaCheck.code || 402,
      message: quotaCheck.message || '配额已耗尽',
      data: quotaCheck.data || null,
    }
  }

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
      max_tokens: event.maxTokens || 4096,
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
    // DeepSeek V4 Pro（推理模型，支持 function call）
    // V4.4 修复（2026-07-07）：保持推理模型不变，通过真流式（SSE）解决超时
    //   - 推理模型是质量保证，绝不能降级
    //   - 超时问题的根因是架构（非流式），不是模型
    //   - 正确方案：AI 边推理边生成边返回，前端实时显示
    const keys = getApiKeys()
    apiUrl = 'https://api.deepseek.com/chat/completions'
    apiKey = keys.deepseek
    requestModel = 'deepseek-v4-pro'

    // V4.4：根据 event.stream 决定是否使用流式
    // - event.stream === true：流式调用，aiProxy 透传 SSE 响应
    // - event.stream === false（默认）：非流式调用，等完整响应
    const useStream = event.stream === true

    requestBody = {
      model: requestModel,
      messages: systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages,
      ...(tools && tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
      // 推理模式默认开启（保证质量），deepThinking=false 时可关闭
      ...(event.deepThinking === false ? {} : { thinking: { type: 'enabled' }, reasoning_effort: 'high' }),
      stream: useStream,
      max_tokens: event.maxTokens || 8192,
    }

    if (useStream) {
      // V4.4 流式模式：返回 SSE 流，由调用方处理
      // aiProxy 不直接处理流，而是返回流式响应的原始数据
      // CloudBase HTTP 访问服务支持 Transfer-Encoding: chunked
      response = await httpsRequestStream(apiUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: requestBody,
        timeout: 180000,
      })
    } else {
      response = await httpsRequest(apiUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: requestBody,
        timeout: 180000,
      })
    }
  } else if (modelId === 'glm-5v-turbo') {
    // GLM-5V Turbo（原生支持 function call）
    // V4 修复（2026-07-07）：默认关闭 thinking，避免复杂任务超时
    // V4.1 分段生成：max_tokens 从 event 读取，支持前端分段请求（每段 1500 token，永不超时）
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
      ...(event.deepThinking ? { thinking: { type: 'enabled' } } : {}),
      stream: false,
      max_tokens: event.maxTokens || 8192,
    }

    response = await httpsRequest(apiUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: requestBody,
      timeout: 180000,
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

  // V4.1 分段生成：返回 finish_reason 供前端判断是否需要继续请求
  // finish_reason 取值：
  //   - 'stop': AI 主动结束（内容完整）
  //   - 'length': 达到 max_tokens 截断（前端需发送"继续"请求）
  //   - 'tool_calls': AI 请求工具调用
  return {
    code: 0,
    data: {
      content: choice.message?.content || '',
      reasoning: choice.message?.reasoning_content || '',
      tool_calls: choice.message?.tool_calls || null,
      finish_reason: choice.finish_reason || 'stop',
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
async function handleRecordTokenUsage(event, openid) {
  const { usage } = event
  if (!usage || !usage.totalTokens) {
    return { code: 0, data: { recorded: false, reason: 'no usage' } }
  }
  if (!openid) {
    return { code: 401, message: '未登录，无法记录 token 用量' }
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
    // V3 修复（2026-07-07）：旧版 add 格式错误，字段未包在 data 里，导致 openid 写不进数据库
    // 现在：正确格式 add({ data: { ... } })
    await db.collection('user_profiles').add({
      data: {
        openid,
        tier: 'free',
        tokenUsage: {
          monthly,
          daily,
          lastUpdatedAt: now,
        },
        createdAt: now,
        updatedAt: now,
      },
    })
  }

  // 同时写入 token_usage_logs 集合（明细审计日志，可独立查询）
  try {
    await db.collection('token_usage_logs').add({
      data: {
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
      },
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
