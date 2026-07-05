/**
 * 前端错误监控
 *
 * 捕获未处理异常、Promise rejection、资源加载失败
 * 上报到 CloudBase error_logs 集合
 */

import { callFunction } from './cloudFunctions'

interface ErrorLog {
  type: string
  message: string
  stack?: string
  filename?: string
  lineno?: number
  colno?: number
  userAgent: string
  url: string
  timestamp: string
  userId?: string
}

let initialized = false
let errorBuffer: ErrorLog[] = []
const FLUSH_INTERVAL = 30000  // 30秒批量上报

/** 初始化全局错误监控 */
export function initErrorMonitor(): void {
  if (initialized) return
  initialized = true

  // 未捕获异常
  window.addEventListener('error', (event) => {
    addError({
      type: 'error',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
    })
  })

  // 未处理的 Promise rejection
  window.addEventListener('unhandledrejection', (event) => {
    addError({
      type: 'unhandledrejection',
      message: `Unhandled rejection: ${event.reason}`,
      stack: event.reason?.stack,
    })
  })

  // 定时上报
  setInterval(flushErrors, FLUSH_INTERVAL)

  // 页面卸载前上报
  window.addEventListener('beforeunload', flushErrors)

  console.log('[errorMonitor] 错误监控已启动')
}

function addError(partial: Partial<ErrorLog>): void {
  const error: ErrorLog = {
    type: partial.type || 'unknown',
    message: partial.message || 'Unknown error',
    stack: partial.stack,
    filename: partial.filename,
    lineno: partial.lineno,
    colno: partial.colno,
    userAgent: navigator.userAgent,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    userId: localStorage.getItem('metago_user_id') || undefined,
  }

  errorBuffer.push(error)
  console.error('[errorMonitor]', error.message, error.stack)

  // 立即上报严重错误
  if (error.type === 'error') {
    setTimeout(flushErrors, 1000)
  }
}

async function flushErrors(): Promise<void> {
  if (errorBuffer.length === 0) return
  const batch = errorBuffer.splice(0, errorBuffer.length)

  try {
    await callFunction('support', { action: 'reportErrors', errors: batch })
  } catch {
    // 上报失败，放回缓冲区（下次重试）
    errorBuffer.unshift(...batch)
  }
}

/** 手动上报错误 */
export function reportError(error: Error, context?: Record<string, unknown>): void {
  addError({
    type: 'manual',
    message: error.message,
    stack: error.stack,
    ...context,
  })
}
