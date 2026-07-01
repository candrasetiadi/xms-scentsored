'use client'

export type HrStatus =
  | 'present' | 'late' | 'absent' | 'on_leave'
  | 'pending' | 'approved' | 'rejected'
  | 'draft' | 'finalized' | 'paid'

interface Props {
  status: string
  label?: string
}

const STATUS_CONFIG: Record<string, { cls: string; dot: string; defaultLabel: string }> = {
  present:   { cls: 'bg-success/10 text-success border border-success/20',       dot: 'bg-success',  defaultLabel: 'Hadir'     },
  late:      { cls: 'bg-warning-bg text-warning border border-warning-bd',       dot: 'bg-warning',  defaultLabel: 'Terlambat' },
  absent:    { cls: 'bg-danger-bg text-danger border border-danger-bd',          dot: 'bg-danger',   defaultLabel: 'Absen'     },
  on_leave:  { cls: 'bg-info-bg text-info border border-info-bd',                dot: 'bg-info',     defaultLabel: 'Izin/Cuti' },
  pending:   { cls: 'bg-sand-100 text-ink-500 border border-line',              dot: 'bg-ink-400',  defaultLabel: 'Menunggu'  },
  approved:  { cls: 'bg-success/10 text-success border border-success/20',       dot: 'bg-success',  defaultLabel: 'Disetujui' },
  rejected:  { cls: 'bg-danger-bg text-danger border border-danger-bd',          dot: 'bg-danger',   defaultLabel: 'Ditolak'   },
  draft:     { cls: 'bg-sand-100 text-ink-500 border border-line',              dot: 'bg-ink-400',  defaultLabel: 'Draft'     },
  finalized: { cls: 'bg-warning-bg text-warning border border-warning-bd',       dot: 'bg-warning',  defaultLabel: 'Finalisasi'},
  paid:      { cls: 'bg-success/10 text-success border border-success/20',       dot: 'bg-success',  defaultLabel: 'Dibayar'   },
}

export function StatusBadge({ status, label }: Props) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['pending']
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-sans font-medium ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full opacity-60 ${cfg.dot}`} aria-hidden="true" />
      {label ?? cfg.defaultLabel}
    </span>
  )
}
