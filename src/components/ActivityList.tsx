import type { Activity } from '../types'
import { Shield, Dna, Play, Sparkles, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'

interface ActivityListProps {
  activities: Activity[]
}

const ACTIVITY_ICONS = {
  decision_lock: Shield,
  evolution: Dna,
  template_run: Play,
  skill_call: Sparkles,
}

const STATUS_STYLES = {
  success: { icon: CheckCircle2, color: 'text-accent-emerald', bg: 'bg-accent-emerald/10' },
  blocked: { icon: AlertTriangle, color: 'text-accent-rose', bg: 'bg-accent-rose/10' },
  pending: { icon: Clock, color: 'text-accent-amber', bg: 'bg-accent-amber/10' },
}

export function ActivityList({ activities }: ActivityListProps) {
  return (
    <div className="card-base p-5">
      <h3 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-accent-emerald" />
        最近活动
      </h3>
      <ul className="space-y-3">
        {activities.map((act) => {
          const Icon = ACTIVITY_ICONS[act.type]
          const statusStyle = STATUS_STYLES[act.status]
          const StatusIcon = statusStyle.icon
          return (
            <li
              key={act.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-bg-elevated/50 hover:bg-bg-hover transition-colors"
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${statusStyle.bg}`}
              >
                <Icon className={`w-4 h-4 ${statusStyle.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-100 truncate">
                    {act.title}
                  </span>
                  <span className="text-xs text-zinc-600 flex-shrink-0">{act.timestamp}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{act.description}</p>
              </div>
              <StatusIcon className={`w-4 h-4 ${statusStyle.color} flex-shrink-0 mt-1`} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
