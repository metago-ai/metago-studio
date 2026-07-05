import { useState, useCallback } from 'react'
import { Share2, Copy, Check, X, Link2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ShareData {
  title: string
  content: string
  type: 'decision_lock' | 'evolution' | 'kit'
}

export function ShareButton({ data }: { data: ShareData }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<'link' | 'text' | null>(null)

  const generateShareLink = useCallback(() => {
    // 标准 UTF-8 → Base64（替代已废弃的 escape/unescape）
    const bytes = new TextEncoder().encode(JSON.stringify({
      t: data.type,
      s: data.title,
      c: data.content.slice(0, 2000),
      ts: Date.now(),
    }))
    const encoded = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''))
    return `${window.location.origin}${window.location.pathname}#/shared/${encoded}`
  }, [data])

  const copyToClipboard = async (text: string, type: 'link' | 'text') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // 降级方案
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* ignore */ }
      document.body.removeChild(ta)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary text-sm flex items-center gap-2"
        title="分享"
      >
        <Share2 className="w-4 h-4" />
        分享
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-bg-card rounded-2xl border border-border-subtle p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-accent-emerald" />
                  分享{data.type === 'decision_lock' ? '校验结果' : data.type === 'evolution' ? '进化记录' : 'Kit配置'}
                </h3>
                <button onClick={() => setOpen(false)} className="text-zinc-600 hover:text-zinc-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-zinc-500 mb-4">{data.title}</p>

              {/* 分享链接 */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1.5 flex items-center gap-1.5">
                    <Link2 className="w-3 h-3" />
                    分享链接
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generateShareLink()}
                      className="input-base flex-1 text-xs font-mono"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      onClick={() => copyToClipboard(generateShareLink(), 'link')}
                      className="btn-primary text-xs px-3"
                    >
                      {copied === 'link' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied === 'link' ? '已复制' : '复制'}
                    </button>
                  </div>
                </div>

                {/* 纯文本 */}
                <div>
                  <label className="text-xs text-zinc-500 mb-1.5 flex items-center gap-1.5">
                    <Copy className="w-3 h-3" />
                    纯文本
                  </label>
                  <div className="flex gap-2">
                    <textarea
                      readOnly
                      value={`${data.title}\n\n${data.content}`}
                      className="input-base flex-1 text-xs h-20 resize-none"
                      onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                    />
                    <button
                      onClick={() => copyToClipboard(`${data.title}\n\n${data.content}`, 'text')}
                      className="btn-primary text-xs px-3 self-start"
                    >
                      {copied === 'text' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-zinc-600 mt-4 text-center">
                分享链接仅包含摘要内容，不包含您的个人数据
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
