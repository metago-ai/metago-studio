import { useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Shield, RefreshCcw, Mail, ChevronDown, ChevronUp } from 'lucide-react'

type DocType = 'terms' | 'privacy' | 'refund'

const DOC_CONTENT: Record<DocType, { title: string; updated: string; sections: { heading: string; body: string }[] }> = {
  terms: {
    title: '用户协议',
    updated: '2026-07-06',
    sections: [
      {
        heading: '一、服务说明',
        body: 'MetaGO Studio（以下简称"本服务"）是由元构能力（以下简称"我们"）提供的在线可视化工作台，帮助用户使用元构能力进行AI输出校验、能力进化追踪等。本服务通过网站 metago.life 提供访问。使用本服务即表示您同意本协议全部条款。',
      },
      {
        heading: '二、账号注册',
        body: '1. 您可以通过匿名方式使用部分免费功能，也可注册账号使用完整功能。\n2. 注册时请提供真实有效的信息，因信息不实导致的损失由您自行承担。\n3. 您的账号仅限本人使用，不得转让、出借或售卖。\n4. 如发现账号存在安全风险，请立即联系我们。',
      },
      {
        heading: '三、订阅服务',
        body: '1. 本服务采用 V3 五档定价：Free（社区版）/ Pro（个人版 ¥39/月或¥390/年）/ Pro+（专业版 ¥99/月或¥990/年）/ Team（团队版 ¥199/月起或¥1990/年，含500小时数字员工时长，超出按 ¥0.5/小时）/ Enterprise（企业版 ¥30000/年起，含5席位，加席 ¥6000/席位/年，强制 BYOK）。\n2. 独立认证服务（MetaGO Certify）：L1 ¥999 / L2 ¥2999-4999 / L3 ¥5999-7999 / L4 ¥9999，按次收费，不退不换。\n3. 社区版（Free）每日 10 万 tokens 配额，永久免费，无需付费。\n4. Pro/Pro+/Team/Enterprise 订阅付款后立即生效，授权码绑定后立即激活。\n5. Team 版含 500 小时数字员工时长（按月重置），超出部分按 ¥0.5/小时 计费。\n6. Enterprise 版强制 BYOK（自带 API Key），平台不收取 Token 费用，仅收年费和席位费。\n7. 您可以随时在设置中查看订阅状态、到期时间和余量。',
      },
      {
        heading: '四、用户行为规范',
        body: '您不得利用本服务从事以下行为：\n1. 违反法律法规的活动\n2. 侵犯他人知识产权或隐私\n3. 传播恶意代码或病毒\n4. 对服务进行攻击、破解或反向工程\n5. 滥用API接口或进行DDoS攻击\n6. 利用本服务生成违法违规内容\n\n违反以上规范，我们有权立即终止服务并封禁账号，不退还已付费用。',
      },
      {
        heading: '五、知识产权',
        body: '1. 本服务的界面、代码、文档等知识产权归我们所有。\n2. 元构核心引擎以MIT协议开源，遵循开源协议使用。\n3. 您使用本服务产生的内容归您所有。\n4. 未经授权，不得复制、传播本服务的付费功能或内容。',
      },
      {
        heading: '六、免责声明',
        body: '1. 本服务提供的决策锁校验、能力评估等功能仅供参考，不构成任何专业建议。\n2. 因网络故障、服务器维护等原因导致服务中断，我们不承担赔偿责任。\n3. 因您自身原因（账号泄露、违规操作）导致的损失，由您自行承担。\n4. 本服务可能存在未发现的缺陷，我们不保证服务完全无错误。',
      },
      {
        heading: '七、协议变更',
        body: '我们保留随时修改本协议的权利。协议变更后，我们将在服务内通知用户。继续使用服务即视为同意变更后的协议。',
      },
      {
        heading: '八、联系方式',
        body: '如有任何问题，请通过以下方式联系我们：\n邮箱：support@metago.life\n官方网站：https://metago.life',
      },
    ],
  },
  privacy: {
    title: '隐私政策',
    updated: '2026-07-01',
    sections: [
      {
        heading: '一、信息收集',
        body: '我们收集的信息包括：\n1. 账号信息：邮箱、手机号、GitHub昵称（视注册方式而定）\n2. 使用数据：您的进化档案、决策锁校验记录、私有技能等\n3. 设备信息：浏览器类型、访问时间等基本日志\n4. 支付信息：订单号、支付金额（不存储完整支付凭证）\n\n我们不收集您的身份证号、银行卡完整信息等敏感数据。',
      },
      {
        heading: '二、信息使用',
        body: '收集的信息仅用于：\n1. 提供云端数据同步和跨设备访问\n2. 订阅授权验证\n3. 服务运营分析（匿名聚合数据）\n4. 安全防护和反欺诈\n\n我们不会将您的数据出售给第三方。',
      },
      {
        heading: '三、数据存储',
        body: '1. 您的数据存储在腾讯云CloudBase服务器（位于中国大陆）。\n2. 私有技能使用AES-GCM 256位加密存储，即使我们也无法解密。\n3. 数据传输使用HTTPS加密。\n4. 数据库启用Row Level Security，用户只能访问自己的数据。',
      },
      {
        heading: '四、数据共享',
        body: '除以下情况外，我们不会共享您的数据：\n1. 获得您的明确同意\n2. 法律法规要求或司法机关命令\n3. 与支付服务商（微信支付）共享必要的支付信息\n4. 与云服务提供商（腾讯云）共享必要的运行数据',
      },
      {
        heading: '五、数据删除',
        body: '1. 您可以在设置中导出自己的全部数据。\n2. 您可以联系我们删除账号和全部数据。\n3. 账号删除后，数据将在30天内从生产环境彻底清除。\n4. 法律法规要求保留的数据除外。',
      },
      {
        heading: '六、Cookie使用',
        body: '本服务使用localStorage存储登录状态和用户偏好，不使用跟踪类Cookie。清除浏览器数据将导致登出。',
      },
      {
        heading: '七、未成年人保护',
        body: '本服务不面向13岁以下未成年人。如发现未成年人注册使用，我们将删除其账号。',
      },
      {
        heading: '八、政策更新',
        body: '本政策可能不时更新。重大变更时我们将在服务内通知。继续使用服务即视为同意更新后的政策。',
      },
    ],
  },
  refund: {
    title: '退款政策',
    updated: '2026-07-06',
    sections: [
      {
        heading: '一、社区版（Free）',
        body: '社区版永久免费，每日 10 万 tokens 配额，无需付费，无退款问题。配额每日 0 点重置。',
      },
      {
        heading: '二、订阅退款（Pro/Pro+/Team/Enterprise）',
        body: '1. 月度订阅：付款后7天内且 Token 使用量不超过配额的 10%，可申请全额退款。\n   - Pro 月度：7天内且月用量 ≤ 50万 tokens\n   - Pro+ 月度：7天内且月用量 ≤ 200万 tokens\n   - Team 月度：7天内且月用量 ≤ 200万 tokens，且数字员工时长 ≤ 50小时\n2. 年度订阅：付款后15天内且 Token 使用量不超过配额的 15%，可申请全额退款。\n3. Enterprise 年度：付款后30天内可申请全额退款（强制 BYOK，无 Token 消耗）。加席费用一经使用不可退。\n4. 超出上述条件的退款申请，我们将根据实际情况酌情处理。\n5. 因违规被封禁的账号，不退还已付费用。\n6. BYOK（自带 API Key）模式下，平台不收取 Token 费用，仅订阅费可退。用户自行消耗的第三方 API 费用，平台无法退回。',
      },
      {
        heading: '三、Certify 认证退款',
        body: 'MetaGO Certify 认证服务（L1-L4）按次收费，认证一旦发起不可退款。如因平台原因导致认证流程无法完成，可申请重做或退还认证费。认证未通过的不退费。',
      },
      {
        heading: '四、Team 时薪超额退款',
        body: 'Team 版超出 500 小时部分按 ¥0.5/小时 计费，已使用的时薪费用不予退款。可在月底前关闭时薪超额功能，避免继续计费。',
      },
      {
        heading: '五、退款流程',
        body: '1. 发送退款申请至 support@metago.life\n2. 邮件中请提供：注册邮箱/手机号、订单号、退款原因\n3. 我们将在3个工作日内审核并回复\n4. 审核通过后，退款将在7个工作日内原路退回\n5. 退款到账时间取决于支付渠道，一般为1-3个工作日',
      },
      {
        heading: '六、不予退款情形',
        body: '以下情况不予退款：\n1. 超出退款期限\n2. 账号因违规被封禁\n3. 已使用授权码激活且 Token 使用量超过退款限额\n4. 恶意退款（重复购买退款）\n5. BYOK 模式下用户已消耗自己 API Key 的费用\n6. Certify 认证已发起\n7. Team 时薪已使用部分',
      },
      {
        heading: '七、授权码退款',
        body: '通过授权码激活的用户，授权码一旦使用不可退换。请在购买前确认需求。未使用的授权码可联系客服处理。',
      },
    ],
  },
}

export function LegalPage({ type }: { type: DocType }) {
  const [expanded, setExpanded] = useState<number | null>(0)
  const doc = DOC_CONTENT[type]
  const icons = { terms: FileText, privacy: Shield, refund: RefreshCcw }
  const Icon = icons[type]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent-emerald/10 flex items-center justify-center mx-auto mb-4">
          <Icon className="w-8 h-8 text-accent-emerald" />
        </div>
        <h1 className="text-3xl font-bold text-zinc-100">{doc.title}</h1>
        <p className="text-sm text-zinc-500 mt-2">最后更新：{doc.updated}</p>
      </div>

      <div className="card-base divide-y divide-border-subtle">
        {doc.sections.map((section, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-bg-hover/30 transition-colors"
            >
              <span className="text-base font-semibold text-zinc-200">{section.heading}</span>
              {expanded === i ? (
                <ChevronUp className="w-5 h-5 text-zinc-500 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-zinc-500 flex-shrink-0" />
              )}
            </button>
            {expanded === i && (
              <div className="px-5 pb-5">
                <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-line">{section.body}</p>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="card-base p-5 flex items-center gap-3">
        <Mail className="w-5 h-5 text-accent-emerald flex-shrink-0" />
        <div className="text-sm">
          <p className="text-zinc-300">如有疑问，请联系我们</p>
          <a href="mailto:support@metago.life" className="text-accent-emerald hover:underline">support@metago.life</a>
        </div>
      </div>
    </div>
  )
}
