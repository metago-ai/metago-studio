import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Send, X, CheckCircle2, Loader2, CloudOff } from 'lucide-react'
import { callFunction } from '../lib/cloudFunctions'
import { useAuth } from '../contexts/AuthContext'

const PENDING_KEY = 'metago_feedback_pending'

export function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'bug' | 'feature' | 'other'>('bug')
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'queued' | 'error'>('idle')
  const { user } = useAuth()

  /** 重试上传 localStorage 中的 pending 反馈队列 */
  const retryPendingFeedback = async () => {
    try {
      const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]')
      if (pending.length === 0) return
      const remaining: typeof pending = []
      for (const item of pending) {
        try {
          const res = await callFunction('sync', {
            action: 'submitFeedback',
            feedback: {
              type: item.type,
              content: item.content,
              contact: item.contact,
              userId: user?.uid || 'anonymous',
              createdAt: new Date(item.ts).toISOString(),
            },
          })
          if (res.code !== 0 && res.code !== 200) remaining.push(item)
        } catch {
          remaining.push(item)
        }
      }
      if (remaining.length === 0) localStorage.removeItem(PENDING_KEY)
      else localStorage.setItem(PENDING_KEY, JSON.stringify(remaining))
    } catch {
      // ignore
    }
  }

  // 挂载时 + 网络恢复时自动重试 pending 队列
  useEffect(() => {
    retryPendingFeedback()
    const handleOnline = () => retryPendingFeedback()
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid])

  const handleSubmit = async () => {
    if (!content.trim()) return
    setStatus('sending')
    try {
      const res = await callFunction('sync', {
        action: 'submitFeedback',
        feedback: {
          type,
          content: content.trim(),
          contact: contact.trim(),
          userId: user?.uid || 'anonymous',
          createdAt: new Date().toISOString(),
        },
      })
      if (res.code === 0 || res.code === 200) {
        setStatus('sent')
        // 顺便重试 pending 队列
        retryPendingFeedback()
        setTimeout(() => {
          setOpen(false)
          setStatus('idle')
          setContent('')
          setContact('')
          setType('bug')
        }, 2000)
      } else {
        setStatus('error')
      }
    } catch {
      // 降级：保存到本地 pending 队列，网络恢复后自动重试上传
      try {
        const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]')
        pending.push({ type, content: content.trim(), contact: contact.trim(), ts: Date.now() })
        localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
        setStatus('queued')
        setTimeout(() => {
          setOpen(false)
          setStatus('idle')
          setContent('')
          setContact('')
        }, 2500)
      } catch {
        setStatus('error')
      }
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-gradient-to-br from-accent-emerald to-accent-teal shadow-lg shadow-accent-emerald/20 flex items-center justify-center text-white hover:scale-110 transition-transform z-40"
        title="提交反馈"
      >
        <MessageSquare className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => status !== 'sending' && setOpen(false)}
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
                  <MessageSquare className="w-4 h-4 text-accent-emerald" />
                  提交反馈
                </h3>
                {status !== 'sending' && (
                  <button onClick={() => setOpen(false)} className="text-zinc-600 hover:text-zinc-400">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {status === 'sent' ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-accent-emerald mx-auto mb-3" />
                  <p className="text-sm text-zinc-300">反馈已提交，感谢您的支持！</p>
                  <p className="text-xs text-zinc-600 mt-1">我们会在1-3个工作日内处理</p>
                </div>
              ) : status === 'queued' ? (
                <div className="py-8 text-center">
                  <CloudOff className="w-12 h-12 text-accent-amber mx-auto mb-3" />
                  <p className="text-sm text-zinc-300">网络异常，反馈已暂存本地</p>
                  <p className="text-xs text-zinc-500 mt-1">网络恢复后将自动重新上传，无需重试</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">反馈类型</label>
                    <div className="flex gap-2">
                      {[
                        { v: 'bug', l: '问题反馈' },
                        { v: 'feature', l: '功能建议' },
                        { v: 'other', l: '其他' },
                      ].map(opt => (
                        <button
                          key={opt.v}
                          onClick={() => setType(opt.v as typeof type)}
                          className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                            type === opt.v
                              ? 'bg-accent-emerald/20 text-accent-emerald border border-accent-emerald/30'
                              : 'bg-bg-elevated text-zinc-400 border border-transparent hover:border-border-subtle'
                          }`}
                        >
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">反馈内容 *</label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="请描述您遇到的问题或建议..."
                      className="input-base w-full h-24 resize-none text-sm"
                      maxLength={500}
                    />
                    <p className="text-[10px] text-zinc-600 mt-1 text-right">{content.length}/500</p>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">联系方式（选填）</label>
                    <input
                      type="text"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="邮箱或手机号，方便我们回复"
                      className="input-base w-full text-sm"
                      maxLength={100}
                    />
                  </div>

                  {status === 'error' && (
                    <p className="text-xs text-red-400">提交失败，请稍后重试或直接发送邮件至 support@metago.life</p>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={!content.trim() || status === 'sending'}
                    className="btn-primary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {status === 'sending' ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> 提交中...</>
                    ) : (
                      <><Send className="w-4 h-4" /> 提交反馈</>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
