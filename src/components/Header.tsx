import { Sparkles, Eye, Package } from 'lucide-react'

interface HeaderProps {
  onPreview: () => void
  onGenerate: () => void
  selectedCount: number
}

export function Header({ onPreview, onGenerate, selectedCount }: HeaderProps) {
  const disabled = selectedCount === 0

  return (
    <header className="h-16 flex-shrink-0 border-b border-border-subtle bg-bg-card/60 backdrop-blur-md flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent-emerald to-accent-teal flex items-center justify-center shadow-glow flex-shrink-0">
          <span className="text-bg-deep font-bold text-lg leading-none">M</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-semibold text-zinc-100 leading-tight truncate">
            MetaGO Studio
          </h1>
          <p className="text-[11px] text-zinc-500 leading-tight truncate">可视化技能编排平台</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bg-elevated border border-border-subtle text-xs text-zinc-400"
          aria-label={`已选 ${selectedCount} 个技能`}
        >
          <Sparkles className="w-3 h-3 text-accent-emerald" />
          {selectedCount} 技能
        </span>
        <button
          onClick={onPreview}
          disabled={disabled}
          className="btn-secondary"
          aria-label="预览 Kit 配置"
        >
          <Eye className="w-4 h-4" />
          <span className="hidden sm:inline">预览</span>
        </button>
        <button
          onClick={onGenerate}
          disabled={disabled}
          className="btn-primary"
          aria-label="生成 Kit"
        >
          <Package className="w-4 h-4" />
          <span className="hidden sm:inline">生成 Kit</span>
        </button>
      </div>
    </header>
  )
}
