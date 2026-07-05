import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Settings as SettingsIcon, Download, Upload, Trash2, Cloud, Shield, Key, Database, CheckCircle2, ArrowRight } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useAuth } from '../contexts/AuthContext'
import { TIER_INFO } from '../lib/proGate'
import { isByokActive, isByokRequired, loadByokConfig } from '../lib/byokService'
import { exportAndDownloadJSON, exportAndDownloadMarkdown } from '../lib/evolutionArchive'
import { exportAndDownloadLockJSONL, exportAndDownloadLockMarkdown, exportDashboardReport, type DashboardReportData } from '../lib/exporters'

export function SettingsPage() {
  const {
    tier, license,
    decisionLockHistory, evolutionRecords,
    cloudUserId,
    clearDecisionLockHistory, clearEvolutionRecords,
  } = useStore()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)

  // BYOK 绑定状态（用户自带 API Key）
  const byokConfig = loadByokConfig()
  const byokBound = isByokActive()
  const byokRequired = isByokRequired()
  const byokAllowed = tier === 'pro' || tier === 'pro_plus' || tier === 'team' || tier === 'enterprise'
  const byokProviderLabel: Record<string, string> = {
    deepseek: 'DeepSeek',
    openai: 'OpenAI 兼容',
    anthropic: 'Anthropic Claude',
    glm: '智谱 GLM',
  }

  const handleExportDashboard = () => {
    const data: DashboardReportData = {
      generatedAt: new Date().toISOString(),
      planTier: TIER_INFO[tier].name,
      totalSkills: useStore.getState().skills.length,
      totalEvolutions: evolutionRecords.length,
      evolutionRecords,
      decisionLockRecords: decisionLockHistory,
      lockStats: useStore.getState().lockStats,
    }
    exportDashboardReport(data)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string
        const data = JSON.parse(content)
        if (Array.isArray(data.records)) {
          for (const r of data.records) {
            useStore.getState().addEvolutionRecord(r)
          }
          setImportMessage(`成功导入 ${data.records.length} 条进化记录`)
        } else if (Array.isArray(data)) {
          for (const r of data) {
            useStore.getState().addEvolutionRecord(r)
          }
          setImportMessage(`成功导入 ${data.length} 条进化记录`)
        } else {
          setImportMessage('文件格式无效')
        }
      } catch {
        setImportMessage('解析失败：文件不是有效的 JSON')
      } finally {
        setImporting(false)
        setTimeout(() => setImportMessage(null), 3000)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 头部 */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <SettingsIcon className="w-6 h-6 text-accent-emerald" />
        <h1 className="text-2xl font-bold text-zinc-100">设置</h1>
      </motion.div>

      {/* 订阅授权状态（V3：Free/Pro/Pro+/Team/Enterprise 五档） */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-base p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-4 h-4 text-accent-emerald" />
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">订阅授权</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xs text-zinc-500 mb-1">当前档位</div>
            <div className={`font-medium ${tier === 'free' ? 'text-zinc-400' : 'text-accent-emerald'}`}>
              {TIER_INFO[tier].name}
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 mb-1">授权邮箱</div>
            <div className="font-mono text-xs text-zinc-300">{license?.email || '未激活'}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 mb-1">授权码</div>
            <div className="font-mono text-xs text-zinc-300">{license?.licenseKey || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 mb-1">到期时间</div>
            <div className="font-mono text-xs text-zinc-300">
              {license?.expiresAt ? new Date(license.expiresAt).toLocaleDateString('zh-CN') : '—'}
            </div>
          </div>
        </div>
      </motion.div>

      {/* BYOK 绑定状态（自带 API Key） */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.025 }}
        className="card-base p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Key className={`w-4 h-4 ${byokBound || byokRequired ? 'text-accent-violet' : 'text-zinc-400'}`} />
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">BYOK 绑定</h2>
          {byokBound && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-accent-emerald/10 text-accent-emerald">已激活</span>
          )}
          {byokRequired && !byokBound && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400">必须绑定</span>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-bg-elevated/40 border border-border-subtle">
            <Key className="w-4 h-4 flex-shrink-0 mt-0.5 text-zinc-400" />
            <div className="flex-1">
              <div className="text-sm text-zinc-200">
                {byokRequired
                  ? '企业版强制 BYOK'
                  : byokBound
                    ? `已绑定：${byokConfig ? byokProviderLabel[byokConfig.provider] ?? byokConfig.provider : '未知'}`
                    : byokAllowed
                      ? '未绑定'
                      : '当前档位不支持'}
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {byokRequired
                  ? '企业版需绑定自己的 API Key，数据不出企业，零 Token 费用'
                  : byokBound
                    ? `模型：${byokConfig?.model ?? '默认'} · 所有 AI 对话通过你的 Key 调用，不消耗平台配额`
                    : byokAllowed
                      ? '绑定自己的 API Key（DeepSeek/OpenAI/Claude/GLM），超额时零费用调用'
                      : '升级到 Pro 或更高档位后可绑定自己的 API Key，享受零超额费用'}
              </div>
            </div>
            <button
              onClick={() => navigate('/pro?tab=byok')}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1 ${
                byokBound || byokRequired
                  ? 'border-border-subtle text-zinc-300 hover:bg-bg-hover'
                  : byokAllowed
                    ? 'border-accent-emerald/50 text-accent-emerald hover:bg-accent-emerald/10'
                    : 'border-accent-amber/50 text-accent-amber hover:bg-accent-amber/10'
              }`}
            >
              {byokBound ? '管理' : byokRequired ? '立即绑定' : byokAllowed ? '立即绑定' : '升级'}
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* 数据存储与同步 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="card-base p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-4 h-4 text-accent-emerald" />
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">数据存储与同步</h2>
        </div>
        <div className="space-y-3">
          {/* 本地存储 */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-bg-elevated/40 border border-border-subtle">
            <CheckCircle2 className="w-4 h-4 text-accent-emerald flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm text-zinc-200">本地存储（localStorage）</div>
              <div className="text-xs text-zinc-500 mt-0.5">
                决策锁历史、进化档案、私有技能均存储在浏览器本地，已启用
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-accent-emerald/10 text-accent-emerald">已启用</span>
          </div>

          {/* 云端同步 */}
          <div className={`flex items-start gap-3 p-3 rounded-lg border ${
            cloudUserId
              ? 'bg-accent-emerald/5 border-accent-emerald/30'
              : 'bg-bg-elevated/40 border-border-subtle'
          }`}>
            <Cloud className={`w-4 h-4 flex-shrink-0 mt-0.5 ${cloudUserId ? 'text-accent-emerald' : 'text-zinc-600'}`} />
            <div className="flex-1">
              <div className="text-sm text-zinc-200">云端同步（CloudBase）</div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {cloudUserId
                  ? `已登录，数据自动同步到云端（UID: ${cloudUserId.slice(0, 12)}...）`
                  : '登录后自动启用，数据将在多设备间同步'}
              </div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded ${
              cloudUserId
                ? 'bg-accent-emerald/10 text-accent-emerald'
                : 'bg-zinc-700 text-zinc-500'
            }`}>
              {cloudUserId ? '已同步' : '未登录'}
            </span>
          </div>

          {/* 账户信息 */}
          {user && !user.isAnonymous && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-bg-elevated/40 border border-border-subtle">
              <Shield className="w-4 h-4 text-accent-blue flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm text-zinc-200">登录账户</div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {user.email || user.phone || user.displayName || '已登录用户'}
                  {user.loginType && ` · ${user.loginType}`}
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* 数据导出/导入 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-base p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-accent-emerald" />
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">数据管理</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 导出 */}
          <div className="space-y-2">
            <div className="text-xs text-zinc-500">数据导出</div>
            <button
              onClick={handleExportDashboard}
              className="btn-secondary w-full text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              仪表盘综合报告（Markdown）
            </button>
            <button
              onClick={() => exportAndDownloadJSON(evolutionRecords)}
              disabled={evolutionRecords.length === 0}
              className="btn-secondary w-full text-xs disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              进化档案（JSON）
            </button>
            <button
              onClick={() => exportAndDownloadMarkdown(evolutionRecords)}
              disabled={evolutionRecords.length === 0}
              className="btn-secondary w-full text-xs disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              进化档案（Markdown）
            </button>
            <button
              onClick={() => exportAndDownloadLockJSONL(decisionLockHistory)}
              disabled={decisionLockHistory.length === 0}
              className="btn-secondary w-full text-xs disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              决策锁日志（JSONL）
            </button>
            <button
              onClick={() => exportAndDownloadLockMarkdown(decisionLockHistory)}
              disabled={decisionLockHistory.length === 0}
              className="btn-secondary w-full text-xs disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              决策锁日志（Markdown）
            </button>
          </div>

          {/* 导入 + 清空 */}
          <div className="space-y-2">
            <div className="text-xs text-zinc-500">数据导入与清理</div>
            <label className="btn-secondary w-full text-xs cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              {importing ? '导入中...' : '导入进化档案（JSON）'}
              <input
                type="file"
                accept=".json,.jsonl"
                onChange={handleImport}
                className="hidden"
              />
            </label>
            {importMessage && (
              <div className="text-xs p-2 rounded bg-accent-emerald/10 text-accent-emerald">{importMessage}</div>
            )}
            <button
              onClick={() => {
                if (confirm(`确定清空 ${decisionLockHistory.length} 条决策锁记录？此操作不可撤销。`)) {
                  clearDecisionLockHistory()
                }
              }}
              disabled={decisionLockHistory.length === 0}
              className="btn-ghost w-full text-xs text-accent-rose hover:bg-accent-rose/10 disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              清空决策锁历史
            </button>
            <button
              onClick={() => {
                if (confirm(`确定清空 ${evolutionRecords.length} 条进化记录？此操作不可撤销。`)) {
                  clearEvolutionRecords()
                }
              }}
              disabled={evolutionRecords.length === 0}
              className="btn-ghost w-full text-xs text-accent-rose hover:bg-accent-rose/10 disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              清空进化档案
            </button>
          </div>
        </div>

        {/* 统计摘要 */}
        <div className="mt-4 pt-4 border-t border-border-subtle grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-zinc-500">进化记录</div>
            <div className="text-zinc-200 font-medium">{evolutionRecords.length} 条</div>
          </div>
          <div>
            <div className="text-zinc-500">决策锁记录</div>
            <div className="text-zinc-200 font-medium">{decisionLockHistory.length} 条</div>
          </div>
          <div>
            <div className="text-zinc-500">云端同步</div>
            <div className={`font-medium ${cloudUserId ? 'text-accent-emerald' : 'text-zinc-400'}`}>
              {cloudUserId ? '已启用' : '未登录'}
            </div>
          </div>
        </div>
      </motion.div>

      {/* 关于 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center text-xs text-zinc-600 py-4"
      >
        MetaGO Studio Pro v1.1.7 · 基于《元构全息智能引擎》V36.6
        <br />
        元构光年（成都）人工智能科技有限公司 © 2026
      </motion.div>
    </div>
  )
}
