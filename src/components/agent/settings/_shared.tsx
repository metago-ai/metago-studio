import type { ReactNode } from 'react'

/** 共享 UI 组件（设置面板通用） */

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <div className="mb-3">
        <h4 className="text-xs font-semibold text-zinc-200">{title}</h4>
        {description && <p className="text-[10px] text-zinc-500 mt-0.5">{description}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

export function ToggleRow({
  label, description, checked, onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1 min-w-0 pr-3">
        <div className="text-xs text-zinc-200">{label}</div>
        {description && <div className="text-[10px] text-zinc-500 mt-0.5">{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
          checked ? 'bg-accent-emerald' : 'bg-zinc-700'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </button>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-[10px] text-zinc-500 mb-1">{label}</label>
      {children}
      {hint && <div className="text-[10px] text-zinc-600 mt-1">{hint}</div>}
    </div>
  )
}

export const inputCls = "w-full px-2.5 py-1.5 bg-bg-deep border border-border-subtle rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent-emerald/50"

export const selectCls = inputCls

export function PrimaryButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30 hover:bg-accent-emerald/25 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}

export function DangerButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 border border-red-500/30"
    >
      {children}
    </button>
  )
}

export function GhostButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:bg-bg-hover"
    >
      {children}
    </button>
  )
}

export function EmptyState({ icon, title, description }: { icon?: ReactNode; title: string; description?: string }) {
  return (
    <div className="text-center py-8 border border-dashed border-border-subtle rounded-lg">
      {icon && <div className="flex justify-center mb-2 text-zinc-600">{icon}</div>}
      <div className="text-xs text-zinc-400">{title}</div>
      {description && <div className="text-[10px] text-zinc-600 mt-1">{description}</div>}
    </div>
  )
}
