const STATUS_STYLES = {
  uploading: 'bg-slate-100 text-slate-700 ring-slate-200',
  processing: 'bg-amber-50 text-amber-800 ring-amber-200',
  analyzed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  failed: 'bg-red-50 text-red-700 ring-red-200',
  deleted: 'bg-slate-100 text-slate-500 ring-slate-200',
}

export function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.uploading

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${style}`}
    >
      {status ?? 'unknown'}
    </span>
  )
}
