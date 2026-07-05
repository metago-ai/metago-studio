import { motion } from 'framer-motion'
import { ShieldCheck, Award, Crown, Sparkle, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'

/**
 * MetaGO Certify 独立认证服务页面（V3 新增）
 * 元构范式合规认证 L1-L4 四级体系
 * 独立收费 ¥999-9999/次，与订阅解耦
 */

const CERTIFY_LEVELS = [
  {
    id: 'L1',
    name: '基础级',
    fullName: 'MetaGO Certify L1 · 基础级',
    price: 999,
    priceLabel: '¥999/次',
    icon: ShieldCheck,
    color: 'from-emerald-400 to-teal-500',
    description: '面向个人开发者和小团队的入门级 AI 行为合规认证',
    target: '独立开发者、个人工作室、初创团队',
    items: [
      'AI 决策锁基础校验能力认证',
      '元进化五阶段循环理解',
      '基础数据溯源能力',
      'metago-lifeform Kit 安装与使用',
      '决策锁 4 道关卡（IVL/ILT/OSG/完整性）通过率 ≥ 80%',
      '认证有效期：2 年',
    ],
    deliverables: [
      '认证证书（PDF + 链接验证）',
      'MetaGO Certify L1 数字徽章',
      '元构范式合规标准 V1.0 文档',
      'metago-lifeform 商业使用授权',
    ],
  },
  {
    id: 'L2',
    name: '进阶级',
    fullName: 'MetaGO Certify L2 · 进阶级',
    price: 4999,
    priceLabel: '¥2999-4999/次（按场景定价）',
    icon: Award,
    color: 'from-blue-400 to-cyan-500',
    description: '面向中小企业 AI 系统的合规认证，覆盖完整范式体系',
    target: '中小企业 CTO、技术决策者、AI 应用开发商',
    items: [
      'L1 全部内容 + 进阶：',
      '完整 7 层范式体系应用',
      '8 大能力族全部掌握',
      '元进化机制在团队中的落地',
      '全链路溯源与脉冲见证',
      '决策锁通过率 ≥ 90%',
      '合规主动检查通过率 ≥ 95%',
      '认证有效期：2 年',
    ],
    deliverables: [
      'L2 认证证书（PDF + 链接验证）',
      'MetaGO Certify L2 数字徽章',
      '商业项目使用授权（年营收 < 1000 万）',
      '技术白皮书 + 实施指南',
      '1 次免费复审',
    ],
  },
  {
    id: 'L3',
    name: '专业级',
    fullName: 'MetaGO Certify L3 · 专业级',
    price: 7999,
    priceLabel: '¥5999-7999/次（按场景定价）',
    icon: Crown,
    color: 'from-purple-400 to-pink-500',
    description: '面向大型企业和政府机构的 AI 治理认证',
    target: '大型企业 CTO/CIO、政府机构、行业解决方案商',
    items: [
      'L2 全部内容 + 专业：',
      '企业级 AI 治理体系设计',
      '组织转型咨询服务（含 1 次现场工作坊）',
      '法学层产品化落地（合规审计 + 数据治理）',
      '决策锁通过率 ≥ 95%',
      '元进化深度 ≥ 3 层',
      '认证有效期：3 年',
    ],
    deliverables: [
      'L3 认证证书（PDF + 链接验证 + 实体证书）',
      'MetaGO Certify L3 数字徽章',
      '企业级商业使用授权（年营收 < 1 亿）',
      'Enterprise 版本部署支持',
      '4 次免费复审',
      '1 次现场工作坊（差旅另计）',
    ],
  },
  {
    id: 'L4',
    name: '专家级',
    fullName: 'MetaGO Certify L4 · 专家级',
    price: 9999,
    priceLabel: '¥9999/次',
    icon: Sparkle,
    color: 'from-amber-400 to-orange-500',
    description: '面向行业领军企业和国家级 AI 治理的顶级认证',
    target: '行业领军企业、政府监管机构、AI 治理标准制定者',
    items: [
      'L3 全部内容 + 专家：',
      'AI 治理体系顶层设计',
      '行业 AI 行为规范标准制定参与权',
      '元构范式国际标准推进参与权',
      '决策锁通过率 ≥ 98%',
      '元进化深度 ≥ 5 层',
      '持续合规监控（年度审计）',
      '认证有效期：3 年（含年度复审）',
    ],
    deliverables: [
      'L4 认证证书（PDF + 链接验证 + 实体证书 + 安全防伪）',
      'MetaGO Certify L4 数字徽章',
      '无限制商业使用授权',
      'Enterprise 版本 + 私有部署支持',
      '无限次免费复审',
      '2 次现场工作坊（差旅另计）',
      '元构光年战略合作伙伴身份',
      '年度 AI 治理审计服务',
    ],
  },
]

const FAQ = [
  {
    q: 'MetaGO Certify 认证和订阅是什么关系？',
    a: 'Certify 是独立认证服务，与订阅（Free/Pro/Pro+/Team/Enterprise）解耦。即使您是 Free 用户，也可以单独购买 L1-L4 认证。认证费用按次收取，不含 Token 配额。',
  },
  {
    q: '认证流程是怎样的？',
    a: '1) 在本页面选择等级并支付；2) 收到确认邮件后预约认证时间；3) 完成线上/线下认证评估（1-3 个工作日）；4) 通过后颁发证书和徽章；5) 未通过可申请重做（半价）或退还 50% 费用。',
  },
  {
    q: '认证有效期多久？',
    a: 'L1/L2 有效期 2 年，L3/L4 有效期 3 年。到期后需重新认证或续期（续期费用为首次认证的 50%）。',
  },
  {
    q: '认证未通过怎么办？',
    a: '可在 30 天内申请重做（半价）。如确认无法通过，可申请退还 50% 认证费。已发起的认证流程不可全额退款。',
  },
  {
    q: '企业批量认证有优惠吗？',
    a: '团队批量认证（5 人以上）可联系 support@metago.life 申请团队折扣。L3/L4 企业客户可定制认证方案。',
  },
]

export function CertifyPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-12">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center pt-6"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-emerald/10 border border-accent-emerald/30 mb-4">
          <ShieldCheck className="w-4 h-4 text-accent-emerald" />
          <span className="text-xs text-accent-emerald font-medium">V3 独立认证服务</span>
        </div>
        <h1 className="text-4xl font-bold text-zinc-100 mb-3">
          MetaGO Certify
        </h1>
        <p className="text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          元构范式合规认证 · L1-L4 四级体系
          <br />
          让 AI 系统的行为可校验、可溯源、可治理
        </p>
        <div className="mt-4 text-sm text-zinc-500">
          独立认证服务，与订阅解耦 · ¥999 - ¥9999/次
        </div>
      </motion.div>

      {/* 标准依据 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="card-base p-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent-emerald/10 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-6 h-6 text-accent-emerald" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-zinc-200 mb-2">认证标准依据</h3>
            <p className="text-sm text-zinc-400 leading-relaxed mb-3">
              本认证基于《元构范式合规标准 V1.0》（MPC-2026-V1.0）发布，由元构光年制定，是面向所有基于大语言模型（LLM）的 AI 系统的行为合规评估的民间标准。
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-400">8 大核心合规要求</span>
              <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-400">36 条核心公理</span>
              <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-400">43 条根本属性</span>
              <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-400">108 项协议</span>
              <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-400">84 项专利保护</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 4 级认证卡片 */}
      <section>
        <h2 className="text-xl font-bold text-zinc-100 mb-6 text-center">四级认证体系</h2>
        <div className="grid md:grid-cols-2 gap-5">
          {CERTIFY_LEVELS.map((level, i) => {
            const Icon = level.icon
            return (
              <motion.div
                key={level.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                className="card-base overflow-hidden flex flex-col"
              >
                {/* Header */}
                <div className={`bg-gradient-to-br ${level.color} p-5 text-white`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-5 h-5" />
                        <span className="text-xs font-medium opacity-90">认证等级 {level.id}</span>
                      </div>
                      <h3 className="text-xl font-bold">{level.name}</h3>
                      <p className="text-xs opacity-90 mt-1">{level.fullName}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{level.priceLabel.split('/')[0]}</div>
                      <div className="text-xs opacity-90">/次</div>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 flex-1 flex flex-col">
                  <p className="text-sm text-zinc-400 mb-3">{level.description}</p>
                  <div className="text-xs text-zinc-500 mb-3">
                    <span className="font-medium text-zinc-400">适用对象：</span>
                    {level.target}
                  </div>

                  {/* 认证内容 */}
                  <div className="mb-3">
                    <h4 className="text-xs font-semibold text-zinc-300 mb-2">认证内容</h4>
                    <ul className="space-y-1.5">
                      {level.items.map((item, j) => (
                        <li key={j} className="flex items-start gap-2 text-xs text-zinc-400">
                          <CheckCircle2 className="w-3.5 h-3.5 text-accent-emerald flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 交付物 */}
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-zinc-300 mb-2">交付物</h4>
                    <ul className="space-y-1.5">
                      {level.deliverables.map((item, j) => (
                        <li key={j} className="flex items-start gap-2 text-xs text-zinc-500">
                          <ArrowRight className="w-3.5 h-3.5 text-accent-teal flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA */}
                  <div className="mt-auto pt-3 border-t border-border-subtle">
                    <Link
                      to="/pro"
                      className="block w-full py-2.5 text-center text-sm font-medium rounded-lg bg-gradient-to-r from-accent-emerald to-accent-teal text-bg-deep hover:opacity-90 transition-opacity"
                    >
                      申请 {level.id} 认证 · {level.priceLabel}
                    </Link>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-xl font-bold text-zinc-100 mb-5 text-center">常见问题</h2>
        <div className="card-base divide-y divide-border-subtle">
          {FAQ.map((item, i) => (
            <div key={i} className="p-4">
              <h4 className="text-sm font-semibold text-zinc-200 mb-2">{item.q}</h4>
              <p className="text-sm text-zinc-400 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="card-base p-8 text-center"
      >
        <h3 className="text-lg font-bold text-zinc-100 mb-2">准备好让 AI 系统获得合规认证了吗？</h3>
        <p className="text-sm text-zinc-400 mb-5">立即申请认证，或联系我们的认证顾问团队</p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/pro"
            className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-accent-emerald to-accent-teal text-bg-deep text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            立即申请
          </Link>
          <a
            href="mailto:certify@metago.life"
            className="px-6 py-2.5 rounded-lg border border-border-subtle text-zinc-300 text-sm hover:bg-bg-hover/30 transition-colors"
          >
            联系认证顾问
          </a>
        </div>
        <p className="text-xs text-zinc-600 mt-4">
          认证顾问邮箱：certify@metago.life · 工作时间：周一至周五 9:00-18:00
        </p>
      </motion.div>
    </div>
  )
}
