/**
 * MetaGO Studio - GitHub OAuth Cloud Function
 * 处理GitHub OAuth回调，交换access_token，获取用户信息
 * 环境变量:
 *   - GITHUB_CLIENT_ID: GitHub OAuth App Client ID
 *   - GITHUB_CLIENT_SECRET: GitHub OAuth App Client Secret
 *   - REDIRECT_URI: 回调地址 (https://metago.life/api/github-oauth)
 */

const cloud = require('wx-server-sdk')
const https = require('https')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: { 'User-Agent': 'MetaGO-Studio', ...headers },
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, data: JSON.parse(data) }) }
        catch { resolve({ statusCode: res.statusCode, data: { raw: data } }) }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

function httpsPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const postData = typeof body === 'string' ? body : JSON.stringify(body)
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'MetaGO-Studio',
        ...headers,
      },
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, data: JSON.parse(data) }) }
        catch { resolve({ statusCode: res.statusCode, data: { raw: data } }) }
      })
    })
    req.on('error', reject)
    req.write(postData)
    req.end()
  })
}

exports.main = async (event) => {
  const { action, userInfo } = event
  const openid = userInfo?.openid || event.openid

  if (!openid) return { code: 401, message: '未登录' }

  const db = cloud.database()

  switch (action) {
    case 'getAuthUrl': {
      const clientId = process.env.GITHUB_CLIENT_ID || ''
      const redirectUri = process.env.REDIRECT_URI || 'https://metago.life/api/github-oauth'
      const scope = 'read:user user:email'
      const state = crypto.randomBytes(16).toString('hex')
      const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`
      return { code: 0, data: { authUrl, state } }
    }

    case 'exchangeToken': {
      const { code, state } = event
      if (!code) return { code: 400, message: '缺少授权码' }

      const clientId = process.env.GITHUB_CLIENT_ID || ''
      const clientSecret = process.env.GITHUB_CLIENT_SECRET || ''

      if (!clientId || !clientSecret) {
        return { code: 503, message: 'GitHub OAuth未配置' }
      }

      // 交换access_token
      const tokenRes = await httpsPost('https://github.com/login/oauth/access_token', {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        state,
      }, { Accept: 'application/json' })

      if (tokenRes.statusCode !== 200 || !tokenRes.data.access_token) {
        return { code: 401, message: 'GitHub授权失败', detail: tokenRes.data }
      }

      const accessToken = tokenRes.data.access_token

      // 获取用户信息
      const userRes = await httpsGet('https://api.github.com/user', {
        Authorization: `Bearer ${accessToken}`,
      })

      if (userRes.statusCode !== 200) {
        return { code: 500, message: '获取GitHub用户信息失败' }
      }

      const ghUser = userRes.data

      // 获取邮箱（如果user邮箱是私有的）
      let email = ghUser.email
      if (!email) {
        const emailRes = await httpsGet('https://api.github.com/user/emails', {
          Authorization: `Bearer ${accessToken}`,
        })
        if (emailRes.statusCode === 200 && Array.isArray(emailRes.data)) {
          const primaryEmail = emailRes.data.find(e => e.primary)
          email = primaryEmail?.email || emailRes.data[0]?.email
        }
      }

      // 更新用户档案
      const now = new Date()
      await db.collection('user_profiles').where({ openid }).update({
        data: {
          githubId: ghUser.id,
          githubLogin: ghUser.login,
          githubAvatar: ghUser.avatar_url,
          displayName: ghUser.name || ghUser.login,
          email: email,
          githubLinkedAt: now,
          updatedAt: now,
        }
      })

      return {
        code: 0,
        data: {
          githubId: ghUser.id,
          login: ghUser.login,
          name: ghUser.name,
          avatar: ghUser.avatar_url,
          email,
        },
      }
    }

    case 'unlink': {
      await db.collection('user_profiles').where({ openid }).update({
        data: {
          githubId: null,
          githubLogin: null,
          githubAvatar: null,
          githubLinkedAt: null,
          updatedAt: new Date(),
        }
      })
      return { code: 0, message: '已解绑GitHub' }
    }

    default:
      return { code: 400, message: '未知操作' }
  }
}
