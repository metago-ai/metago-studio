import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Share2, Shield, Dna, Package, AlertTriangle, ArrowLeft } from 'lucide-react'

interface SharedPayload {
  t: 'decision_lock' | 'evolution' | 'kit'
  s: string
  c: string
  ts: number
}

const TYPE_META = {
  decision_lock: { label: '决策锁校验结果', icon: Shield, accent: 'text-accent-emerald' },
  evolution: { label: '进化档案', icon: Dna, accent: 'text-accent-teal' },
  kit: { label: 'Kit 配置', icon: Package, accent: 'text-accent-amber' },
}

export function SharedPage() {
  const { encoded } = useParams<{ encoded: string }>()
  const [payload, setPayload] = useState<SharedPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!encoded) {
      setError('分享链接无效')
      return
    }
    try {
      const json = decodeURIComponent(escape(atob(encoded)))
      const data = JSON.parse(json) as SharedPayload
      if (!data.t || !data.s || !data.c) {
        setError('分享内容格式错误')
        return
      }
      setPayload(data)
    } catch {
      setError('无法解析分享内容')
    }
  }, [encoded])

  if (error) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-base p-8 text-center"
        >
          <AlertTriangle className="w-12 h-12 text-accent-rose mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-zinc-100 mb-2">分享链接无效</h1>
          <p className="text-sm text-zinc-500 mb-6">{error}</p>
          <Link to="/" className="btn-primary text-sm inline-flex">
            <ArrowLeft className="w-4 h-4" />
            返回首页
          </Link>
        </motion.div>
      </div>
    )
  }

  if (!payload) return null

  const meta = TYPE_META[payload.t]
  const Icon = meta.icon

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-base p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-bg-elevated flex items-center justify-center">
            <Icon className={`w-5 h-5 ${meta.accent}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Share2 className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-500">来自 MetaGO Studio 的分享</span>
            </div>
            <h1 className="text-base font-semibold text-zinc-100 mt-0.5">{meta.label}</h1>
          </div>
        </div>

        <div className="text-sm text-zinc-300 mb-4 font-medium break-all">
          {payload.s}
        </div>

        <div className="p-4 rounded-lg bg-bg-elevated/50 border border-border-subtle">
          <pre className="text-xs text-zinc-400 whitespace-pre-wrap break-words font-mono">
            {payload.c}
          </pre>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border-subtle">
          <span className="text-[10px] text-zinc-600">
            分享时间：{new Date(payload.ts).toLocaleString('zh-CN')}
          </span>
          <Link to="/" className="btn-secondary text-xs">
            体验 MetaGO Studio
            <ArrowLeft className="w-3 h-3 rotate-180" />
          </Link>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-base p-5 text-center"
      >
        <p className="text-sm text-zinc-400 mb-3">
          想要拥有自己的决策锁、进化档案和元构能力？
        </p>
        <Link to="/" className="btn-primary text-sm">
          免费开始使用 MetaGO Studio
        </Link>
      </motion.div>
    </div>
  )
}
