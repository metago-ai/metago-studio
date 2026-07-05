import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HelpCircle, BookOpen, Shield, Dna, Code2, Crown, Settings,
  Search, ChevronDown, ChevronUp, ExternalLink, MessageSquare,
} from 'lucide-react'

const FAQ = [
  {
    q: 'MetaGO Studio 是什么？',
    a: 'MetaGO Studio 是元构能力的可视化工作台，让非技术用户也能开箱即用使用元构能力。提供决策锁校验、元进化档案、技能浏览、Kit配置等功能。',
  },
  {
    q: '需要付费吗？',
    a: '社区版（Free）永久免费，每日 10 万 tokens 配额。付费版有 4 档：Pro（¥39/月）/ Pro+（¥99/月）/ Team（¥199/月起）/ Enterprise（¥3万/年起）。详见"Pro升级"页面。',
  },
  {
    q: '决策锁校验是什么？',
    a: '决策锁是元构核心引擎的4道关卡校验机制：意图验证(IVL)→意图谱系追踪(ILT)→语义输出门(OSG)→内容完整性。用于确保AI输出可靠、无幻觉、无占位符。',
  },
  {
    q: '我的数据存储在哪里？',
    a: '数据存储在腾讯云CloudBase服务器（中国大陆），使用HTTPS加密传输。私有技能使用AES-GCM 256位加密，即使我们也无法解密。详见隐私政策。',
  },
  {
    q: '如何取消订阅？',
    a: 'Pro订阅到期后自动降级为免费版，不会自动续费。如需提前退款，请参考退款政策发送邮件至 support@metago.life。',
  },
  {
    q: 'Studio 和开源引擎是什么关系？',
    a: '开源引擎（@metago-ai/engine）是核心能力层，面向开发者免费使用。Studio是可视化体验层，提供云端同步、跨设备访问、图形界面，面向更广泛用户。',
  },
  {
    q: '数据可以导出吗？',
    a: '可以。在设置页面支持导出为JSON、JSONL、Markdown三种格式。导出后可导入其他设备或备份保存。',
  },
  {
    q: '遇到问题怎么办？',
    a: '1. 查看本帮助文档常见问题；2. 在设置页面提交反馈；3. 发送邮件至 support@metago.life；我们会在1-3个工作日内回复。',
  },
]

const GUIDES = [
  {
    icon: Shield,
    title: '决策锁校验入门',
    desc: '学习如何使用4道关卡校验AI输出，杜绝幻觉和占位符',
    steps: ['进入"决策锁"页面', '在输入框粘贴AI生成的代码或方案', '点击"运行校验"', '查看4道关卡校验结果', '根据阻断原因修改输入'],
  },
  {
    icon: Dna,
    title: '元进化档案使用',
    desc: '记录你的能力进化历程，追踪成长轨迹',
    steps: ['进入"进化档案"页面', '点击"+"添加记录', '填写触发器、边界、差距、动作', '保存后自动同步到云端', '在Dashboard查看进化趋势'],
  },
  {
    icon: Code2,
    title: 'Kit配置生成',
    desc: '选择需要的技能，生成定制化Kit包',
    steps: ['进入"Kit配置"页面', '从技能库选择需要的技能', '配置Kit名称和描述', '点击"生成"预览', '下载Kit包（含package.json和README）'],
  },
  {
    icon: Crown,
    title: '订阅升级',
    desc: '解锁完整功能：V3 五档定价 Free / Pro / Pro+ / Team / Enterprise',
    steps: ['进入"Pro升级"页面查看 5 档定价', '选择适合的档位（Free / Pro / Pro+ / Team / Enterprise）', '通过微信/支付宝在线支付，或输入授权码激活', '激活后自动解锁对应档位的全部功能', '在设置页面查看订阅状态、Token 余量、Team 时薪余额'],
  },
]

export function HelpPage() {
  const [search, setSearch] = useState('')
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0)
  const [expandedGuide, setExpandedGuide] = useState<number | null>(null)

  const filteredFaq = FAQ.filter(item =>
    item.q.toLowerCase().includes(search.toLowerCase()) ||
    item.a.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Hero */}
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent-emerald/10 flex items-center justify-center mx-auto mb-4">
          <HelpCircle className="w-8 h-8 text-accent-emerald" />
        </div>
        <h1 className="text-3xl font-bold text-zinc-100">帮助中心</h1>
        <p className="text-sm text-zinc-500 mt-2">在这里找到使用 MetaGO Studio 的一切答案</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索问题..."
          className="input-base w-full pl-10"
        />
      </div>

      {/* Quick Guides */}
      <section>
        <h2 className="text-lg font-semibold text-zinc-200 mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-accent-teal" />
          快速入门
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          {GUIDES.map((guide, i) => {
            const Icon = guide.icon
            const isExpanded = expandedGuide === i
            return (
              <div key={i} className="card-base overflow-hidden">
                <button
                  onClick={() => setExpandedGuide(isExpanded ? null : i)}
                  className="w-full p-4 text-left flex items-start gap-3 hover:bg-bg-hover/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-accent-emerald/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-accent-emerald" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-zinc-200">{guide.title}</h3>
                    <p className="text-xs text-zinc-500 mt-1">{guide.desc}</p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-1" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-1" />
                  )}
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <ol className="px-4 pb-4 space-y-2">
                        {guide.steps.map((step, j) => (
                          <li key={j} className="flex gap-3 text-sm text-zinc-400">
                            <span className="w-5 h-5 rounded-full bg-accent-emerald/10 text-accent-emerald text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                              {j + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-lg font-semibold text-zinc-200 mb-4 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-accent-teal" />
          常见问题
        </h2>
        {filteredFaq.length === 0 ? (
          <div className="card-base p-8 text-center">
            <p className="text-sm text-zinc-500">未找到相关问题</p>
            <p className="text-xs text-zinc-600 mt-1">尝试其他关键词，或直接联系我们</p>
          </div>
        ) : (
          <div className="card-base divide-y divide-border-subtle">
            {filteredFaq.map((item, i) => (
              <div key={i}>
                <button
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-bg-hover/30 transition-colors"
                >
                  <span className="text-sm font-medium text-zinc-200">{item.q}</span>
                  {expandedFaq === i ? (
                    <ChevronUp className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  )}
                </button>
                {expandedFaq === i && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-zinc-400 leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Contact */}
      <section>
        <h2 className="text-lg font-semibold text-zinc-200 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-accent-teal" />
          联系我们
        </h2>
        <div className="card-base p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">客服邮箱</span>
            <a href="mailto:support@metago.life" className="text-sm text-accent-emerald hover:underline">support@metago.life</a>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">官方网站</span>
            <a href="https://metago.life" target="_blank" rel="noopener noreferrer" className="text-sm text-accent-emerald hover:underline flex items-center gap-1">
              metago.life <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">开源仓库</span>
            <a href="https://github.com/metago-ai" target="_blank" rel="noopener noreferrer" className="text-sm text-accent-emerald hover:underline flex items-center gap-1">
              GitHub <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </section>

      {/* Related Docs */}
      <section>
        <h2 className="text-lg font-semibold text-zinc-200 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-accent-teal" />
          相关文档
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <a href="#/terms" className="card-base p-4 text-center hover:border-accent-emerald/30 transition-colors">
            <BookOpen className="w-5 h-5 text-accent-emerald mx-auto mb-2" />
            <span className="text-xs text-zinc-400">用户协议</span>
          </a>
          <a href="#/privacy" className="card-base p-4 text-center hover:border-accent-emerald/30 transition-colors">
            <Shield className="w-5 h-5 text-accent-emerald mx-auto mb-2" />
            <span className="text-xs text-zinc-400">隐私政策</span>
          </a>
          <a href="#/refund" className="card-base p-4 text-center hover:border-accent-emerald/30 transition-colors">
            <Crown className="w-5 h-5 text-accent-emerald mx-auto mb-2" />
            <span className="text-xs text-zinc-400">退款政策</span>
          </a>
        </div>
      </section>
    </div>
  )
}
