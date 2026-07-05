/**
 * Web 端桌面端下载引导
 *
 * 在 Web 端显示"下载桌面版"横幅，点击下载真实 exe。
 * 桌面端（Electron）自动隐藏。
 *
 * 真实下载地址：https://metago.life/download/MetaGO-Agent-{version}-win-x64.exe
 */

import { useState, useEffect } from 'react'
import { Download, X, Monitor } from 'lucide-react'

const APP_VERSION = '1.1.7'
/** 官方域名下载根路径（绑定 metago.life） */
const DOWNLOAD_BASE = `https://metago.life/download`

interface PlatformAsset {
  label: string
  fileName: string
  /** 资产是否已就绪（false 时按钮变为"敬请期待"） */
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
  // 默认 Windows（已就绪）
  return { label: 'Windows', fileName: `MetaGO-Agent-${APP_VERSION}-win-x64.exe`, ready: true }
}

export function DownloadDesktopBanner() {
  const [dismissed, setDismissed] = useState(false)
  const [isElectron, setIsElectron] = useState(false)

  useEffect(() => {
    setIsElectron(Boolean((window as any).electronAPI))
  }, [])

  if (isElectron || dismissed) return null

  const platform = detectPlatform()
  const downloadUrl = `${DOWNLOAD_BASE}/${platform.fileName}`

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-accent-emerald/10 to-accent-blue/10 border-b border-accent-emerald/20 text-xs">
      <Monitor className="w-4 h-4 text-accent-emerald flex-shrink-0" />
      <span className="text-zinc-300">
        桌面端支持完整文件系统、真实终端和本地 Git。
      </span>
      {platform.ready ? (
        <a
          href={downloadUrl}
          download={platform.fileName}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-accent-emerald border border-accent-emerald/30 bg-accent-emerald/10 hover:bg-accent-emerald/20 font-medium"
          title={`下载 ${platform.fileName}`}
        >
          <Download className="w-3 h-3" />
          下载 {platform.label} 版
        </a>
      ) : (
        <span
          className="flex items-center gap-1 px-2 py-0.5 rounded text-zinc-500 border border-zinc-700 bg-zinc-800/50 cursor-not-allowed"
          title={`${platform.label} 版本即将上线`}
        >
          {platform.label} 版即将上线
        </span>
      )}
      <button
        onClick={() => setDismissed(true)}
        className="ml-auto p-1 text-zinc-500 hover:text-zinc-300"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}
