const RISK_STYLES = {
  low: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  medium: 'bg-amber-50 text-amber-800 ring-amber-200',
  high: 'bg-red-50 text-red-700 ring-red-200',
}

export function RiskBadge({ level, score }) {
  if (!level && score == null) {
    return <span className="text-sm text-slate-400">—</span>
  }

  const style = RISK_STYLES[level] ?? 'bg-slate-100 text-slate-700 ring-slate-200'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${style}`}
    >
      {level ?? 'unknown'}
      {score != null ? <span className="font-normal opacity-80">({score})</span> : null}
    </span>
  )
}
