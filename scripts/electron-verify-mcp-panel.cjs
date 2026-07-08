/**
 * Electron UI 验证：MCPPanel 工具分类与数量一致性
 *
 * 加载 https://metago.life/studio/#/agent 页面，读取左侧 MCPPanel 的：
 *   1. 顶部 "可调用" 数字（应为 59）
 *   2. 左侧分类列表（应为 8 类：文件系统/Git/Shell/任务管理/部署验证/子代理/流式编辑/MCP 智能工具）
 *   3. 每类工具数（8+4+1+3+2+1+1+39=59）
 *   4. 底部统计文案
 *
 * 同时验证 AIChatPanel 占位文案不再写 "39 个 MCP 工具和 39 个元构技能"
 */

const { app, BrowserWindow } = require('electron')

let mainWindow = null
const VERIFY_URL = process.env.VERIFY_URL || 'https://metago.life/studio/#/agent'
const VERIFY_TIMEOUT_MS = 60000

let verifyTimeout = null
let gotResult = false

// 注入：读取 MCPPanel 和 AIChatPanel 的显示内容
const INJECT_READ_UI = `
(async () => {
  function logStep(msg) { console.log('[VERIFY_STEP] ' + msg); }
  function logResult(result) { console.log('[VERIFY_RESULT]' + JSON.stringify(result)); }

  try {
    logStep('开始读取 MCPPanel 显示内容');

    // 等待页面完全渲染
    await new Promise(r => setTimeout(r, 3000));

    // 0. 先切换到 MCP 工具 tab（默认是 files tab，MCPPanel 不在 DOM 中）
    //    ActivityIcon label="MCP" → button title="MCP"
    const mcpBtn = document.querySelector('button[title="MCP"]');
    if (mcpBtn) {
      logStep('找到 MCP 工具按钮(title="MCP")，点击切换 tab');
      mcpBtn.click();
      await new Promise(r => setTimeout(r, 2500));
    } else {
      logStep('⚠️ 未找到 button[title="MCP"]，dump 所有按钮 title:');
      const allBtns2 = document.querySelectorAll('button');
      const titles = [];
      for (const b of allBtns2) {
        const t = b.getAttribute('title');
        if (t) titles.push(t);
      }
      logStep('所有按钮 title: ' + JSON.stringify(titles));
    }
    await new Promise(r => setTimeout(r, 1000));

    // 1. 读取顶部 "可调用" 数字
    //    MCPPanel.tsx: <span className="text-[9px] text-zinc-600">{callableCount} 可调用</span>
    const allSpans = document.querySelectorAll('span');
    let callableCountText = null;
    let bottomStatText = null;
    const callableCandidates = [];
    const bottomCandidates = [];
    for (const span of allSpans) {
      const text = span.textContent || '';
      if (/^\\d+\\s*可调用$/.test(text.trim())) {
        callableCandidates.push(text.trim());
        callableCountText = text.trim();
      }
      if (/个工具全部可调用/.test(text) || /^\\d+\\s*个工具/.test(text.trim())) {
        bottomCandidates.push(text.trim());
        bottomStatText = text.trim();
      }
    }

    // 2. 读取左侧分类列表
    //    MCPPanel.tsx 中分类标题是一个 button，内含 <span>{cat}</span><span>({count})</span>
    //    遍历所有 button，找包含 "(数字)" 模式的按钮
    const categories = [];
    const allButtons = document.querySelectorAll('button');
    logStep('找到 button 数量: ' + allButtons.length);
    const knownCats = ['文件系统', 'Git', 'Shell', '任务管理', '部署验证', '子代理', '流式编辑', 'MCP 智能工具'];
    for (const btn of allButtons) {
      const spans = btn.querySelectorAll('span');
      if (spans.length >= 2) {
        // 找包含已知分类名的 span
        for (const s of spans) {
          const t = s.textContent?.trim() || '';
          if (knownCats.includes(t)) {
            // 找紧邻的包含 (数字) 的 span
            for (const s2 of spans) {
              const m = s2.textContent?.trim().match(/^\\((\\d+)\\)$/);
              if (m) {
                categories.push({ name: t, count: parseInt(m[1], 10) });
                break;
              }
            }
            break;
          }
        }
      }
    }

    // 3. 读取 AIChatPanel 占位文案（未打开工作区时显示）
    let chatPlaceholderText = null;
    const allP = document.querySelectorAll('p');
    for (const p of allP) {
      const text = p.textContent || '';
      if (text.includes('打开工作区后') || text.includes('MCP 工具') || text.includes('可调用工具')) {
        chatPlaceholderText = text.trim();
        break;
      }
    }

    // 4. 汇总
    const expectedCategories = ['文件系统', 'Git', 'Shell', '任务管理', '部署验证', '子代理', '流式编辑', 'MCP 智能工具'];
    const expectedCounts = { '文件系统': 8, 'Git': 4, 'Shell': 1, '任务管理': 3, '部署验证': 2, '子代理': 1, '流式编辑': 1, 'MCP 智能工具': 39 };
    const expectedTotal = 59;

    const actualCats = categories.map(c => c.name);
    const actualTotal = categories.reduce((sum, c) => sum + c.count, 0);

    const missing = expectedCategories.filter(c => !actualCats.includes(c));
    const extra = actualCats.filter(c => !expectedCategories.includes(c));
    const countMismatch = categories.filter(c => expectedCounts[c.name] !== undefined && expectedCounts[c.name] !== c.count);

    // 解析顶部可调用数字
    const callableNum = callableCountText ? parseInt(callableCountText.match(/\\d+/)?.[0] || '0', 10) : 0;

    const result = {
      // 顶部
      callableCountText,
      callableNum,
      callableNumExpected: expectedTotal,
      callableNumMatch: callableNum === expectedTotal,
      // 底部
      bottomStatText,
      // 分类
      categories,
      categoryCount: categories.length,
      categoryCountExpected: 8,
      categoryCountMatch: categories.length === 8,
      // 总数一致性
      actualTotalFromCategories: actualTotal,
      actualTotalExpected: expectedTotal,
      totalMatch: actualTotal === expectedTotal,
      // 缺失/多余分类
      missingCategories: missing,
      extraCategories: extra,
      countMismatches: countMismatch.map(c => ({ name: c.name, expected: expectedCounts[c.name], actual: c.count })),
      // AIChatPanel 文案
      chatPlaceholderText,
      chatPlaceholderHasOldMisleadingText: chatPlaceholderText ? chatPlaceholderText.includes('39 个 MCP 工具和 39 个元构技能') : false,
      chatPlaceholderHasNewText: chatPlaceholderText ? chatPlaceholderText.includes('59 个可调用工具') : false,
      // 调试
      callableCandidates,
      bottomCandidates,
      timestamp: new Date().toISOString(),
    };

    // 综合判定
    result.success = result.callableNumMatch
      && result.categoryCountMatch
      && result.totalMatch
      && missing.length === 0
      && countMismatch.length === 0
      && !result.chatPlaceholderHasOldMisleadingText;

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
    },
  })

  // 清除缓存确保加载最新版本
  try {
    await mainWindow.webContents.session.clearCache()
    console.log('[electron] 已清除 HTTP disk cache')
  } catch (e) {
    console.log('[electron] 清除 cache 失败: ' + e.message)
  }

  try {
    await mainWindow.webContents.session.clearStorageData({
      origin: 'https://metago.life',
      storages: ['localstorage', 'cookies'],
    })
    console.log('[electron] 已清除 localStorage 和 cookies')
  } catch (e) {
    console.log('[electron] 清除存储失败: ' + e.message)
  }

  mainWindow.webContents.on('console-message', (_event, _level, message, _line, _sourceId) => {
    if (message.startsWith('[VERIFY_RESULT]')) {
      if (gotResult) return
      gotResult = true
      const json = message.slice('[VERIFY_RESULT]'.length)
      console.log('\n========== MCPPanel 验证结果 ==========')
      try {
        const parsed = JSON.parse(json)
        console.log(JSON.stringify(parsed, null, 2))
        console.log('\n结论: ' + (parsed.success ? '✅ 通过' : '❌ 失败'))
        if (parsed.callableCountText) console.log('顶部数字: ' + parsed.callableCountText + (parsed.callableNumMatch ? ' ✅' : ' ❌ (期望 59)'))
        if (parsed.categories && parsed.categories.length > 0) {
          console.log('\n分类列表:')
          parsed.categories.forEach(c => {
            const expected = { '文件系统': 8, 'Git': 4, 'Shell': 1, '任务管理': 3, '部署验证': 2, '子代理': 1, '流式编辑': 1, 'MCP 智能工具': 39 }[c.name]
            const ok = expected === c.count
            console.log('  ' + c.name + ': ' + c.count + (ok ? ' ✅' : ' ❌ (期望 ' + expected + ')'))
          })
          console.log('合计: ' + parsed.actualTotalFromCategories + (parsed.totalMatch ? ' ✅' : ' ❌ (期望 59)'))
        }
        if (parsed.missingCategories && parsed.missingCategories.length > 0) {
          console.log('\n缺失分类: ' + parsed.missingCategories.join(', '))
        }
        if (parsed.chatPlaceholderText) {
          console.log('\nAIChatPanel 文案: ' + parsed.chatPlaceholderText.slice(0, 120))
          console.log('  旧误导文案已移除: ' + (parsed.chatPlaceholderHasOldMisleadingText ? '❌ 仍存在' : '✅ 已移除'))
          console.log('  新文案已生效: ' + (parsed.chatPlaceholderHasNewText ? '✅ 是' : '❌ 否'))
        }
      } catch (e) {
        console.log(json)
      }
      console.log('=======================================\n')
      clearTimeout(verifyTimeout)
      setTimeout(() => app.quit(), 500)
    } else if (message.startsWith('[VERIFY_')) {
      console.log('[renderer] ' + message)
    }
  })

  mainWindow.webContents.on('did-finish-load', async () => {
    console.log('[electron] 页面加载完成: ' + VERIFY_URL)
    // 等待 React 渲染
    console.log('[electron] 等待 8 秒让 React 完全渲染...')
    await new Promise(r => setTimeout(r, 8000))
    console.log('[electron] 注入读取代码')
    try {
      await mainWindow.webContents.executeJavaScript(INJECT_READ_UI)
    } catch (e) {
      if (!gotResult) {
        gotResult = true
        console.log('\n========== MCPPanel 验证结果 ==========')
        console.log(JSON.stringify({ success: false, error: 'executeJavaScript 失败: ' + e.message }, null, 2))
        console.log('=======================================\n')
        setTimeout(() => app.quit(), 500)
      }
    }
  })

  mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
    console.error('[electron] 加载失败: code=' + errorCode + ', desc=' + errorDescription + ', url=' + validatedURL)
    if (!gotResult) {
      gotResult = true
      console.log('\n========== MCPPanel 验证结果 ==========')
      console.log(JSON.stringify({ success: false, error: '页面加载失败: ' + errorDescription }, null, 2))
      console.log('=======================================\n')
      setTimeout(() => app.quit(), 500)
    }
  })

  console.log('[electron] 加载 URL: ' + VERIFY_URL)
  mainWindow.loadURL(VERIFY_URL, { extraHeaders: 'Cache-Control: no-cache\nPragma: no-cache\n' })

  verifyTimeout = setTimeout(() => {
    if (!gotResult) {
      gotResult = true
      console.log('\n========== MCPPanel 验证结果 ==========')
      console.log(JSON.stringify({ success: false, error: '验证超时(' + VERIFY_TIMEOUT_MS + 'ms)' }, null, 2))
      console.log('=======================================\n')
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
