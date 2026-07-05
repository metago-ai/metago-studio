import { useState, useEffect, useRef, useCallback } from 'react'
import { Terminal, ChevronDown, ChevronUp, Trash2, Activity, Monitor, Info } from 'lucide-react'
import { getMCPLogStore, type MCPLogEntry } from '../../lib/mcpRegistry'
import { isDesktop } from '../../lib/fs/fsInterface'

interface TerminalPanelProps {
  /** 工作区路径（用于显示提示符） */
  workspacePath: string | null
}

type PanelMode = 'activity' | 'shell'

/**
 * 终端面板
 *
 * - 活动日志（默认）：实时展示 AI 工具调用记录
 * - Shell（桌面端）：xterm.js + node-pty 完整交互式终端
 *
 * Web 端因浏览器沙箱限制无法运行真实 shell，已明确标注。
 */
export function TerminalPanel({ workspacePath }: TerminalPanelProps) {
  const desktop = isDesktop()
  const [mode, setMode] = useState<PanelMode>('activity')
  const [collapsed, setCollapsed] = useState(false)

  // 活动日志
  const [toolLogs, setToolLogs] = useState<MCPLogEntry[]>([])

  // xterm 容器
  const xtermContainerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<any>(null)          // Terminal 实例
  const fitAddonRef = useRef<any>(null)      // FitAddon
  const sessionIdRef = useRef<string | null>(null)
  const [shellReady, setShellReady] = useState(false)

  useEffect(() => {
    const store = getMCPLogStore()
    const unsub = store.subscribe(l => setToolLogs([...l]))
    setToolLogs(store.getAll())
    return unsub
  }, [])

  // 桌面端：进入 shell 模式时初始化 xterm + pty
  useEffect(() => {
    if (!desktop || mode !== 'shell' || !workspacePath || !xtermContainerRef.current) return
    if (termRef.current) return  // 已初始化

    let cancelled = false

    async function init() {
      try {
        // 动态导入避免 Web 端打包
        const { Terminal: XTerm } = await import('@xterm/xterm')
        const { FitAddon } = await import('@xterm/addon-fit')
        const xtermCss = await import('@xterm/xterm/css/xterm.css?url')
        // 注入 CSS（Vite 会处理 ?url）
        if (!document.getElementById('xterm-css')) {
          const link = document.createElement('link')
          link.id = 'xterm-css'
          link.rel = 'stylesheet'
          link.href = xtermCss.default
          document.head.appendChild(link)
        }

        const term = new XTerm({
          fontFamily: 'Consolas, "Courier New", monospace',
          fontSize: 12,
          theme: {
            background: '#0a0a0b',
            foreground: '#d4d4d4',
            cursor: '#10b981',
            selectionBackground: '#264f78',
          },
          cursorBlink: true,
          scrollback: 5000,
          convertEol: true,
        })
        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)

        if (cancelled) { term.dispose(); return }

        term.open(xtermContainerRef.current!)
        fitAddon.fit()

        termRef.current = term
        fitAddonRef.current = fitAddon

        const api = (window as any).electronAPI

        // 创建 pty 会话
        const sid = await api.terminal.create(workspacePath)
        if (cancelled) { api.terminal.close(sid); return }
        sessionIdRef.current = sid
        setShellReady(true)

        // pty 输出 → xterm
        api.terminal.onOutput((_sid: string, data: string) => {
          if (_sid === sid) term.write(data)
        })

        // xterm 输入 → pty
        term.onData((data: string) => {
          api.terminal.sendInput(sid, data)
        })

        // 窗口尺寸适配
        const handleResize = () => fitAddon.fit()
        window.addEventListener('resize', handleResize)
        ;(term as any)._resizeHandler = handleResize
      } catch (e: any) {
        console.error('[TerminalPanel] xterm 初始化失败', e)
      }
    }

    init()

    return () => {
      cancelled = true
      const sid = sessionIdRef.current
      const api = (window as any).electronAPI
      if (sid) api?.terminal?.close(sid)
      sessionIdRef.current = null
      if (termRef.current) {
        const handler = (termRef.current as any)._resizeHandler
        if (handler) window.removeEventListener('resize', handler)
        termRef.current.dispose()
        termRef.current = null
        fitAddonRef.current = null
      }
      setShellReady(false)
    }
  }, [desktop, mode, workspacePath])

  // 活动模式清空
  const clearActivity = useCallback(() => getMCPLogStore().clear(), [])

  const activeLogs = mode === 'activity' ? toolLogs.length : 0

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex-shrink-0 flex items-center justify-between w-full px-3 py-1.5 border-b border-border-subtle bg-bg-deep/50 hover:bg-bg-hover"
      >
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-accent-emerald" />
          <span className="text-xs font-medium text-zinc-300">终端</span>
          {mode === 'activity' && activeLogs > 0 && (
            <span className="text-[10px] text-zinc-600">{activeLogs} 行</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* 模式切换 */}
          {!collapsed && (
            <div className="flex items-center gap-0.5 mr-1" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setMode('activity')}
                className={`px-1.5 py-0.5 text-[9px] rounded flex items-center gap-1 ${
                  mode === 'activity' ? 'bg-accent-blue/15 text-accent-blue' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Activity className="w-2.5 h-2.5" /> AI 活动
              </button>
              <button
                onClick={() => setMode('shell')}
                disabled={!desktop}
                className={`px-1.5 py-0.5 text-[9px] rounded flex items-center gap-1 ${
                  mode === 'shell' ? 'bg-accent-emerald/15 text-accent-emerald' : 'text-zinc-500 hover:text-zinc-300'
                } ${!desktop ? 'opacity-40 cursor-not-allowed' : ''}`}
                title={desktop ? '交互式终端' : 'Web 端不可用'}
              >
                <Monitor className="w-2.5 h-2.5" /> Shell
              </button>
            </div>
          )}
          {mode === 'activity' && activeLogs > 0 && (
            <span
              onClick={(e) => { e.stopPropagation(); clearActivity() }}
              className="p-1 text-zinc-500 hover:text-zinc-300"
            >
              <Trash2 className="w-3 h-3" />
            </span>
          )}
          {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />}
        </div>
      </button>

      {!collapsed && (
        <>
          {/* Web 端 Shell 模式提示 */}
          {mode === 'shell' && !desktop && (
            <div className="flex-1 flex items-center justify-center px-4">
              <div className="text-center max-w-xs">
                <Info className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
                <div className="text-[11px] text-zinc-400 mb-1">Web 端无法运行真实终端</div>
                <div className="text-[10px] text-zinc-600 leading-relaxed">
                  浏览器沙箱限制，无法启动 shell 进程。<br/>
                  请下载<a href="https://metago.life/download/MetaGO-Agent-1.1.7-win-x64.exe" className="text-accent-emerald underline">桌面端</a>获取完整终端（含 ANSI 色彩、Tab 补全、vim/htop 等）。<br/><br/>
                  当前可查看「AI 活动」标签，实时观察 AI 调用了哪些工具。
                </div>
              </div>
            </div>
          )}

          {/* AI 活动日志模式 */}
          {mode === 'activity' && (
            <div className="flex-1 overflow-y-auto px-3 py-2 bg-bg-deep/80 font-mono text-[11px]">
              {toolLogs.length === 0 ? (
                <div className="text-zinc-600 leading-relaxed">
                  <Activity className="w-4 h-4 inline mr-1 text-zinc-700" />
                  AI 工具调用日志将实时显示在此。<br/>
                  <span className="text-zinc-700">向 AI 提问（如"读取 package.json"），它会自动调用 read_file 等工具。</span>
                </div>
              ) : (
                toolLogs.map((log, i) => (
                  <div key={log.id ?? i} className="mb-1.5 pb-1.5 border-b border-border-subtle/20">
                    <div className="flex items-center gap-1">
                      <span className="text-accent-emerald">{'>'}</span>
                      <span className="text-accent-blue">{log.toolName}</span>
                      {log.duration != null && (
                        <span className="text-zinc-600 ml-auto">{log.duration}ms</span>
                      )}
                    </div>
                    {log.params && Object.keys(log.params).length > 0 && (
                      <div className="text-zinc-500 ml-3 truncate">
                        {JSON.stringify(log.params)}
                      </div>
                    )}
                    {log.error ? (
                      <div className="text-red-400 ml-3">{log.error}</div>
                    ) : (
                      <div className="text-zinc-400 ml-3 whitespace-pre-wrap break-all max-h-24 overflow-hidden">
                        {String(log.result ?? '').slice(0, 300)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Shell 模式（桌面端，xterm.js） */}
          {mode === 'shell' && desktop && (
            <div className="flex-1 relative bg-black">
              <div ref={xtermContainerRef} className="absolute inset-0 px-1 py-1" />
              {!shellReady && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-zinc-600">终端启动中...</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
