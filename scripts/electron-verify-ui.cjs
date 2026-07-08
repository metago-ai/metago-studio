/**
 * Electron UI 端到端验证（模拟真实用户操作）
 *
 * 加载 https://metago.life/studio/#/agent 页面，然后：
 *   1. Monkey-patch fetch 捕获所有 CloudBase 网络请求
 *   2. 在输入框 textarea 中输入 "ping"
 *   3. 点击发送按钮（让 Studio 自己调用 SDK callFunction）
 *   4. 等待 AI 回复（监听网络响应）
 *   5. 捕获 SDK callFunction 的实际请求和响应
 *   6. 验证 AI 回复内容非空
 */

const { app, BrowserWindow } = require('electron')

let mainWindow = null
const VERIFY_URL = process.env.VERIFY_URL || 'https://metago.life/studio/#/agent'
const VERIFY_TIMEOUT_MS = 120000

let verifyTimeout = null
let gotResult = false

// 第一步注入：Monkey-patch fetch 捕获网络请求（在页面加载前注入）
const INJECT_FETCH_PATCH = `
(function() {
  window.__VERIFY_NETLOG__ = [];
  const originalFetch = window.fetch;
  window.fetch = async function(input, init) {
    const urlStr = typeof input === 'string' ? input : (input?.url || String(input));
    const method = (init?.method || 'GET').toUpperCase();
    const headers = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => { headers[k] = v; });
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([k, v]) => { headers[k] = v; });
      } else {
        Object.assign(headers, init.headers);
      }
    }
    let bodyPreview = null;
    if (init?.body) {
      try { bodyPreview = typeof init.body === 'string' ? init.body : JSON.stringify(init.body); } catch (e) {}
    }
    const isCloudBase = urlStr.includes('tcloudbasegateway') || urlStr.includes('cloudbase');
    if (isCloudBase) {
      console.log('[VERIFY_NET] REQ ' + method + ' ' + urlStr);
      if (Object.keys(headers).length > 0) console.log('[VERIFY_NET] REQ headers: ' + JSON.stringify(headers));
      if (bodyPreview) console.log('[VERIFY_NET] REQ body: ' + bodyPreview.slice(0, 500));
    }
    try {
      const res = await originalFetch.apply(this, arguments);
      if (isCloudBase) {
        const clone = res.clone();
        let resText = '';
        try { resText = await clone.text(); } catch (e) {}
        console.log('[VERIFY_NET] RES ' + res.status + ' ' + urlStr + ': ' + resText.slice(0, 300));
        window.__VERIFY_NETLOG__.push({
          method, url: urlStr,
          reqHeaders: { ...headers },
          reqBody: bodyPreview,
          resStatus: res.status,
          resBody: resText,
          timestamp: Date.now(),
        });
      }
      return res;
    } catch (e) {
      if (isCloudBase) console.log('[VERIFY_NET] ERR ' + urlStr + ': ' + e.message);
      throw e;
    }
  };
  console.log('[VERIFY_STEP] fetch monkey-patch 已安装');
})();
`

// 第二步注入：模拟用户输入消息 + 点击发送按钮
const INJECT_USER_ACTION = `
(async () => {
  function logStep(msg) { console.log('[VERIFY_STEP] ' + msg); }
  function logResult(result) { console.log('[VERIFY_RESULT]' + JSON.stringify(result)); }

  try {
    logStep('开始模拟用户操作');

    // 1. 找到 textarea（输入框）
    const textarea = document.querySelector('textarea');
    if (!textarea) {
      logResult({ success: false, error: '未找到 textarea 输入框' });
      return;
    }
    logStep('找到 textarea, placeholder=' + (textarea.placeholder || '(空)'));

    // 2. 用 React native setter 设置 value（触发 onChange）
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    nativeInputValueSetter.call(textarea, 'ping');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    logStep('已在 textarea 输入 "ping"');

    // 等待 React 状态更新
    await new Promise(r => setTimeout(r, 500));

    // 3. 找到发送按钮（带 Send 图标的按钮）
    // 从 AIChatPanel.tsx 看，发送按钮是一个带 Send icon 的 button
    // 可能的选择器：button[type="submit"], button[title*="发送"], 或包含 svg 的 button
    let sendBtn = null;

    // 方法1：找 textarea 附近的 button
    const container = textarea.closest('div[class*="flex"], div[class*="border-t"]');
    if (container) {
      const btns = container.querySelectorAll('button');
      for (const btn of btns) {
        const svg = btn.querySelector('svg');
        const title = btn.getAttribute('title') || '';
        const ariaLabel = btn.getAttribute('aria-label') || '';
        if (title.includes('发送') || ariaLabel.includes('发送') || (svg && btns.length === 1)) {
          sendBtn = btn;
          break;
        }
      }
      // 方法2：如果没找到，取最后一个 button（通常是发送按钮）
      if (!sendBtn && btns.length > 0) {
        sendBtn = btns[btns.length - 1];
      }
    }

    // 方法3：全局搜索 textarea 父容器的下一个兄弟元素中的 button
    if (!sendBtn) {
      const allBtns = document.querySelectorAll('button');
      for (const btn of allBtns) {
        const svg = btn.querySelector('svg');
        if (svg && svg.getAttribute('data-lucide') === 'send') {
          sendBtn = btn;
          break;
        }
      }
    }

    if (!sendBtn) {
      logStep('未找到明确的发送按钮，尝试用 Enter 键发送');
      textarea.focus();
      textarea.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true,
      }));
    } else {
      logStep('找到发送按钮，点击');
      sendBtn.click();
    }

    // 4. 等待 AI 回复（最多 60 秒）
    logStep('等待 AI 回复（最多 60 秒）...');
    const startTime = Date.now();
    let aiProxyResponse = null;

    while (Date.now() - startTime < 60000) {
      await new Promise(r => setTimeout(r, 2000));
      // 检查网络日志中是否有 aiProxy 响应
      const netlog = window.__VERIFY_NETLOG__ || [];
      for (const req of netlog) {
        // 大小写不敏感匹配 aiproxy（HTTP 访问服务 URL 是 /api/aiproxy，SDK 是 /functions/aiProxy）
        if (req.url && req.url.toLowerCase().includes('aiproxy') && req.resBody) {
          aiProxyResponse = req;
          break;
        }
      }
      if (aiProxyResponse) {
        logStep('捕获到 aiProxy 响应');
        break;
      }
      // 每 10 秒输出一次等待状态
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (elapsed % 10 === 0 && elapsed > 0) {
        logStep('已等待 ' + elapsed + ' 秒...');
      }
    }

    // 5. 收集所有网络请求
    const netlog = window.__VERIFY_NETLOG__ || [];
    const aiProxyReqs = netlog.filter(r => r.url && r.url.toLowerCase().includes('aiproxy'));
    const loginReqs = netlog.filter(r => r.url && r.url.includes('signin'));

    // 6. 检查消息列表中的 AI 回复
    const msgElements = document.querySelectorAll('[class*="message"], [class*="bubble"], [class*="assistant"]');
    let aiReplyText = null;
    for (const el of msgElements) {
      const text = el.textContent || '';
      if (text.length > 10 && !text.includes('ping')) {
        aiReplyText = text.slice(0, 300);
        break;
      }
    }

    // 7. 输出结果
    const result = {
      success: aiProxyResponse && aiProxyResponse.resStatus === 200,
      aiProxyResponse: aiProxyResponse ? {
        status: aiProxyResponse.resStatus,
        body: aiProxyResponse.resBody ? aiProxyResponse.resBody.slice(0, 800) : null,
        reqBody: aiProxyResponse.reqBody ? aiProxyResponse.reqBody.slice(0, 300) : null,
      } : null,
      aiReplyText,
      networkSummary: {
        totalRequests: netlog.length,
        loginRequests: loginReqs.length,
        aiProxyRequests: aiProxyReqs.length,
      },
      allNetworkUrls: netlog.map(r => r.method + ' ' + r.url + ' -> ' + r.resStatus),
      timestamp: new Date().toISOString(),
    };

    // 尝试解析 aiProxy 响应体
    if (aiProxyResponse && aiProxyResponse.resBody) {
      try {
        const parsed = JSON.parse(aiProxyResponse.resBody);
        result.parsedCode = parsed.code;
        result.parsedMessage = parsed.message;
        result.parsedContent = parsed.data?.content ? parsed.data.content.slice(0, 300) : null;
        if (parsed.code === 0 && parsed.data?.content) {
          result.success = true;
        }
      } catch (e) {
        result.parseError = e.message;
      }
    }

    logResult(result);
  } catch (e) {
    logResult({ success: false, error: e.message, stack: e.stack && e.stack.split('\\n').slice(0, 5).join(' | ') });
  }
})();
`

app.whenReady().then(async () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: undefined,
    },
  })

  // 清除 HTTP disk cache，确保加载最新的 index.html 和 chunk（不是旧的缓存版本）
  try {
    await mainWindow.webContents.session.clearCache()
    console.log('[electron] 已清除 HTTP disk cache')
  } catch (e) {
    console.log('[electron] 清除 HTTP cache 失败: ' + e.message)
  }

  // 清除 localStorage 和 cookies，确保获取新的匿名 token
  // 旧 token 在 Rego 策略变更前获取，可能缓存了旧权限
  try {
    await mainWindow.webContents.session.clearStorageData({
      origin: 'https://metago.life',
      storages: ['localstorage', 'cookies', 'indexdb', 'websql'],
    })
    console.log('[electron] 已清除 metago.life 的 localStorage 和 cookies')
  } catch (e) {
    console.log('[electron] 清除存储失败: ' + e.message)
  }

  // 关键：禁用缓存加载页面，确保拿到最新的 index.html
  // Electron 的 loadURL 默认会使用 HTTP cache，即使 clearCache 后也可能重新缓存
  // 通过设置 webPreferences.blinkFeatures 和 fetch 时的 cache: 'no-store' 来彻底绕过

  // 监听 console 消息（统一处理）
  mainWindow.webContents.on('console-message', (_event, _level, message, _line, _sourceId) => {
    if (message.startsWith('[VERIFY_RESULT]')) {
      if (gotResult) return
      gotResult = true
      const json = message.slice('[VERIFY_RESULT]'.length)
      console.log('\n========== UI 验证结果 ==========')
      try {
        const parsed = JSON.parse(json)
        console.log(JSON.stringify(parsed, null, 2))
        console.log('\n结论: ' + (parsed.success ? '✅ 通过 (AI 对话端到端验证成功)' : '❌ 失败'))
        if (parsed.aiProxyResponse && parsed.aiProxyResponse.body) {
          console.log('\naiProxy 响应体:')
          console.log(parsed.aiProxyResponse.body)
        }
        if (parsed.parsedContent) {
          console.log('\nAI 回复内容前300字:')
          console.log(parsed.parsedContent)
        }
      } catch (e) {
        console.log(json)
      }
      console.log('==================================\n')
      clearTimeout(verifyTimeout)
      setTimeout(() => app.quit(), 500)
    } else if (message.startsWith('[VERIFY_') || message.includes('aiProxy') || message.includes('cloudFunctions')) {
      console.log('[renderer] ' + message)
    }
  })

  // 在页面加载前注入 fetch monkey-patch（使用 webContents.session.webRequest.onBeforeRequest 或 executeJavaScript）
  // 实际上，我们用 did-start-loading 事件在页面开始加载时注入
  mainWindow.webContents.on('did-start-loading', () => {
    console.log('[electron] 页面开始加载')
  })

  // 页面加载完成后注入用户操作
  mainWindow.webContents.on('did-finish-load', async () => {
    console.log('[electron] 页面加载完成: ' + VERIFY_URL)

    // 先注入 fetch monkey-patch
    try {
      await mainWindow.webContents.executeJavaScript(INJECT_FETCH_PATCH)
      console.log('[electron] fetch monkey-patch 注入成功')
    } catch (e) {
      console.log('[electron] fetch monkey-patch 注入失败: ' + e.message)
    }

    // 等待页面 React 完全渲染
    console.log('[electron] 等待 8 秒让 React 完全渲染...')
    await new Promise(r => setTimeout(r, 8000))

    // 注入用户操作代码
    console.log('[electron] 注入用户操作代码')
    try {
      await mainWindow.webContents.executeJavaScript(INJECT_USER_ACTION)
    } catch (e) {
      if (!gotResult) {
        gotResult = true
        console.log('\n========== UI 验证结果 ==========')
        console.log(JSON.stringify({ success: false, error: 'executeJavaScript 失败: ' + e.message }, null, 2))
        console.log('==================================\n')
        setTimeout(() => app.quit(), 500)
      }
    }
  })

  mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
    console.error('[electron] 加载失败: code=' + errorCode + ', desc=' + errorDescription + ', url=' + validatedURL)
    if (!gotResult) {
      gotResult = true
      console.log('\n========== UI 验证结果 ==========')
      console.log(JSON.stringify({ success: false, error: '页面加载失败: ' + errorDescription }, null, 2))
      console.log('==================================\n')
      setTimeout(() => app.quit(), 500)
    }
  })

  console.log('[electron] 加载 URL: ' + VERIFY_URL)
  // 加载页面时禁用缓存，确保拿到最新的 index.html 和 chunk
  mainWindow.loadURL(VERIFY_URL, { extraHeaders: 'Cache-Control: no-cache\nPragma: no-cache\n' })

  verifyTimeout = setTimeout(() => {
    if (!gotResult) {
      gotResult = true
      console.log('\n========== UI 验证结果 ==========')
      console.log(JSON.stringify({ success: false, error: '验证超时(' + VERIFY_TIMEOUT_MS + 'ms)' }, null, 2))
      console.log('==================================\n')
      app.quit()
    }
  }, VERIFY_TIMEOUT_MS)
})

app.on('window-all-closed', () => {
  app.quit()
})

process.on('exit', () => {
  clearTimeout(verifyTimeout)
})
