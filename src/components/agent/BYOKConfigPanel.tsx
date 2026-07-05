/**
 * BYOKConfigPanel - BYOK 绑定/解绑配置面板
 *
 * 功能：
 *   1. 选择 Provider（DeepSeek/OpenAI/Anthropic/GLM）
 *   2. 输入 API Key（AES-GCM 加密存储）
 *   3. 设置加密口令（PBKDF2 派生密钥）
 *   4. 可选：自定义 baseUrl / model（OpenAI 兼容）
 *   5. 绑定前调用云端 validateKey 测试 Key 有效性
 *   6. 绑定后显示状态，可解绑
 *
 * 安全提示：
 *   - 加密口令丢失 = API Key 不可恢复（需重新绑定）
 *   - 不在浏览器内存中保留明文 Key（绑定后即清除）
 */

import { useState } from 'react'
import { Key, Eye, EyeOff, Shield, Loader2, CheckCircle2, XCircle, AlertCircle, ExternalLink } from 'lucide-react'
import { bindByok, unbindByok, loadByokConfig, type ByokProvider } from '../../lib/byokService'
import { getCurrentTier } from '../../lib/proGate'
import { TIER_INFO } from '../../lib/proGate'

interface BYOKConfigPanelProps {
  onBound?: () => void
  onUnbound?: () => void
  onCancel?: () => void
}

const PROVIDERS: Array<{
  id: ByokProvider
  name: string
  description: string
  defaultBaseUrl?: string
  defaultModel?: string
  docsUrl: string
}> = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: '推荐 · 与平台默认模型一致',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-v4-pro',
    docsUrl: 'https://platform.deepseek.com/apiKeys',
  },
  {
    id: 'openai',
    name: 'OpenAI 兼容',
    description: '支持 OpenAI / Azure / 国产兼容 API',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Claude 3.5 Sonnet / Opus',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-sonnet-20241022',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'glm',
    name: '智谱 GLM',
    description: 'GLM-5V Turbo / GLM-4-Plus',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-5v-turbo',
    docsUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
  },
]

export function BYOKConfigPanel({ onBound, onUnbound, onCancel }: BYOKConfigPanelProps) {
  const tier = getCurrentTier()
  const tierName = TIER_INFO[tier]?.name || tier
  const existingConfig = loadByokConfig()

  const [provider, setProvider] = useState<ByokProvider>('deepseek')
  const [apiKey, setApiKey] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selectedProvider = PROVIDERS.find(p => p.id === provider)!

  const handleProviderChange = (id: ByokProvider) => {
    setProvider(id)
    const p = PROVIDERS.find(x => x.id === id)!
    setBaseUrl(p.defaultBaseUrl || '')
    setModel(p.defaultModel || '')
  }

  const handleBind = async () => {
    setError(null)
    setSuccess(null)

    if (!apiKey.trim()) {
      setError('请输入 API Key')
      return
    }
    if (password.length < 6) {
      setError('加密口令至少 6 位')
      return
    }
    if (password !== confirmPassword) {
      setError('两次输入的口令不一致')
      return
    }

    setLoading(true)
    try {
      const result = await bindByok({
        provider,
        apiKey: apiKey.trim(),
        password,
        baseUrl: baseUrl.trim() || undefined,
        model: model.trim() || undefined,
      })
      if (result.success) {
        setSuccess(result.message)
        setApiKey('')
        setPassword('')
        setConfirmPassword('')
        onBound?.()
      } else {
        setError(result.message)
      }
    } catch (e: any) {
      setError(e?.message || '绑定失败')
    } finally {
      setLoading(false)
    }
  }

  const handleUnbind = async () => {
    if (!confirm('确定解绑 BYOK 吗？解绑后将恢复使用平台 Token 配额。')) return
    setLoading(true)
    try {
      await unbindByok()
      setSuccess('BYOK 已解绑')
      onUnbound?.()
    } catch (e: any) {
      setError(e?.message || '解绑失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-bg-card border border-border-default rounded-xl">
      {/* 头部 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-accent-emerald/10 flex items-center justify-center">
          <Key className="w-5 h-5 text-accent-emerald" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-zinc-100">BYOK · 自带 API Key</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            当前档位：{tierName} · 绑定后零超额费用
          </p>
        </div>
      </div>

      {/* 已绑定状态 */}
      {existingConfig?.enabled && (
        <div className="mb-6 p-4 bg-accent-emerald/5 border border-accent-emerald/20 rounded-lg">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-accent-emerald flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-accent-emerald">已绑定 BYOK</div>
              <div className="text-xs text-zinc-400 mt-1 space-y-0.5">
                <div>Provider: <span className="text-zinc-200">{existingConfig.provider}</span></div>
                {existingConfig.baseUrl && (
                  <div>Base URL: <span className="text-zinc-200 font-mono text-[11px]">{existingConfig.baseUrl}</span></div>
                )}
                {existingConfig.model && (
                  <div>Model: <span className="text-zinc-200 font-mono text-[11px]">{existingConfig.model}</span></div>
                )}
                <div>绑定时间: <span className="text-zinc-200">{new Date(existingConfig.boundAt).toLocaleString('zh-CN')}</span></div>
              </div>
            </div>
            <button
              onClick={handleUnbind}
              disabled={loading}
              className="px-3 py-1.5 text-xs text-rose-400 border border-rose-500/30 rounded hover:bg-rose-500/10 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '解绑'}
            </button>
          </div>
        </div>
      )}

      {/* 安全提示 */}
      <div className="mb-5 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
        <div className="flex items-start gap-2">
          <Shield className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-300/90 leading-relaxed">
            <strong>安全说明：</strong>API Key 使用 AES-GCM 算法加密存储，加密口令仅你本人知晓。
            <strong className="text-amber-300"> 口令丢失 = Key 不可恢复</strong>，需重新绑定。
            平台永不存储明文 Key 与口令。
          </div>
        </div>
      </div>

      {/* Provider 选择 */}
      <div className="mb-5">
        <label className="block text-xs font-medium text-zinc-400 mb-2">选择 Provider</label>
        <div className="grid grid-cols-2 gap-2">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => handleProviderChange(p.id)}
              className={`p-3 text-left rounded-lg border transition-all ${
                provider === p.id
                  ? 'border-accent-emerald bg-accent-emerald/5'
                  : 'border-border-subtle hover:border-border-default'
              }`}
            >
              <div className="text-sm font-medium text-zinc-200">{p.name}</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">{p.description}</div>
            </button>
          ))}
        </div>
        <a
          href={selectedProvider.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-[11px] text-accent-emerald hover:underline"
        >
          获取 API Key <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* API Key 输入 */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">API Key</label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full px-3 py-2 pr-10 bg-bg-deep border border-border-subtle rounded-lg text-sm text-zinc-100 font-mono placeholder-zinc-600 focus:border-accent-emerald focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 加密口令 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">加密口令</label>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="至少 6 位"
              className="w-full px-3 py-2 pr-10 bg-bg-deep border border-border-subtle rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:border-accent-emerald focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">确认口令</label>
          <input
            type={showPwd ? 'text' : 'password'}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="再次输入"
            className="w-full px-3 py-2 bg-bg-deep border border-border-subtle rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:border-accent-emerald focus:outline-none"
          />
        </div>
      </div>

      {/* 高级配置 */}
      <details className="mb-5">
        <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300 select-none">
          高级配置（自定义 baseUrl / model）
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder={selectedProvider.defaultBaseUrl}
              className="w-full px-3 py-2 bg-bg-deep border border-border-subtle rounded-lg text-xs text-zinc-100 font-mono placeholder-zinc-600 focus:border-accent-emerald focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Model</label>
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder={selectedProvider.defaultModel}
              className="w-full px-3 py-2 bg-bg-deep border border-border-subtle rounded-lg text-xs text-zinc-100 font-mono placeholder-zinc-600 focus:border-accent-emerald focus:outline-none"
            />
          </div>
        </div>
      </details>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-3 bg-rose-500/5 border border-rose-500/20 rounded-lg flex items-start gap-2">
          <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-rose-300">{error}</div>
        </div>
      )}

      {/* 成功提示 */}
      {success && (
        <div className="mb-4 p-3 bg-accent-emerald/5 border border-accent-emerald/20 rounded-lg flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-accent-emerald flex-shrink-0 mt-0.5" />
          <div className="text-xs text-accent-emerald">{success}</div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            取消
          </button>
        )}
        <button
          onClick={handleBind}
          disabled={loading || !apiKey || !password}
          className="px-4 py-2 text-sm bg-accent-emerald text-white rounded-lg hover:bg-accent-emerald/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              验证中...
            </>
          ) : (
            <>
              <Key className="w-4 h-4" />
              绑定并验证
            </>
          )}
        </button>
      </div>

      {/* 提示 */}
      <div className="mt-4 p-3 bg-bg-deep rounded-lg">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-zinc-500 leading-relaxed">
            绑定前会调用 Provider 的 API 进行 1-token 测试调用以验证 Key 有效性。
            验证通过后，Key 将被加密存储，后续 AI 对话将通过你的 Key 调用，不消耗平台 Token 配额。
          </div>
        </div>
      </div>
    </div>
  )
}
