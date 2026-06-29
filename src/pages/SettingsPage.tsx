import { useState } from 'react'
import { motion } from 'framer-motion'
import { Settings as SettingsIcon, RefreshCw, Download, Upload, Trash2, Cloud, Shield, Key } from 'lucide-react'
import { useStore } from '../store/useStore'
import { TIER_INFO } from '../lib/proGate'
import { exportAndDownloadJSON, exportAndDownloadMarkdown } from '../lib/evolutionArchive'
import { exportAndDownloadLockJSONL, exportAndDownloadLockMarkdown, exportDashboardReport, type DashboardReportData } from '../lib/exporters'
import { connectPlatform, disconnectPlatform, type PlatformId } from '../lib/crossPlatformSync'

export function SettingsPage() {
  const {
    tier, license, trialDaysRemaining,
    decisionLockHistory, evolutionRecords,
    platforms, syncLogs, isSyncing,
    syncPlatform, syncAll,
    clearDecisionLockHistory, clearEvolutionRecords,
  } = useStore()

  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)

  const connectedCount = platforms.filter(p => p.status === 'connected').length

  const handleSyncAll = async () => {
    await syncAll(evolutionRecords.length)
  }

  const handleSyncOne = async (id: PlatformId) => {
    await syncPlatform(id, evolutionRecords.length)
  }

  const handleTogglePlatform = (id: PlatformId, connected: boolean) => {
    if (connected) {
      disconnectPlatform(id)
      useStore.getState().platforms = disconnectPlatform(id)
      // 触发更新
      useStore.setState({ platforms: disconnectPlatform(id) })
    } else {
      useStore.setState({ platforms: connectPlatform(id) })
    }
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
          // 导入进化档案
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
    e.target.value = '' // 重置以便重复选择
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

      {/* Pro 授权状态 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-base p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-4 h-4 text-accent-emerald" />
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">Pro 授权</h2>
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
            <div className="text-xs text-zinc-500 mb-1">试用剩余</div>
            <div className={`font-medium ${trialDaysRemaining > 0 ? 'text-accent-amber' : 'text-zinc-400'}`}>
              {trialDaysRemaining > 0 ? `${trialDaysRemaining} 天` : '—'}
            </div>
          </div>
        </div>
      </motion.div>

      {/* 跨平台同步 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="card-base p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-accent-emerald" />
            <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">跨平台同步</h2>
          </div>
          <button
            onClick={handleSyncAll}
            disabled={isSyncing || connectedCount === 0}
            className="btn-secondary text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? '同步中...' : `全部同步 (${connectedCount}/${platforms.length})`}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {platforms.map(p => (
            <div key={p.id} className="bg-bg-elevated/50 rounded-lg p-3 border border-border-subtle">
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg">{p.icon}</span>
                <button
                  onClick={() => handleTogglePlatform(p.id, p.status === 'connected')}
                  className={`w-8 h-4 rounded-full relative transition-colors ${p.status === 'connected' ? 'bg-accent-emerald' : 'bg-zinc-600'}`}
                >
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${p.status === 'connected' ? 'left-4' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="text-xs font-medium text-zinc-200">{p.name}</div>
              <div className="text-[10px] text-zinc-500 mt-1">
                {p.status === 'connected' ? (p.lastSyncAt ? `上次同步: ${p.lastSyncAt.slice(11, 16)}` : '已连接') : '未连接'}
              </div>
              {p.status === 'connected' && (
                <button
                  onClick={() => handleSyncOne(p.id)}
                  disabled={isSyncing}
                  className="mt-2 text-[10px] text-accent-emerald hover:underline disabled:opacity-50"
                >
                  立即同步
                </button>
              )}
            </div>
          ))}
        </div>

        {/* 同步日志 */}
        {syncLogs.length > 0 && (
          <div className="mt-4">
            <div className="text-xs text-zinc-500 mb-2">最近同步日志</div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {syncLogs.slice(0, 10).map(log => (
                <div key={log.id} className="flex items-center gap-2 text-xs font-mono p-1.5 bg-bg-deep/40 rounded">
                  <span className="text-zinc-500">{log.timestamp.slice(11, 19)}</span>
                  <span className="text-zinc-400">{log.platform}</span>
                  <span className={log.operation === 'pull' ? 'text-accent-blue' : log.operation === 'push' ? 'text-accent-emerald' : 'text-accent-amber'}>
                    {log.operation}
                  </span>
                  <span className="text-zinc-300 flex-1 truncate">{log.message}</span>
                  <span className={log.status === 'success' ? 'text-accent-emerald' : log.status === 'conflict' ? 'text-accent-amber' : 'text-accent-rose'}>
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
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
        <div className="mt-4 pt-4 border-t border-border-subtle grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <div className="text-zinc-500">进化记录</div>
            <div className="text-zinc-200 font-medium">{evolutionRecords.length} 条</div>
          </div>
          <div>
            <div className="text-zinc-500">决策锁记录</div>
            <div className="text-zinc-200 font-medium">{decisionLockHistory.length} 条</div>
          </div>
          <div>
            <div className="text-zinc-500">同步日志</div>
            <div className="text-zinc-200 font-medium">{syncLogs.length} 条</div>
          </div>
          <div>
            <div className="text-zinc-500">已连接平台</div>
            <div className="text-zinc-200 font-medium">{connectedCount} / {platforms.length}</div>
          </div>
        </div>
      </motion.div>

      {/* 关于 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center text-xs text-zinc-600 py-4"
      >
        MetaGO Studio Pro v1.0 · 基于《元构全息智能引擎》V36.5
        <br />
        元构光年（成都）人工智能科技有限公司 © 2026
      </motion.div>
    </div>
  )
}
