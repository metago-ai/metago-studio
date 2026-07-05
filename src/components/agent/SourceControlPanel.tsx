import { useState, useEffect, useCallback } from 'react'
import { GitBranch, GitCommit, Plus, Minus, RefreshCw, Sparkles, Check } from 'lucide-react'
import { getFS } from '../../lib/fs/fsInterface'
import { getGitStatus, stageFile, unstageFile, commit, generateCommitMessage, type GitStatus, type GitFileChange } from '../../lib/git/gitProvider'
import { sendSimpleChat } from '../../lib/aiClient'
import { DEFAULT_MODEL_ID } from '../../lib/modelRegistry'

interface SourceControlPanelProps {
  onFileClick: (path: string) => void
}

/** Source Control 面板（Git 集成） */
export function SourceControlPanel({ onFileClick }: SourceControlPanelProps) {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [committing, setCommitting] = useState(false)
  const [generating, setGenerating] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const fs = await getFS()
      const s = await getGitStatus(fs)
      setStatus(s)
    } catch (e) {
      console.error('Git 状态获取失败', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleStage = useCallback(async (filepath: string) => {
    try {
      const fs = await getFS()
      await stageFile(fs, filepath)
      await refresh()
    } catch (e) {
      alert('暂存失败：' + (e as Error).message)
    }
  }, [refresh])

  const handleUnstage = useCallback(async (filepath: string) => {
    try {
      const fs = await getFS()
      await unstageFile(fs, filepath)
      await refresh()
    } catch (e) {
      alert('取消暂存失败：' + (e as Error).message)
    }
  }, [refresh])

  const handleCommit = useCallback(async () => {
    if (!commitMsg.trim()) return
    setCommitting(true)
    try {
      const fs = await getFS()
      await commit(fs, commitMsg.trim())
      setCommitMsg('')
      await refresh()
    } catch (e) {
      alert('提交失败：' + (e as Error).message)
    } finally {
      setCommitting(false)
    }
  }, [commitMsg, refresh])

  const handleGenerateMessage = useCallback(async () => {
    if (!status || status.changes.length === 0) return
    setGenerating(true)
    try {
      const fs = await getFS()
      const msg = await generateCommitMessage(
        fs,
        status.changes,
        async (prompt) => {
          return sendSimpleChat(
            [{ role: 'user', content: prompt }],
            DEFAULT_MODEL_ID,
          )
        },
      )
      setCommitMsg(msg.trim())
    } catch (e) {
      alert('生成失败：' + (e as Error).message)
    } finally {
      setGenerating(false)
    }
  }, [status])

  const staged = status?.changes.filter(c => c.staged) ?? []
  const unstaged = status?.changes.filter(c => !c.staged) ?? []

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1.5 border-b border-border-subtle bg-bg-deep/50">
        <GitBranch className="w-3.5 h-3.5 text-accent-emerald" />
        <span className="text-[10px] font-medium text-zinc-300">
          {status?.branch ?? '无 Git'}
        </span>
        <button
          onClick={refresh}
          className="ml-auto p-1 text-zinc-500 hover:text-zinc-300"
          title="刷新"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!status && !loading && (
          <div className="px-3 py-4 text-center text-[10px] text-zinc-600">
            非 Git 仓库或未打开工作区
          </div>
        )}

        {/* 暂存的更改 */}
        {staged.length > 0 && (
          <div className="border-b border-border-subtle">
            <div className="px-2 py-1 text-[9px] text-zinc-600 uppercase tracking-wider flex items-center gap-1">
              <Check className="w-2.5 h-2.5" />
              暂存的更改 ({staged.length})
            </div>
            {staged.map(c => (
              <FileChangeItem
                key={c.path}
                change={c}
                onClick={() => onFileClick(c.path)}
                actionIcon="minus"
                onAction={() => handleUnstage(c.path)}
              />
            ))}
          </div>
        )}

        {/* 未暂存的更改 */}
        {unstaged.length > 0 && (
          <div>
            <div className="px-2 py-1 text-[9px] text-zinc-600 uppercase tracking-wider flex items-center gap-1">
              <Minus className="w-2.5 h-2.5" />
              更改 ({unstaged.length})
            </div>
            {unstaged.map(c => (
              <FileChangeItem
                key={c.path}
                change={c}
                onClick={() => onFileClick(c.path)}
                actionIcon="plus"
                onAction={() => handleStage(c.path)}
              />
            ))}
          </div>
        )}

        {status && status.changes.length === 0 && (
          <div className="px-3 py-4 text-center text-[10px] text-zinc-600">
            无更改
          </div>
        )}
      </div>

      {/* 提交区域 */}
      {status && status.changes.length > 0 && (
        <div className="flex-shrink-0 p-2 border-t border-border-subtle space-y-1">
          <div className="flex gap-1">
            <textarea
              value={commitMsg}
              onChange={e => setCommitMsg(e.target.value)}
              placeholder="提交消息..."
              rows={2}
              className="flex-1 px-2 py-1 text-[11px] rounded bg-bg-deep border border-border-subtle text-zinc-200 focus:outline-none resize-none"
            />
          </div>
          <div className="flex gap-1">
            <button
              onClick={handleCommit}
              disabled={!commitMsg.trim() || committing || staged.length === 0}
              className="flex-1 flex items-center justify-center gap-1 py-1 text-[10px] rounded bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20 hover:bg-accent-emerald/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <GitCommit className="w-3 h-3" />
              {committing ? '提交中...' : `提交 (${staged.length})`}
            </button>
            <button
              onClick={handleGenerateMessage}
              disabled={generating}
              className="px-2 py-1 text-[10px] rounded text-accent-blue border border-accent-blue/20 bg-accent-blue/10 hover:bg-accent-blue/20 disabled:opacity-40"
              title="AI 生成提交消息"
            >
              <Sparkles className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FileChangeItem({ change, onClick, actionIcon, onAction }: {
  change: GitFileChange
  onClick: () => void
  actionIcon: 'plus' | 'minus'
  onAction: () => void
}) {
  const statusColor = {
    added: 'text-accent-emerald',
    modified: 'text-orange-400',
    deleted: 'text-red-400',
    untracked: 'text-zinc-500',
    renamed: 'text-blue-400',
    unmodified: 'text-zinc-500',
  }[change.status]

  const statusLabel = {
    added: 'A', modified: 'M', deleted: 'D', untracked: 'U', renamed: 'R', unmodified: ' ',
  }[change.status]

  return (
    <div className="flex items-center group hover:bg-bg-hover px-2 py-0.5">
      <button onClick={onClick} className="flex-1 flex items-center gap-1.5 min-w-0">
        <span className={`text-[10px] font-mono font-bold w-3 ${statusColor}`}>
          {statusLabel}
        </span>
        <span className="text-[10px] text-zinc-300 truncate">{change.path}</span>
      </button>
      <button
        onClick={onAction}
        className="p-0.5 text-zinc-600 hover:text-accent-emerald opacity-0 group-hover:opacity-100"
        title={actionIcon === 'plus' ? '暂存' : '取消暂存'}
      >
        {actionIcon === 'plus' ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
      </button>
    </div>
  )
}
