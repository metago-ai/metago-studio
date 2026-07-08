/**
 * 通用数据表探查组件
 *
 * 配置化渲染任意集合的数据表，支持：
 * - 字段定义（text/code/badge/date/json/boolean/truncate）
 * - 搜索（按指定字段 OR 模糊匹配）
 * - 分页
 * - 行操作（审核/解绑/导出等）
 * - 一键导出 JSON
 *
 * 数据来源：admin 云函数的 listCollection / exportCollection action
 */

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Search, Download, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import { callAdminHttp } from '../../lib/adminHttp'

export type ColumnType = 'text' | 'code' | 'badge' | 'date' | 'json' | 'boolean' | 'truncate' | 'number'

export interface BadgeMapEntry {
  label: string
  className: string
}

export interface ColumnDef {
  field: string
  label: string
  type?: ColumnType
  width?: string
  badgeMap?: Record<string, BadgeMapEntry>
  truncateLength?: number
  format?: (value: any, row: any) => React.ReactNode
}

export interface RowAction {
  label: string
  onClick: (row: any) => void
  className?: string
  confirm?: string
  show?: (row: any) => boolean
}

export interface DataExplorerConfig {
  title: string
  collection: string
  columns: ColumnDef[]
  searchFields?: string[]
  searchPlaceholder?: string
  orderBy?: string
  orderDir?: 'asc' | 'desc'
  rowActions?: RowAction[]
  exportable?: boolean
}

interface DataExplorerPanelProps {
  config: DataExplorerConfig
}

export function DataExplorerPanel({ config }: DataExplorerPanelProps) {
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const pageSize = 20

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await callAdminHttp('listCollection', {
        collection: config.collection,
        page,
        pageSize,
        search,
        searchFields: config.searchFields || [],
        orderBy: config.orderBy || 'createdAt',
        orderDir: config.orderDir || 'desc',
      })
      if (res.code === 0) {
        setRows(res.data.rows || [])
        setTotal(res.data.total || 0)
      } else {
        setError(res.message || '加载失败')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [config.collection, config.searchFields, config.orderBy, config.orderDir, page, search])

  useEffect(() => {
    load()
  }, [load])

  const handleExport = async () => {
    try {
      const res = await callAdminHttp('exportCollection', { collection: config.collection, limit: 5000 })
      if (res.code === 0) {
        const blob = new Blob([JSON.stringify(res.data.rows, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${config.collection}-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      alert('导出失败：' + (e as Error).message)
    }
  }

  const handleAction = async (action: RowAction, row: any) => {
    if (action.confirm && !confirm(action.confirm)) return
    await action.onClick(row)
    load()
  }

  const renderCell = (col: ColumnDef, row: any) => {
    const value = row[col.field]
    if (col.format) return col.format(value, row)
    if (value === undefined || value === null) return <span className="text-zinc-600">—</span>

    switch (col.type) {
      case 'code':
        return <span className="font-mono text-xs text-zinc-300">{String(value).slice(0, 32)}{String(value).length > 32 ? '...' : ''}</span>
      case 'number':
        return <span className="font-mono text-xs text-accent-amber">{Number(value).toLocaleString()}</span>
      case 'boolean':
        return value ? <span className="text-accent-emerald text-xs">是</span> : <span className="text-zinc-500 text-xs">否</span>
      case 'date': {
        try {
          const d = value instanceof Date ? value : new Date(value)
          return <span className="text-xs text-zinc-400 whitespace-nowrap">{d.toLocaleString('zh-CN', { hour12: false })}</span>
        } catch {
          return <span className="text-xs text-zinc-500">{String(value)}</span>
        }
      }
      case 'badge': {
        const entry = col.badgeMap?.[String(value)]
        if (entry) {
          return <span className={`px-2 py-0.5 rounded text-xs ${entry.className}`}>{entry.label}</span>
        }
        return <span className="px-2 py-0.5 rounded text-xs bg-zinc-700 text-zinc-300">{String(value)}</span>
      }
      case 'truncate': {
        const len = col.truncateLength || 50
        const str = typeof value === 'string' ? value : JSON.stringify(value)
        return <span className="text-xs text-zinc-400" title={str}>{str.length > len ? str.slice(0, len) + '...' : str}</span>
      }
      case 'json':
        return <span className="text-xs text-zinc-400 font-mono" title={JSON.stringify(value, null, 2)}>{JSON.stringify(value).slice(0, 60)}...</span>
      default:
        return <span className="text-sm text-zinc-300">{String(value)}</span>
    }
  }

  return (
    <div className="space-y-3">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 flex-wrap">
        {config.searchFields && config.searchFields.length > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-bg-deep border border-border-subtle flex-1 min-w-[200px]">
            <Search className="w-3 h-3 text-zinc-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setPage(1)}
              placeholder={config.searchPlaceholder || `搜索 ${config.searchFields.join(' / ')}`}
              className="text-xs bg-transparent text-zinc-300 focus:outline-none flex-1"
            />
          </div>
        )}
        <button onClick={load} className="px-3 py-1 text-xs rounded bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/30 hover:bg-accent-emerald/20 flex items-center gap-1">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> 刷新
        </button>
        {config.exportable !== false && (
          <button onClick={handleExport} className="px-3 py-1 text-xs rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/30 hover:bg-accent-blue/20 flex items-center gap-1">
            <Download className="w-3 h-3" /> 导出 JSON
          </button>
        )}
        <span className="text-xs text-zinc-500 ml-auto">共 {total.toLocaleString()} 条</span>
      </div>

      {error && (
        <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-400">{error}</div>
      )}

      {/* 数据表 */}
      <div className="rounded-lg border border-border-subtle overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-deep border-b border-border-subtle">
              {config.columns.map(c => (
                <th key={c.field} className="text-left px-3 py-2 font-medium text-zinc-400 text-xs" style={c.width ? { width: c.width } : undefined}>
                  {c.label}
                </th>
              ))}
              {config.rowActions && config.rowActions.length > 0 && (
                <th className="text-right px-3 py-2 font-medium text-zinc-400 text-xs">操作</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={config.columns.length + 1} className="text-center py-12">
                  <Inbox className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-zinc-500 text-sm">{loading ? '加载中...' : '暂无数据'}</p>
                </td>
              </tr>
            ) : rows.map((row, i) => (
              <tr key={row._id || i} className="border-b border-border-subtle/30 hover:bg-bg-hover/30">
                {config.columns.map(c => (
                  <td key={c.field} className="px-3 py-2 align-top">
                    {renderCell(c, row)}
                  </td>
                ))}
                {config.rowActions && config.rowActions.length > 0 && (
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {config.rowActions.filter(a => !a.show || a.show(row)).map(a => (
                      <button
                        key={a.label}
                        onClick={() => handleAction(a, row)}
                        className={`text-xs px-2 py-1 rounded ml-1 ${a.className || 'text-accent-emerald hover:bg-accent-emerald/10'}`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {total > pageSize && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>第 {page} 页，每页 {pageSize} 条</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 rounded bg-bg-elevated disabled:opacity-30 hover:bg-bg-hover flex items-center gap-1">
              <ChevronLeft className="w-3 h-3" /> 上一页
            </button>
            <button disabled={page * pageSize >= total} onClick={() => setPage(p => p + 1)} className="px-2 py-1 rounded bg-bg-elevated disabled:opacity-30 hover:bg-bg-hover flex items-center gap-1">
              下一页 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
