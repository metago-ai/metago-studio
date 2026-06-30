import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Phone, Code2, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

type Mode = 'signin' | 'signup'
type Tab = 'email' | 'phone' | 'github'

export function AuthPage() {
  const { signInWithEmail, signUpWithEmail, signInWithGitHub, signInWithPhone, verifyPhone, isCloudMode } = useAuth()
  const navigate = useNavigate()

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

  if (!isCloudMode) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="max-w-md w-full mx-4 p-8 rounded-2xl border border-border-subtle bg-bg-card">
          <AlertCircle className="w-12 h-12 text-accent-amber mx-auto mb-4" />
          <h2 className="text-xl font-bold text-center text-zinc-100 mb-2">云服务未配置</h2>
          <p className="text-sm text-zinc-400 text-center mb-6">
            当前为本地演示模式，数据存储在浏览器中。配置 Supabase 后可启用账号系统与云端同步。
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
      setInfo('注册成功！请检查邮箱完成验证。')
    } else {
      navigate('/')
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
    const { error } = await signInWithPhone(phone)
    setLoading(false)
    if (error) {
      setError(error)
    } else {
      setCodeSent(true)
      setInfo('验证码已发送，请查收短信')
    }
  }

  const handleVerifyCode = async () => {
    setLoading(true)
    setError(null)
    const { error } = await verifyPhone(phone, code)
    setLoading(false)
    if (error) {
      setError(error)
    } else {
      navigate('/')
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
          以游客身份继续浏览 →
        </button>
      </div>
    </div>
  )
}
