import { useState, useEffect } from 'react'
import { Globe, RefreshCw, ExternalLink, X, AlertCircle } from 'lucide-react'

interface PreviewPanelProps {
  /** 初始 URL */
  initialUrl?: string
  onClose?: () => void
}

/** 网页预览面板（iframe） */
export function PreviewPanel({ initialUrl = '', onClose }: PreviewPanelProps) {
  const [url, setUrl] = useState(initialUrl)
  const [inputUrl, setInputUrl] = useState(initialUrl)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    setInputUrl(initialUrl)
    setUrl(initialUrl)
    setLoading(true)
    setError(null)
  }, [initialUrl])

  const handleNavigate = () => {
    let target = inputUrl.trim()
    if (!target) return
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'http://' + target
    }
    setUrl(target)
    setLoading(true)
    setError(null)
    setReloadKey(k => k + 1)
  }

  const handleReload = () => {
    setLoading(true)
    setError(null)
    setReloadKey(k => k + 1)
  }

  // 常用端口快速切换
  const quickPorts = [
    { port: 3000, label: 'React' },
    { port: 5173, label: 'Vite' },
    { port: 8080, label: 'Vue' },
    { port: 3001, label: 'Next' },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
      <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 border-b border-border-subtle bg-bg-deep/50">
        <Globe className="w-3.5 h-3.5 text-accent-emerald flex-shrink-0" />
        <button
          onClick={handleReload}
          className="p-1 text-zinc-500 hover:text-zinc-300"
          title="刷新"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <input
          value={inputUrl}
          onChange={e => setInputUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleNavigate() }}
          placeholder="http://localhost:5173"
          className="flex-1 px-2 py-0.5 text-[11px] rounded bg-bg-deep border border-border-subtle text-zinc-200 focus:outline-none focus:border-accent-emerald/40"
        />
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="p-1 text-zinc-500 hover:text-zinc-300"
          title="在新标签页打开"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
        {onClose && (
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-zinc-300">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 快速端口 */}
      <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 border-b border-border-subtle">
        <span className="text-[9px] text-zinc-600">快速切换：</span>
        {quickPorts.map(p => (
          <button
            key={p.port}
            onClick={() => {
              const newUrl = `http://localhost:${p.port}`
              setInputUrl(newUrl)
              setUrl(newUrl)
              setLoading(true)
              setReloadKey(k => k + 1)
            }}
            className={`px-1.5 py-0.5 text-[9px] rounded border ${
              url === `http://localhost:${p.port}`
                ? 'border-accent-emerald/40 text-accent-emerald bg-accent-emerald/10'
                : 'border-border-subtle text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {p.label}:{p.port}
          </button>
        ))}
      </div>

      {/* 预览区 */}
      <div className="flex-1 min-h-0 relative bg-white">
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-500 bg-bg-deep">
            <AlertCircle className="w-8 h-8 text-orange-400" />
            <div className="text-xs">{error}</div>
            <button onClick={handleReload} className="px-3 py-1 text-xs rounded bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20">
              重试
            </button>
          </div>
        )}
        {loading && !error && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-bg-card/80 text-[10px] text-zinc-400 backdrop-blur z-10">
            加载中...
          </div>
        )}
        <iframe
          key={reloadKey}
          src={url}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onLoad={() => setLoading(false)}
          onError={() => { setError('无法加载页面'); setLoading(false) }}
          title="预览"
        />
      </div>
    </div>
  )
}
