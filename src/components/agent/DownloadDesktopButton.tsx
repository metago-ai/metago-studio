/**
 * 桌面端下载入口（永久按钮 + 对比 Modal）
 *
 * 设计原则：
 * 1. 横幅关闭后，用户仍能找到下载入口（永久按钮在顶栏）
 * 2. 提供 Web vs 桌面端功能对比，引导用户下载桌面端
 * 3. 平台自动检测（Windows/macOS/Linux）
 *
 * 与 DownloadDesktopBanner（临时横幅）协同工作：
 * - DownloadDesktopBanner：首次访问的引导横幅（可关闭）
 * - DownloadDesktopButton：永久下载按钮（顶栏固定）
 */

import { useState, useEffect } from 'react'
import { Download, Monitor, X, Check, AlertCircle, Terminal, Folder, GitBranch, Zap, Wifi } from 'lucide-react'

const APP_VERSION = '1.1.7'
const DOWNLOAD_BASE = `https://metago.life/download`

interface PlatformAsset {
  label: string
  fileName: string
  ready: boolean
}

function detectPlatform(): PlatformAsset {
  const ua = navigator.userAgent
  if (ua.includes('Mac')) {
    return { label: 'macOS', fileName: `MetaGO-Agent-${APP_VERSION}-mac.dmg`, ready: false }
  }
  if (ua.includes('Linux')) {
    return { label: 'Linux', fileName: `MetaGO-Agent-${APP_VERSION}-linux.AppImage`, ready: false }
  }
  return { label: 'Windows', fileName: `MetaGO-Agent-${APP_VERSION}-win-x64.exe`, ready: true }
}

/** Web vs 桌面端功能对比表 */
const COMPARISON_ROWS: Array<{
  category: string
  feature: string
  web: 'full' | 'partial' | 'none'
  desktop: 'full' | 'partial' | 'none'
  icon: typeof Terminal
}> = [
  { category: 'AI 核心', feature: 'AI 对话与多轮任务', web: 'full', desktop: 'full', icon: Zap },
  { category: 'AI 核心', feature: '39 个 MCP 工具调用', web: 'full', desktop: 'full', icon: Zap },
  { category: 'AI 核心', feature: '39 个元构技能激活', web: 'full', desktop: 'full', icon: Zap },
  { category: '编辑器', feature: 'Monaco 代码编辑器', web: 'full', desktop: 'full', icon: Terminal },
  { category: '文件系统', feature: '文件树 / 读写', web: 'partial', desktop: 'full', icon: Folder },
  { category: '文件系统', feature: '真实本地文件系统', web: 'none', desktop: 'full', icon: Folder },
  { category: 'Git', feature: '查看状态 / Diff', web: 'full', desktop: 'full', icon: GitBranch },
  { category: 'Git', feature: '完整 Git 操作', web: 'partial', desktop: 'full', icon: GitBranch },
  { category: '终端', feature: 'xterm 终端', web: 'partial', desktop: 'full', icon: Terminal },
  { category: '终端', feature: 'ANSI 色彩 / vim / htop', web: 'none', desktop: 'full', icon: Terminal },
  { category: '终端', feature: '本地 shell 命令', web: 'none', desktop: 'full', icon: Terminal },
  { category: '运行时', feature: '自动更新', web: 'partial', desktop: 'full', icon: Wifi },
  { category: '运行时', feature: '离线使用（BYOK）', web: 'none', desktop: 'full', icon: Wifi },
]

function SupportBadge({ level }: { level: 'full' | 'partial' | 'none' }) {
  if (level === 'full') {
    return (
      <span className="inline-flex items-center gap-0.5 text-accent-emerald">
        <Check className="w-3 h-3" /> 完整
      </span>
    )
  }
  if (level === 'partial') {
    return (
      <span className="inline-flex items-center gap-0.5 text-accent-amber">
        <AlertCircle className="w-3 h-3" /> 受限
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-zinc-500">
      <X className="w-3 h-3" /> 不支持
    </span>
  )
}

/** 永久下载按钮（用于顶栏） */
export function DownloadDesktopButton() {
  const [open, setOpen] = useState(false)
  const [isElectron, setIsElectron] = useState(false)

  useEffect(() => {
    setIsElectron(Boolean((window as any).electronAPI))
  }, [])

  // 桌面端自身不显示下载按钮
  if (isElectron) return null

  const platform = detectPlatform()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/30 hover:bg-accent-emerald/20 transition-colors"
        title="下载 MetaGO Agent 桌面端"
      >
        <Monitor className="w-3 h-3" />
        桌面端
      </button>

      {open && <DownloadModal onClose={() => setOpen(false)} platform={platform} />}
    </>
  )
}

/** 下载 + 对比 Modal */
function DownloadModal({ onClose, platform }: { onClose: () => void; platform: PlatformAsset }) {
  const downloadUrl = `${DOWNLOAD_BASE}/${platform.fileName}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-elevated border border-border-subtle rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle sticky top-0 bg-bg-elevated z-10">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-accent-emerald" />
            <h2 className="text-sm font-display font-bold">下载 MetaGO Agent 桌面端</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-bg-hover rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-5 space-y-5">
          {/* 平台检测 + 下载按钮 */}
          <div className="text-center py-4 px-4 rounded-lg bg-gradient-to-r from-accent-emerald/10 to-accent-blue/10 border border-accent-emerald/20">
            <div className="text-xs text-zinc-400 mb-2">检测到你的系统</div>
            <div className="text-lg font-display font-bold mb-3">{platform.label}</div>
            {platform.ready ? (
              <a
                href={downloadUrl}
                download={platform.fileName}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-accent-emerald to-accent-blue text-white font-bold text-sm hover:opacity-90 transition-opacity"
              >
                <Download className="w-4 h-4" />
                下载 {platform.label} 版（v{APP_VERSION}）
              </a>
            ) : (
              <div className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-bg-deep text-zinc-500 font-medium text-sm border border-border-subtle">
                {platform.label} 版本即将上线
              </div>
            )}
            <div className="text-[10px] text-zinc-600 mt-2">
              约 88 MB · 安装后自动更新
            </div>
          </div>

          {/* Web vs 桌面端对比表 */}
          <div>
            <h3 className="text-xs font-display font-bold mb-3 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-accent-amber" />
              Web 端 vs 桌面端 功能对比
            </h3>
            <div className="rounded-lg border border-border-subtle overflow-hidden">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-bg-deep border-b border-border-subtle">
                    <th className="text-left px-3 py-2 font-medium text-zinc-400">功能</th>
                    <th className="text-center px-3 py-2 font-medium text-zinc-400 w-20">Web 端</th>
                    <th className="text-center px-3 py-2 font-medium text-zinc-400 w-20">桌面端</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, idx) => {
                    const Icon = row.icon
                    const prevRow = idx > 0 ? COMPARISON_ROWS[idx - 1] : null
                    const showCategory = !prevRow || prevRow.category !== row.category
                    return (
                      <tr key={idx} className={showCategory ? 'border-t-2 border-border-subtle/50' : 'border-t border-border-subtle/30'}>
                        <td className="px-3 py-2">
                          {showCategory && (
                            <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-0.5">{row.category}</div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <Icon className="w-3 h-3 text-zinc-500" />
                            <span className="text-zinc-300">{row.feature}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center"><SupportBadge level={row.web} /></td>
                        <td className="px-3 py-2 text-center"><SupportBadge level={row.desktop} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 推荐说明 */}
          <div className="text-[11px] text-zinc-400 leading-relaxed bg-bg-deep/50 p-3 rounded-lg border border-border-subtle">
            <strong className="text-zinc-300">💡 推荐：</strong>
            重度开发用户请使用<strong className="text-accent-emerald">桌面端</strong>获取完整体验。
            桌面端提供真实终端、完整 Git、本地文件系统、离线 BYOK 等核心能力。
            Web 端适合轻度使用和快速体验。
          </div>
        </div>
      </div>
    </div>
  )
}
