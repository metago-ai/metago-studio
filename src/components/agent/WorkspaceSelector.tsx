import { useState, useEffect, useCallback } from 'react'
import { FolderOpen, Clock, ChevronDown, GitBranch, Package, FileText } from 'lucide-react'
import { getFS, isFSSupported, type WorkspaceMeta } from '../../lib/fs/fsInterface'

interface WorkspaceSelectorProps {
  current: WorkspaceMeta | null
  onWorkspaceOpen: (meta: WorkspaceMeta) => void
}

/** 工作区选择器下拉 */
export function WorkspaceSelector({ current, onWorkspaceOpen }: WorkspaceSelectorProps) {
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState<WorkspaceMeta[]>([])
  const [loading, setLoading] = useState(false)
  const supported = isFSSupported()

  useEffect(() => {
    if (open) refreshRecent()
  }, [open])

  const refreshRecent = useCallback(async () => {
    try {
      const fs = await getFS()
      setRecent(fs.getRecentWorkspaces())
    } catch { /* 忽略 */ }
  }, [])

  const handleOpen = useCallback(async () => {
    setLoading(true)
    try {
      const fs = await getFS()
      const meta = await fs.openWorkspace()
      if (meta) {
        onWorkspaceOpen(meta)
        setOpen(false)
      }
    } catch (e: any) {
      alert(`打开工作区失败：${e?.message ?? e}`)
    } finally {
      setLoading(false)
    }
  }, [onWorkspaceOpen])

  const handleRestore = useCallback(async (meta: WorkspaceMeta) => {
    setLoading(true)
    try {
      const fs = await getFS()
      // 桌面端：直接用 meta.path 重新打开（无需重新授权）
      // Web 端：File System Access API 需要重新请求权限
      const isDesktopEnv = Boolean((window as any).electronAPI?.isElectron)
      if (isDesktopEnv && meta.path) {
        onWorkspaceOpen(meta)
        setOpen(false)
      } else {
        // Web 端恢复 handle 并重新授权（会恢复 recent[0]，需提示用户）
        const restored = await fs.restoreWorkspace()
        if (restored) {
          onWorkspaceOpen(restored)
          setOpen(false)
        } else {
          alert('无法自动恢复此工作区（浏览器需要重新授权），请重新选择文件夹')
          await handleOpen()
        }
      }
    } catch (e: any) {
      alert(`恢复工作区失败：${e?.message ?? e}`)
    } finally {
      setLoading(false)
    }
  }, [onWorkspaceOpen])

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={!supported || loading}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-bg-deep border border-border-subtle text-zinc-300 hover:bg-bg-hover transition-colors max-w-[280px] disabled:opacity-50 disabled:cursor-not-allowed"
        title={supported ? '切换工作区' : '当前浏览器不支持，请使用 Chrome/Edge 或下载桌面端'}
      >
        <FolderOpen className="w-3.5 h-3.5 text-accent-emerald flex-shrink-0" />
        <span className="truncate">
          {loading ? '加载中...' : current?.name ?? (supported ? '打开工作区' : '浏览器不支持')}
        </span>
        <ChevronDown className={`w-3 h-3 text-zinc-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 w-80 bg-bg-card border border-border-default rounded-lg shadow-xl z-20 max-h-96 overflow-y-auto">
            {/* 打开新工作区 */}
            <button
              onClick={handleOpen}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-accent-emerald hover:bg-bg-hover border-b border-border-subtle font-medium"
            >
              <FolderOpen className="w-4 h-4" />
              打开新工作区...
            </button>

            {/* 最近工作区 */}
            {recent.length > 0 && (
              <div className="py-1">
                <div className="px-3 py-1 text-[10px] text-zinc-600 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  最近工作区
                </div>
                {recent.map((w) => (
                  <button
                    key={w.path}
                    onClick={() => handleRestore(w)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-hover ${
                      current?.path === w.path ? 'bg-accent-emerald/10' : ''
                    }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-200 truncate">{w.name}</div>
                      <div className="text-[10px] text-zinc-500 truncate flex items-center gap-2">
                        {w.projectType && <span>{w.projectType}</span>}
                        {w.hasGit && <span className="flex items-center gap-0.5"><GitBranch className="w-2.5 h-2.5" /></span>}
                      </div>
                    </div>
                    {current?.path === w.path && (
                      <span className="text-[10px] text-accent-emerald">当前</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* 当前工作区详情 */}
            {current && (
              <div className="border-t border-border-subtle px-3 py-2 space-y-1">
                <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">当前工作区</div>
                {current.projectType && (
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                    <Package className="w-3 h-3" />
                    {current.projectType}
                  </div>
                )}
                {current.hasGit !== undefined && (
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                    <GitBranch className="w-3 h-3" />
                    {current.hasGit ? 'Git 仓库' : '非 Git 仓库'}
                  </div>
                )}
                {current.packageManager && (
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                    <FileText className="w-3 h-3" />
                    {current.packageManager}
                  </div>
                )}
              </div>
            )}

            {/* 不支持提示 */}
            {!supported && (
              <div className="px-3 py-3 text-[10px] text-zinc-500 leading-relaxed border-t border-border-subtle">
                当前浏览器不支持本地文件访问。
                <br />
                请使用 <span className="text-accent-emerald">Chrome/Edge 121+</span> 或下载桌面端。
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
