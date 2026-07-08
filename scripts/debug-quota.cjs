/**
 * 调试脚本：查询用户配额状态和 user_profiles 数据
 *
 * 用法：
 *   node scripts/debug-quota.cjs <userId>
 *   node scripts/debug-quota.cjs  // 不传 userId 则查询匿名用户
 */

const https = require('https');

const AIPROXY_URL = 'https://metago-d6gfw1e4rf2a5bcad-1257074864.ap-shanghai.app.tcloudbase.com/api/aiproxy';
const ADMIN_URL = 'https://metago-d6gfw1e4rf2a5bcad-1257074864.ap-shanghai.app.tcloudbase.com/api/admin';

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const bodyStr = JSON.stringify(body);
    const req = https.request({
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('timeout')));
    req.write(bodyStr);
    req.end();
  });
}

async function main() {
  const userId = process.argv[2] || '';
  console.log('=== 配额调试脚本 ===');
  console.log('userId:', userId || '(空)');
  console.log('');

  // 0. 先登录 admin 获取 token
  console.log('--- 0. admin login ---');
  let adminToken = '';
  try {
    const loginRes = await httpsPost(ADMIN_URL, {
      action: 'login',
      username: 'admin',
      password: 'Metago@2026',
    });
    if (loginRes.code === 0 && loginRes.data?.token) {
      adminToken = loginRes.data.token;
      console.log('admin 登录成功, token:', adminToken.slice(0, 30) + '...');
    } else {
      console.log('admin 登录失败:', JSON.stringify(loginRes));
    }
  } catch (e) {
    console.error('admin 登录异常:', e.message);
  }
  console.log('');

  // 1. 查询 aiProxy.getTokenUsage（用指定 userId）
  if (userId) {
    console.log(`--- 1. aiProxy.getTokenUsage (userId=${userId}) ---`);
    try {
      const res = await httpsPost(AIPROXY_URL, {
        action: 'getTokenUsage',
        _clientUid: userId,
      });
      console.log('返回:', JSON.stringify(res, null, 2));
    } catch (e) {
      console.error('失败:', e.message);
    }
    console.log('');

    console.log(`--- 2. aiProxy.checkQuota (userId=${userId}) ---`);
    try {
      const res = await httpsPost(AIPROXY_URL, {
        action: 'checkQuota',
        _clientUid: userId,
        modelId: 'deepseek-v4-pro',
        modelType: 'reasoning',
      });
      console.log('返回:', JSON.stringify(res, null, 2));
    } catch (e) {
      console.error('失败:', e.message);
    }
    console.log('');
  }

  // 3. 通过 admin 云函数查询 user_profiles
  if (adminToken) {
    console.log('--- 3. admin.listUsers (查询 user_profiles) ---');
    try {
      const res = await httpsPost(ADMIN_URL, {
        action: 'listUsers',
        adminToken,
        page: 1,
        pageSize: 30,
      });
      if (res.code === 0 && res.data) {
        const users = res.data.users || [];
        console.log(`用户总数: ${res.data.total || users.length}`);
        for (const u of users) {
          console.log(`  - openid: ${u.openid || 'N/A'} tier: ${u.tier || 'N/A'} phone: ${u.phone || 'N/A'} email: ${u.email || 'N/A'} licenseKey: ${u.licenseKey || 'N/A'}`);
        }
      } else {
        console.log('返回:', JSON.stringify(res, null, 2));
      }
    } catch (e) {
      console.error('失败:', e.message);
    }
    console.log('');

    // 4. 通过 admin 云函数查询 licenses
    console.log('--- 4. admin.listLicenses (查询授权码) ---');
    try {
      const res = await httpsPost(ADMIN_URL, {
        action: 'listLicenses',
        adminToken,
        page: 1,
        pageSize: 20,
      });
      if (res.code === 0 && res.data) {
        const licenses = res.data.licenses || res.data || [];
        console.log(`授权码总数: ${Array.isArray(licenses) ? licenses.length : '未知'}`);
        if (Array.isArray(licenses)) {
          for (const l of licenses) {
            console.log(`  - key: ${l.licenseKey} status: ${l.status} plan: ${l.plan || l.tier || 'N/A'} usedBy: ${l.usedBy || 'N/A'}`);
          }
        }
      } else {
        console.log('返回:', JSON.stringify(res, null, 2));
      }
    } catch (e) {
      console.error('失败:', e.message);
    }
  }
}

main().catch(console.error);
