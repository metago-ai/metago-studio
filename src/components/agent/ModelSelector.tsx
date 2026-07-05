import { useState, useRef } from 'react'
import { ChevronDown, Brain, Eye, Plus, Settings as SettingsIcon, Check } from 'lucide-react'
import { BUILTIN_MODELS, loadCustomModels } from '../../lib/modelRegistry'
import type { AIModel } from '../../types'

/** 判断模型是否多模态（兼容 builtin 和 custom） */
function isMultimodalModel(model: AIModel): boolean {
  if (model.type === 'builtin') return model.category === 'multimodal'
  return model.capabilities.includes('image') || model.capabilities.includes('video') || model.capabilities.includes('file')
}

interface ModelSelectorProps {
  value: string
  onChange: (modelId: string) => void
  onOpenSettings: () => void
}

/** 模型选择器下拉 */
export function ModelSelector({ value, onChange, onOpenSettings }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [customModels, setCustomModels] = useState<AIModel[]>(() => loadCustomModels())
  const ref = useRef<HTMLDivElement>(null)

  const current = [...BUILTIN_MODELS, ...customModels].find(m => m.id === value)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-bg-deep border border-border-subtle text-zinc-300 hover:bg-bg-hover transition-colors w-full justify-between"
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {current?.category === 'multimodal' ? (
            <Eye className="w-3.5 h-3.5 text-accent-teal flex-shrink-0" />
          ) : (
            <Brain className="w-3.5 h-3.5 text-accent-emerald flex-shrink-0" />
          )}
          <span className="truncate">{current?.name ?? '选择模型'}</span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 right-0 bg-bg-card border border-border-default rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
            {/* 内置模型 */}
            <div className="px-2 py-1.5 text-[10px] text-zinc-600 uppercase tracking-wider border-b border-border-subtle">
              内置模型
            </div>
            {BUILTIN_MODELS.map(model => (
              <ModelOption
                key={model.id}
                model={model}
                active={model.id === value}
                onClick={() => {
                  onChange(model.id)
                  setOpen(false)
                }}
              />
            ))}

            {/* 自定义模型 */}
            {customModels.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-[10px] text-zinc-600 uppercase tracking-wider border-b border-border-subtle border-t">
                  我的模型
                </div>
                {customModels.map(model => (
                  <ModelOption
                    key={model.id}
                    model={model}
                    active={model.id === value}
                    onClick={() => {
                      onChange(model.id)
                      setOpen(false)
                    }}
                  />
                ))}
              </>
            )}

            {/* 添加自定义模型 */}
            <button
              onClick={() => {
                setOpen(false)
                onOpenSettings()
                setCustomModels(loadCustomModels())
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-accent-emerald hover:bg-bg-hover border-t border-border-subtle"
            >
              <Plus className="w-3.5 h-3.5" />
              添加自定义模型
            </button>

            {/* 设置 */}
            <button
              onClick={() => {
                setOpen(false)
                onOpenSettings()
                setCustomModels(loadCustomModels())
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:bg-bg-hover border-t border-border-subtle"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              模型管理
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function ModelOption({ model, active, onClick }: {
  model: AIModel
  active: boolean
  onClick: () => void
}) {
  const isMulti = isMultimodalModel(model)
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-2 px-3 py-2 text-left transition-colors ${
        active ? 'bg-accent-emerald/10' : 'hover:bg-bg-hover'
      }`}
    >
      {isMulti ? (
        <Eye className="w-3.5 h-3.5 text-accent-teal mt-0.5 flex-shrink-0" />
      ) : (
        <Brain className="w-3.5 h-3.5 text-accent-emerald mt-0.5 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-medium ${active ? 'text-accent-emerald' : 'text-zinc-200'}`}>
            {model.name}
          </span>
          {active && <Check className="w-3 h-3 text-accent-emerald" />}
        </div>
        <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">
          {'description' in model ? model.description : `${model.provider} · ${model.modelId}`}
        </div>
      </div>
    </button>
  )
}
