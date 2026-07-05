import { useState } from 'react'
import {
  Settings,
  FileJson,
  FileText,
  Download,
  Hash,
  HardDrive,
  Check,
  Terminal,
} from 'lucide-react'
import type { KitConfigState, KitType, PreviewType, VerticalDomain } from '../types'
import { KIT_TYPE_LABELS, VERTICAL_LABELS, formatBytes } from '../utils/generators'

interface KitConfigProps {
  config: KitConfigState
  onChange: (next: KitConfigState) => void
  selectedCount: number
  totalSize: number
  onGenerate: (type: PreviewType) => void
  onDownloadKit: () => void
  onGenerateInstallScript: () => void
}

export function KitConfig({
  config,
  onChange,
  selectedCount,
  totalSize,
  onGenerate,
  onDownloadKit,
  onGenerateInstallScript,
}: KitConfigProps) {
  const [downloaded, setDownloaded] = useState(false)
  const [scriptGenerated, setScriptGenerated] = useState(false)

  const update = <K extends keyof KitConfigState>(key: K, value: KitConfigState[K]) => {
    onChange({ ...config, [key]: value })
  }

  const handleDownload = () => {
    onDownloadKit()
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 1600)
  }

  const handleGenerateScript = () => {
    onGenerateInstallScript()
    setScriptGenerated(true)
    setTimeout(() => setScriptGenerated(false), 1600)
  }

  const disabled = selectedCount === 0
  const kitTypes = Object.entries(KIT_TYPE_LABELS) as [KitType, string][]
  const verticals = Object.entries(VERTICAL_LABELS) as [VerticalDomain, string][]

  return (
    <div className="card-base flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border-subtle flex items-center gap-2">
        <Settings className="w-4 h-4 text-accent-emerald" />
        <h2 className="text-sm font-semibold text-zinc-100">Kit 配置</h2>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Kit 名称</label>
          <input
            type="text"
            value={config.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="my-custom-kit"
            className="input-base font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">版本号</label>
          <input
            type="text"
            value={config.version}
            onChange={(e) => update('version', e.target.value)}
            placeholder="1.0.0"
            className="input-base font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">描述</label>
          <textarea
            value={config.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="这个 Kit 的用途..."
            rows={3}
            className="input-base resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">类型</label>
            <select
              value={config.type}
              onChange={(e) => update('type', e.target.value as KitType)}
              className="input-base"
            >
              {kitTypes.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">垂直领域</label>
            <select
              value={config.vertical}
              onChange={(e) => update('vertical', e.target.value as VerticalDomain)}
              className="input-base"
            >
              {verticals.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="bg-bg-elevated/50 rounded-lg p-2.5 border border-border-subtle">
            <div className="flex items-center gap-1 text-[11px] text-zinc-500">
              <Hash className="w-3 h-3" />
              技能数
            </div>
            <div className="text-lg font-semibold text-zinc-100 mt-0.5">
              {selectedCount}
            </div>
          </div>
          <div className="bg-bg-elevated/50 rounded-lg p-2.5 border border-border-subtle">
            <div className="flex items-center gap-1 text-[11px] text-zinc-500">
              <HardDrive className="w-3 h-3" />
              预估大小
            </div>
            <div className="text-lg font-semibold text-zinc-100 mt-0.5">
              {formatBytes(totalSize)}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-border-subtle space-y-2">
        <button
          onClick={() => onGenerate('package.json')}
          disabled={disabled}
          className="btn-primary w-full"
        >
          <FileJson className="w-4 h-4" />
          生成 package.json
        </button>
        <button
          onClick={() => onGenerate('README.md')}
          disabled={disabled}
          className="btn-secondary w-full"
        >
          <FileText className="w-4 h-4" />
          生成 README.md
        </button>
        <button
          onClick={handleDownload}
          disabled={disabled}
          className="btn-secondary w-full"
        >
          {downloaded ? (
            <Check className="w-4 h-4 text-accent-emerald" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {downloaded ? '已下载' : '下载 Kit 配置'}
        </button>
        <button
          onClick={handleGenerateScript}
          disabled={disabled}
          className="btn-secondary w-full"
        >
          {scriptGenerated ? (
            <Check className="w-4 h-4 text-accent-emerald" />
          ) : (
            <Terminal className="w-4 h-4" />
          )}
          {scriptGenerated ? '已生成' : '生成安装脚本'}
        </button>
        {disabled && (
          <p className="text-[11px] text-zinc-600 text-center pt-1">
            请先在左侧选择至少一个技能
          </p>
        )}
      </div>
    </div>
  )
}
