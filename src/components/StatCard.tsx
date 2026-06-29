import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  hint?: string
  trend?: { value: string; positive: boolean }
  accent?: 'emerald' | 'teal' | 'amber' | 'rose' | 'blue'
}

const ACCENT_STYLES = {
  emerald: {
    iconBg: 'bg-accent-emerald/10 text-accent-emerald',
    glow: 'shadow-[0_0_20px_rgba(16,217,133,0.15)]',
  },
  teal: {
    iconBg: 'bg-accent-teal/10 text-accent-teal',
    glow: 'shadow-[0_0_20px_rgba(20,184,166,0.15)]',
  },
  amber: {
    iconBg: 'bg-accent-amber/10 text-accent-amber',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
  },
  rose: {
    iconBg: 'bg-accent-rose/10 text-accent-rose',
    glow: 'shadow-[0_0_20px_rgba(244,63,94,0.15)]',
  },
  blue: {
    iconBg: 'bg-accent-blue/10 text-accent-blue',
    glow: 'shadow-[0_0_20px_rgba(0,212,255,0.15)]',
  },
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  trend,
  accent = 'emerald',
}: StatCardProps) {
  const style = ACCENT_STYLES[accent]
  return (
    <div
      className={`card-base p-5 transition-all duration-200 hover:scale-[1.02] ${style.glow}`}
      role="region"
      aria-label={label}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${style.iconBg}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              trend.positive
                ? 'bg-accent-emerald/10 text-accent-emerald'
                : 'bg-accent-rose/10 text-accent-rose'
            }`}
          >
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
      <div className="text-3xl font-bold text-zinc-100 leading-tight mb-1">{value}</div>
      <div className="text-sm text-zinc-400">{label}</div>
      {hint && <div className="text-xs text-zinc-600 mt-1">{hint}</div>}
    </div>
  )
}
