import { useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, Phone, Code2, ArrowRight, Loader2, AlertCircle, CheckCircle2, Sparkles, Zap, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'

type Mode = 'signin' | 'signup'
type Tab = 'email' | 'phone' | 'github'

export function AuthPage() {
  const { signInWithEmail, signUpWithEmail, signInWithGitHub, signInWithPhone, isCloudMode } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/profile'

  const [mode, setMode] = useState<Mode>('signin')
  const [tab, setTab] = useState<Tab>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [codeSent, setCodeSent] = useState(false)
  const verifyFnRef = useRef<((token: string) => Promise<{ error: string | null }>) | null>(null)

  // V3：注册成功后的 Pro 订阅引导（不再有试用）
  const [justSignedUp, setJustSignedUp] = useState(false)

  // 注册成功引导视图
  if (justSignedUp) {
    return (
      <div className="flex items-center justify-center min-h-full py-8 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* 成功标识 */}
          <div className="text-center mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
              className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-accent-emerald to-accent-teal flex items-center justify-center shadow-glow mb-4"
            >
              <CheckCircle2 className="w-9 h-9 text-bg-deep" />
            </motion.div>
            <h1 className="text-2xl font-bold text-zinc-100">注册成功！</h1>
            <p className="text-sm text-zinc-400 mt-1">欢迎加入 MetaGO Studio</p>
          </div>

          {/* Pro 订阅引导卡片（V3：替代试用） */}
          <div className="rounded-2xl border border-accent-emerald/30 bg-gradient-to-br from-accent-emerald/10 via-bg-card to-bg-card p-6 relative overflow-hidden">
            {/* 装饰光效 */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-accent-emerald/10 rounded-full blur-2xl" />

            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-accent-emerald" />
                <span className="text-xs font-semibold text-accent-emerald uppercase tracking-wider">解锁能力</span>
              </div>

              <h2 className="text-lg font-bold text-zinc-100 mb-1">订阅 Pro，开启 AI 生命体增强</h2>
              <p className="text-xs text-zinc-400 mb-4">
                Pro ¥39/月起 · Pro+ ¥99/月起 · 含决策锁硬校验、元进化档案、能力仪表盘
              </p>

              {/* 功能亮点 */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                {[
                  { icon: Zap, text: '决策锁强制校验' },
                  { icon: Sparkles, text: '元进化档案' },
                  { icon: Zap, text: '能力仪表盘' },
                  { icon: Sparkles, text: '跨平台同步' },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-300">
                    <f.icon className="w-3.5 h-3.5 text-accent-emerald/80" />
                    {f.text}
                  </div>
                ))}
              </div>

              {/* 订阅按钮 */}
              <button
                onClick={() => navigate('/pro')}
                className="w-full py-3 rounded-lg bg-accent-emerald text-bg-deep font-bold text-sm hover:bg-accent-emerald/90 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-accent-emerald/20"
              >
                立即订阅 Pro <ArrowRight className="w-4 h-4" />
              </button>

              {/* 稍后再说 */}
              <button
                onClick={() => navigate(redirectTo)}
                className="w-full mt-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                稍后再说，先逛逛
              </button>
            </div>
          </div>

          <button
            onClick={() => navigate(redirectTo)}
            className="w-full mt-4 flex items-center justify-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-3 h-3" /> 跳过引导
          </button>
        </motion.div>
      </div>
    )
  }

  if (!isCloudMode) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="max-w-md w-full mx-4 p-8 rounded-2xl border border-border-subtle bg-bg-card">
          <AlertCircle className="w-12 h-12 text-accent-amber mx-auto mb-4" />
          <h2 className="text-xl font-bold text-center text-zinc-100 mb-2">云服务未配置</h2>
          <p className="text-sm text-zinc-400 text-center mb-6">
            当前为本地演示模式，数据存储在浏览器中。配置腾讯云 CloudBase 后可启用账号系统与云端同步。
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-2.5 rounded-lg bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30 font-medium text-sm hover:bg-accent-emerald/25 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  const handleEmail = async () => {
    setLoading(true)
    setError(null)
    setInfo(null)
    const fn = mode === 'signin' ? signInWithEmail : signUpWithEmail
    const { error } = await fn(email, password)
    setLoading(false)
    if (error) {
      setError(error)
    } else if (mode === 'signup') {
      setJustSignedUp(true)
    } else {
      navigate(redirectTo)
    }
  }

  const handleGitHub = async () => {
    setLoading(true)
    setError(null)
    const { error } = await signInWithGitHub()
    setLoading(false)
    if (error) setError(error)
  }

  const handleSendCode = async () => {
    setLoading(true)
    setError(null)
    const { error, verifyFn } = await signInWithPhone(phone)
    setLoading(false)
    if (error) {
      setError(error)
    } else if (verifyFn) {
      verifyFnRef.current = verifyFn
      setCodeSent(true)
      setInfo('验证码已发送，请查收短信')
    } else {
      setError('验证码发送异常')
    }
  }

  const handleVerifyCode = async () => {
    if (!verifyFnRef.current) {
      setError('请先发送验证码')
      return
    }
    setLoading(true)
    setError(null)
    const { error } = await verifyFnRef.current(code)
    setLoading(false)
    if (error) {
      setError(error)
    } else {
      navigate(redirectTo)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-full py-8">
      <div className="w-full max-w-md mx-4">
        {/* Logo + 标题 */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto rounded-xl bg-gradient-to-br from-accent-emerald to-accent-teal flex items-center justify-center shadow-glow mb-3">
            <span className="text-bg-deep font-bold text-2xl">M</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">MetaGO Studio</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {mode === 'signin' ? '登录你的工作台' : '创建新账号'}
          </p>
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-1 p-1 rounded-lg bg-bg-deep/50 border border-border-subtle mb-6">
          <button
            onClick={() => setTab('email')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${
              tab === 'email' ? 'bg-accent-emerald/15 text-accent-emerald' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Mail className="w-3.5 h-3.5" /> 邮箱
          </button>
          <button
            onClick={() => setTab('phone')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${
              tab === 'phone' ? 'bg-accent-emerald/15 text-accent-emerald' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Phone className="w-3.5 h-3.5" /> 手机
          </button>
          <button
            onClick={() => setTab('github')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${
              tab === 'github' ? 'bg-accent-emerald/15 text-accent-emerald' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" /> GitHub
          </button>
        </div>

        {/* 邮箱表单 */}
        {tab === 'email' && (
          <div className="space-y-4 p-6 rounded-2xl border border-border-subtle bg-bg-card">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 rounded-lg bg-bg-deep border border-border-subtle text-sm text-zinc-100 placeholder-zinc-600 focus:border-accent-emerald/50 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEmail()}
                placeholder="至少 6 位"
                className="w-full px-3 py-2.5 rounded-lg bg-bg-deep border border-border-subtle text-sm text-zinc-100 placeholder-zinc-600 focus:border-accent-emerald/50 focus:outline-none transition-colors"
              />
            </div>
            {error && <p className="text-xs text-accent-rose">{error}</p>}
            {info && (
              <p className="text-xs text-accent-emerald flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {info}
              </p>
            )}
            <button
              onClick={handleEmail}
              disabled={loading || !email || !password}
              className="w-full py-2.5 rounded-lg bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30 font-medium text-sm hover:bg-accent-emerald/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  {mode === 'signin' ? '登录' : '注册'} <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <p className="text-center text-xs text-zinc-500">
              {mode === 'signin' ? '没有账号？' : '已有账号？'}
              <button
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null) }}
                className="text-accent-emerald hover:underline ml-1"
              >
                {mode === 'signin' ? '注册' : '登录'}
              </button>
            </p>
          </div>
        )}

        {/* 手机表单 */}
        {tab === 'phone' && (
          <div className="space-y-4 p-6 rounded-2xl border border-border-subtle bg-bg-card">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">手机号</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+86 138 0000 0000"
                className="w-full px-3 py-2.5 rounded-lg bg-bg-deep border border-border-subtle text-sm text-zinc-100 placeholder-zinc-600 focus:border-accent-emerald/50 focus:outline-none transition-colors"
              />
            </div>
            {codeSent && (
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">验证码</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                  placeholder="6 位数字"
                  maxLength={6}
                  className="w-full px-3 py-2.5 rounded-lg bg-bg-deep border border-border-subtle text-sm text-zinc-100 placeholder-zinc-600 focus:border-accent-emerald/50 focus:outline-none transition-colors tracking-widest"
                />
              </div>
            )}
            {error && <p className="text-xs text-accent-rose">{error}</p>}
            {info && (
              <p className="text-xs text-accent-emerald flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {info}
              </p>
            )}
            {!codeSent ? (
              <button
                onClick={handleSendCode}
                disabled={loading || !phone}
                className="w-full py-2.5 rounded-lg bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30 font-medium text-sm hover:bg-accent-emerald/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '发送验证码'}
              </button>
            ) : (
              <button
                onClick={handleVerifyCode}
                disabled={loading || !code}
                className="w-full py-2.5 rounded-lg bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30 font-medium text-sm hover:bg-accent-emerald/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '验证并登录'}
              </button>
            )}
          </div>
        )}

        {/* GitHub OAuth */}
        {tab === 'github' && (
          <div className="p-6 rounded-2xl border border-border-subtle bg-bg-card space-y-4">
            <p className="text-sm text-zinc-400 text-center">
              使用 GitHub 账号一键登录，开发者推荐。
            </p>
            <button
              onClick={handleGitHub}
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700 font-medium text-sm hover:bg-zinc-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  <Code2 className="w-4 h-4" /> GitHub 登录
                </>
              )}
            </button>
            {error && <p className="text-xs text-accent-rose text-center">{error}</p>}
          </div>
        )}

        {/* 返回首页 */}
        <button
          onClick={() => navigate('/')}
          className="w-full mt-6 text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ← 返回首页浏览
        </button>
      </div>
    </div>
  )
}
