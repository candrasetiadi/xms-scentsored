'use client'

import { useState, useEffect, useCallback } from 'react'
import { FilterBar }   from '@/components/hr/FilterBar'
import { EmptyState }  from '@/components/hr/EmptyState'
import { StatusBadge } from '@/components/hr/StatusBadge'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Branch { id: string; name: string }

interface FormulationRow {
  id:           string
  access_token: string
  perfume_name: string | null
  theme:        string | null
  total_grams:  number
  status:       string
  created_at:   string
  item_count:   number
  customer:     { name: string; phone: string | null } | null
  slot:         { date: string } | null
}

interface Props {
  branches: Branch[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`
}
const fmtGram = (n: number) => (Number(n) % 1 === 0 ? `${n}` : Number(n).toFixed(2)) + 'g'

// ── Main ──────────────────────────────────────────────────────────────────────

export function WorkshopAdminClient({ branches: _branches }: Props) {
  const [rows,         setRows]         = useState<FormulationRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [filterStatus, setFilterStatus] = useState('')

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.set('status', filterStatus)
      const res  = await fetch(`/api/v1/workshop/formulations?${params}`)
      const json = await res.json()
      setRows(json.data ?? [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [filterStatus])

  useEffect(() => { fetchRows() }, [fetchRows])

  const filterFields = [
    {
      key: 'status', type: 'select' as const, label: 'Status', value: filterStatus,
      onChange: setFilterStatus,
      options: [
        { value: '', label: 'Semua Status' },
        { value: 'draft',     label: 'Draft' },
        { value: 'finalized', label: 'Selesai' },
      ],
    },
  ]

  return (
    <div className="bg-sand-50 min-h-full p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-ink-900">Formulasi Workshop</h1>
          <span className="text-sm text-ink-500">{rows.length} formulasi</span>
        </div>

        <FilterBar
          fields={filterFields}
          onReset={() => setFilterStatus('')}
        />

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white border border-line rounded-2xl p-4 animate-pulse">
                <div className="h-4 w-40 bg-sand-100 rounded mb-2" />
                <div className="h-3 w-60 bg-sand-100 rounded" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white border border-line rounded-2xl">
            <EmptyState heading="Belum ada formulasi" subtext="Formulasi akan muncul di sini setelah peserta mengisi form workshop." />
          </div>
        ) : (
          <div className="bg-white border border-line rounded-2xl overflow-hidden">
            {/* Desktop header */}
            <div className="hidden md:grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-4 px-4 py-2.5 bg-sand-50 border-b border-line text-xs font-medium text-ink-500">
              <span>Peserta</span>
              <span>Parfum</span>
              <span>Sesi</span>
              <span className="text-right">Gram</span>
              <span>Status</span>
              <span>Link</span>
            </div>

            {rows.map((row, i) => (
              <div
                key={row.id}
                className={`flex flex-col md:grid md:grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-2 md:gap-4 p-4 ${i < rows.length - 1 ? 'border-b border-line' : ''}`}
              >
                {/* Peserta */}
                <div>
                  <p className="text-sm font-semibold text-ink-900">{row.customer?.name ?? '—'}</p>
                  {row.customer?.phone && <p className="text-xs text-ink-500">{row.customer.phone}</p>}
                </div>

                {/* Parfum */}
                <div>
                  <p className="text-sm text-ink-900">{row.perfume_name ?? <span className="text-ink-400 italic">tanpa nama</span>}</p>
                  {row.theme && <p className="text-xs text-ink-500">{row.theme}</p>}
                </div>

                {/* Sesi */}
                <div className="text-sm text-ink-500 md:text-center">
                  {row.slot?.date ? fmtDate(row.slot.date) : <span className="text-ink-300">—</span>}
                </div>

                {/* Gram */}
                <div className="text-sm tabular-nums text-right text-ink-900 font-medium">
                  {fmtGram(row.total_grams)}
                </div>

                {/* Status */}
                <div>
                  <StatusBadge status={row.status === 'finalized' ? 'finalized' : 'draft'} />
                </div>

                {/* Link */}
                <div>
                  <a
                    href={`/workshop/result/${row.access_token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-pine underline underline-offset-2 hover:no-underline"
                  >
                    Lihat ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
