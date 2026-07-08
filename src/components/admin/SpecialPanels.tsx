/**
 * Admin 后台特殊交互面板
 *
 * 包含 4 个需要独立交互逻辑的 Panel：
 * - PrivateSkillReviewPanel：私有技能审核（通过/拒绝 + 内容预览）
 * - BehaviorBankPanel：行为银行（行为记录 + 信用分排行 + 人工调整）
 * - PlatformConfigPanel：平台配置（键值对 CRUD）
 * - ErrorMonitorPanel：错误监控（错误列表 + 标记已解决）
 *
 * 简单的查看型 Tab 直接用 DataExplorerPanel 配置化，不在此文件中。
 */

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Plus, Save, AlertCircle, Zap, Activity } from 'lucide-react'
import { callAdminHttp } from '../../lib/adminHttp'
import { DataExplorerPanel, type ColumnDef, type RowAction } from './DataExplorerPanel'

// ============================================================
// PrivateSkillReviewPanel — 私有技能审核
// ============================================================

const skillColumns: ColumnDef[] = [
  { field: 'name', label: '技能名', type: 'text', width: '180px' },
  { field: 'description', label: '描述', type: 'truncate', truncateLength: 60 },
  { field: 'tags', label: '标签', type: 'json', width: '120px' },
  { field: 'version', label: '版本', type: 'number', width: '60px' },
  {
    field: 'reviewStatus',
    label: '审核状态',
    type: 'badge',
    width: '100px',
    badgeMap: {
      pending: { label: '待审核', className: 'bg-amber-500/20 text-amber-400' },
      approved: { label: '已通过', className: 'bg-emerald-500/20 text-emerald-400' },
      rejected: { label: '已拒绝', className: 'bg-red-500/20 text-red-400' },
    },
  },
  { field: 'createdAt', label: '创建时间', type: 'date', width: '160px' },
  { field: 'reviewedBy', label: '审核人', type: 'text', width: '100px' },
]

export function PrivateSkillReviewPanel() {
  const [previewSkill, setPreviewSkill] = useState<any | null>(null)

  const handleReview = async (skillId: string, status: 'approved' | 'rejected' | 'pending') => {
    const label = status === 'approved' ? '通过' : status === 'rejected' ? '拒绝' : '重置'
    const note = prompt(`请输入${label}原因（可选）`) ?? ''
    const res = await callAdminHttp('reviewPrivateSkill', { skillId, status, note })
    if (res.code !== 0) alert(res.message || '操作失败')
  }

  const rowActions: RowAction[] = [
    {
      label: '预览',
      onClick: (row) => setPreviewSkill(row),
      className: 'text-accent-blue hover:bg-accent-blue/10',
    },
    {
      label: '通过',
      onClick: (row) => handleReview(row._id, 'approved'),
      className: 'text-accent-emerald hover:bg-accent-emerald/10',
      show: (row) => row.reviewStatus !== 'approved',
    },
    {
      label: '拒绝',
      onClick: (row) => handleReview(row._id, 'rejected'),
      className: 'text-red-400 hover:bg-red-500/10',
      show: (row) => row.reviewStatus !== 'rejected',
    },
    {
      label: '重置',
      onClick: (row) => handleReview(row._id, 'pending'),
      className: 'text-zinc-400 hover:bg-zinc-700',
      show: (row) => row.reviewStatus && row.reviewStatus !== 'pending',
    },
  ]

  return (
    <>
      <DataExplorerPanel
        config={{
          title: '私有技能审核',
          collection: 'private_skills',
          columns: skillColumns,
          searchFields: ['name', 'description', 'uid'],
          searchPlaceholder: '搜索技能名 / 描述 / UID',
          rowActions,
        }}
      />
      {previewSkill && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setPreviewSkill(null)}>
          <div className="bg-bg-elevated rounded-lg border border-border-subtle max-w-2xl w-full max-h-[80vh] overflow-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-zinc-100">{previewSkill.name}</h3>
              <button onClick={() => setPreviewSkill(null)} className="text-zinc-500 hover:text-zinc-300">✕</button>
            </div>
            <p className="text-xs text-zinc-400 mb-3">{previewSkill.description || '无描述'}</p>
            <div className="text-xs text-zinc-500 mb-2">技能内容（明文）：</div>
            <pre className="text-xs text-zinc-300 bg-bg-deep p-3 rounded border border-border-subtle overflow-auto max-h-60 whitespace-pre-wrap">{previewSkill.content || previewSkill.encryptedContent || '(空)'}</pre>
            {previewSkill.tags && Array.isArray(previewSkill.tags) && previewSkill.tags.length > 0 && (
              <div className="mt-3 flex gap-1 flex-wrap">
                {previewSkill.tags.map((t: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-accent-emerald/10 text-accent-emerald text-xs">{t}</span>
                ))}
              </div>
            )}
            <div className="mt-4 text-xs text-zinc-500 flex gap-4">
              <span>版本: v{previewSkill.version || 1}</span>
              <span>创建: {previewSkill.createdAt ? new Date(previewSkill.createdAt).toLocaleString('zh-CN') : '-'}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ============================================================
// BehaviorBankPanel — 行为银行（行为记录 + 信用分排行）
// ============================================================

const behaviorColumns: ColumnDef[] = [
  { field: 'uid', label: '用户 UID', type: 'code', width: '140px' },
  { field: 'type', label: '类型', type: 'badge', width: '80px', badgeMap: {
    digital: { label: '数字', className: 'bg-accent-blue/20 text-accent-blue' },
    ai: { label: 'AI', className: 'bg-accent-violet/20 text-accent-violet' },
  } },
  { field: 'category', label: '类别', type: 'text', width: '140px' },
  { field: 'action', label: '行为', type: 'text', width: '140px' },
  { field: 'value', label: '分值', type: 'number', width: '60px' },
  { field: 'source', label: '来源', type: 'text', width: '100px' },
  { field: 'timestamp', label: '时间', type: 'date', width: '160px' },
]

const creditColumns: ColumnDef[] = [
  { field: 'uid', label: '用户 UID', type: 'code', width: '140px' },
  { field: 'totalScore', label: '总分', type: 'number', width: '80px' },
  { field: 'digitalScore', label: '数字贡献', type: 'number', width: '100px' },
  { field: 'aiScore', label: 'AI 贡献', type: 'number', width: '100px' },
  { field: 'level', label: '等级', type: 'badge', width: '120px', badgeMap: {
    apprentice: { label: '元构学徒', className: 'bg-zinc-500/20 text-zinc-400' },
    artisan: { label: '元构匠人', className: 'bg-accent-blue/20 text-accent-blue' },
    expert: { label: '元构专家', className: 'bg-accent-emerald/20 text-accent-emerald' },
    master: { label: '元构大师', className: 'bg-accent-amber/20 text-accent-amber' },
    grandmaster: { label: '元构宗师', className: 'bg-accent-violet/20 text-accent-violet' },
  } },
  { field: 'lastAdjustedAt', label: '最后调整', type: 'date', width: '160px' },
]

export function BehaviorBankPanel() {
  const [subTab, setSubTab] = useState<'records' | 'scores'>('records')
  const [adjustModal, setAdjustModal] = useState<{ uid: string } | null>(null)
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  const handleAdjust = async () => {
    const d = parseInt(delta, 10)
    if (!d || !reason.trim()) {
      alert('请输入分值和原因')
      return
    }
    setAdjusting(true)
    try {
      const res = await callAdminHttp('adjustCreditScore', { uid: adjustModal!.uid, delta: d, reason: reason.trim() })
      if (res.code === 0) {
        alert(res.message)
        setAdjustModal(null)
        setDelta('')
        setReason('')
      } else {
        alert(res.message || '调整失败')
      }
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setAdjusting(false)
    }
  }

  const creditActions: RowAction[] = [
    {
      label: '调整分值',
      onClick: (row) => setAdjustModal({ uid: row.uid }),
      className: 'text-accent-amber hover:bg-accent-amber/10',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-bg-elevated/50 rounded-lg w-fit">
        <button onClick={() => setSubTab('records')} className={`px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 ${subTab === 'records' ? 'bg-accent-emerald/20 text-accent-emerald' : 'text-zinc-400 hover:text-zinc-200'}`}>
          <Activity className="w-3.5 h-3.5" /> 行为记录流水
        </button>
        <button onClick={() => setSubTab('scores')} className={`px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 ${subTab === 'scores' ? 'bg-accent-emerald/20 text-accent-emerald' : 'text-zinc-400 hover:text-zinc-200'}`}>
          <Zap className="w-3.5 h-3.5" /> 信用分排行
        </button>
      </div>

      {subTab === 'records' ? (
        <DataExplorerPanel
          config={{
            title: '行为记录流水',
            collection: 'behavior_records',
            columns: behaviorColumns,
            searchFields: ['uid', 'category', 'action', 'source'],
            searchPlaceholder: '搜索 UID / 类别 / 行为 / 来源',
            orderBy: 'timestamp',
          }}
        />
      ) : (
        <DataExplorerPanel
          config={{
            title: '信用分排行',
            collection: 'credit_scores',
            columns: creditColumns,
            searchFields: ['uid'],
            searchPlaceholder: '搜索 UID',
            orderBy: 'totalScore',
            orderDir: 'desc',
            rowActions: creditActions,
          }}
        />
      )}

      {adjustModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setAdjustModal(null)}>
          <div className="bg-bg-elevated rounded-lg border border-border-subtle max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-zinc-100 mb-1">调整信用分</h3>
            <p className="text-xs text-zinc-500 mb-4">用户: <span className="font-mono">{adjustModal.uid}</span></p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">分值变化（正数加分，负数减分）</label>
                <input type="number" value={delta} onChange={e => setDelta(e.target.value)} placeholder="例如: 50 或 -20" className="input-base w-full" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">调整原因（必填）</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="例如: 修复 bug 奖励 / 违规扣分" className="input-base w-full" rows={2} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setAdjustModal(null)} className="btn-secondary text-sm flex-1">取消</button>
              <button onClick={handleAdjust} disabled={adjusting} className="btn-primary text-sm flex-1">
                {adjusting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                确认调整
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// PlatformConfigPanel — 平台配置（键值对 CRUD）
// ============================================================

interface ConfigRow {
  _id: string
  key: string
  value: any
  note?: string
  updatedAt?: string
  updatedBy?: string
}

export function PlatformConfigPanel() {
  const [configs, setConfigs] = useState<ConfigRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editKey, setEditKey] = useState('')
  const [editValue, setEditValue] = useState('')
  const [editNote, setEditNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await callAdminHttp('listCollection', {
        collection: 'platform_configs',
        page: 1,
        pageSize: 100,
        orderBy: 'updatedAt',
        orderDir: 'desc',
      })
      if (res.code === 0) setConfigs(res.data.rows || [])
      else setError(res.message || '加载失败')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!editKey.trim()) { alert('key 必填'); return }
    setSaving(true)
    try {
      const res = await callAdminHttp('updatePlatformConfig', {
        key: editKey.trim(),
        value: editValue,
        note: editNote,
      })
      if (res.code === 0) {
        setEditKey(''); setEditValue(''); setEditNote('')
        await load()
      } else {
        alert(res.message || '保存失败')
      }
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (key: string) => {
    if (!confirm(`确认删除配置 ${key}？`)) return
    const res = await callAdminHttp('deletePlatformConfig', { key })
    if (res.code === 0) await load()
    else alert(res.message || '删除失败')
  }

  const handleEdit = (row: ConfigRow) => {
    setEditKey(row.key)
    setEditValue(typeof row.value === 'string' ? row.value : JSON.stringify(row.value, null, 2))
    setEditNote(row.note || '')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">平台全局配置（定价 / 配额 / 功能开关等），共 {configs.length} 项</p>
        <button onClick={load} className="px-3 py-1 text-xs rounded bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/30 hover:bg-accent-emerald/20 flex items-center gap-1">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> 刷新
        </button>
      </div>

      {error && (
        <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </div>
      )}

      {/* 新增/编辑表单 */}
      <div className="card-base p-4 space-y-2">
        <div className="text-xs font-medium text-zinc-300 flex items-center gap-1">
          <Plus className="w-3 h-3" /> 新增 / 编辑配置
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input value={editKey} onChange={e => setEditKey(e.target.value)} placeholder="配置 key（如 pricing.pro.monthly）" className="input-base text-xs" />
          <input value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="值（字符串或 JSON）" className="input-base text-xs md:col-span-1" />
          <input value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="备注说明" className="input-base text-xs" />
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary text-xs">
            {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            保存
          </button>
          <button onClick={() => { setEditKey(''); setEditValue(''); setEditNote('') }} className="btn-secondary text-xs">清空</button>
        </div>
      </div>

      {/* 配置列表 */}
      <div className="rounded-lg border border-border-subtle overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-deep border-b border-border-subtle">
              <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">Key</th>
              <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">Value</th>
              <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">备注</th>
              <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">更新时间</th>
              <th className="text-right px-3 py-2 text-xs text-zinc-400 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {configs.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-zinc-500 text-xs">{loading ? '加载中...' : '暂无配置'}</td></tr>
            ) : configs.map(c => (
              <tr key={c._id} className="border-b border-border-subtle/30 hover:bg-bg-hover/30">
                <td className="px-3 py-2 text-xs font-mono text-accent-emerald">{c.key}</td>
                <td className="px-3 py-2 text-xs text-zinc-300 font-mono max-w-xs truncate" title={typeof c.value === 'string' ? c.value : JSON.stringify(c.value)}>{typeof c.value === 'string' ? c.value : JSON.stringify(c.value)}</td>
                <td className="px-3 py-2 text-xs text-zinc-500">{c.note || '—'}</td>
                <td className="px-3 py-2 text-xs text-zinc-500">{c.updatedAt ? new Date(c.updatedAt).toLocaleString('zh-CN', { hour12: false }) : '—'}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => handleEdit(c)} className="text-xs px-2 py-1 rounded text-accent-blue hover:bg-accent-blue/10 mr-1">编辑</button>
                  <button onClick={() => handleDelete(c.key)} className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-500/10">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================
// ErrorMonitorPanel — 错误监控
// ============================================================

const errorColumns: ColumnDef[] = [
  { field: 'createdAt', label: '时间', type: 'date', width: '160px' },
  { field: 'level', label: '级别', type: 'badge', width: '80px', badgeMap: {
    error: { label: 'Error', className: 'bg-red-500/20 text-red-400' },
    warn: { label: 'Warn', className: 'bg-amber-500/20 text-amber-400' },
    info: { label: 'Info', className: 'bg-blue-500/20 text-blue-400' },
    fatal: { label: 'Fatal', className: 'bg-red-600/20 text-red-300' },
  } },
  { field: 'message', label: '错误信息', type: 'truncate', truncateLength: 80 },
  { field: 'stack', label: '堆栈', type: 'truncate', truncateLength: 60 },
  { field: 'url', label: '来源 URL', type: 'truncate', truncateLength: 50 },
  { field: 'uid', label: '用户', type: 'code', width: '120px' },
  {
    field: 'status',
    label: '状态',
    type: 'badge',
    width: '100px',
    badgeMap: {
      open: { label: '待处理', className: 'bg-amber-500/20 text-amber-400' },
      resolved: { label: '已解决', className: 'bg-emerald-500/20 text-emerald-400' },
      ignored: { label: '已忽略', className: 'bg-zinc-500/20 text-zinc-400' },
    },
  },
]

export function ErrorMonitorPanel() {
  const handleResolve = async (row: any, status: 'resolved' | 'ignored') => {
    const resolution = prompt(`请输入处理说明（标记为 ${status === 'resolved' ? '已解决' : '已忽略'}）`) ?? ''
    const res = await callAdminHttp('resolveErrorTicket', {
      ticketId: row._id,
      resolution,
      status,
    })
    if (res.code !== 0) alert(res.message || '操作失败')
  }

  const rowActions: RowAction[] = [
    {
      label: '解决',
      onClick: (row) => handleResolve(row, 'resolved'),
      className: 'text-accent-emerald hover:bg-accent-emerald/10',
      show: (row) => row.status !== 'resolved',
      confirm: '确认标记为已解决？',
    },
    {
      label: '忽略',
      onClick: (row) => handleResolve(row, 'ignored'),
      className: 'text-zinc-400 hover:bg-zinc-700',
      show: (row) => row.status !== 'ignored',
    },
  ]

  return (
    <DataExplorerPanel
      config={{
        title: '错误监控',
        collection: 'error_tickets',
        columns: errorColumns,
        searchFields: ['message', 'stack', 'url', 'uid'],
        searchPlaceholder: '搜索错误信息 / 堆栈 / URL / UID',
        rowActions,
      }}
    />
  )
}
