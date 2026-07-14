'use client'

import { useState, useEffect, useCallback } from 'react'
import { FilterBar }   from '@/components/hr/FilterBar'
import { EmptyState }  from '@/components/hr/EmptyState'
import { StatusBadge } from '@/components/hr/StatusBadge'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormulationRow {
  id:           string
  access_token: string
  perfume_name: string | null
  status:       string
  total_grams:  number
  created_at:   string
  item_count:   number
  customer_name:  string | null
  customer_phone: string | null
  slot_date:    string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawRow = any

interface Props {
  initialRows: RawRow[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`
}
const fmtGram = (n: number) => (Number(n) % 1 === 0 ? `${n}` : Number(n).toFixed(2)) + 'g'

function resolveOne(val: unknown): Record<string, unknown> | null {
  if (!val) return null
  if (Array.isArray(val)) return (val[0] as Record<string, unknown>) ?? null
  return val as Record<string, unknown>
}

function normalizeRow(f: RawRow): FormulationRow {
  const customer = resolveOne(f.customers)
  const slot     = resolveOne(f.consultation_slots)
  return {
    id:             f.id,
    access_token:   f.access_token,
    perfume_name:   f.perfume_name ?? null,
    status:         f.status,
    total_grams:    f.total_grams,
    created_at:     f.created_at,
    customer_name:  (customer?.name  as string) || null,
    customer_phone: (customer?.phone as string) || null,
    slot_date:      (slot?.date      as string) || null,
    item_count:     Array.isArray(f.workshop_formulation_items)
                      ? f.workshop_formulation_items.length
                      : 0,
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function WorkshopAdminClient({ initialRows }: Props) {
  const [allRows,      setAllRows]      = useState<FormulationRow[]>(() => initialRows.map(normalizeRow))
  const [filterStatus, setFilterStatus] = useState('')
  const [refreshing,   setRefreshing]   = useState(false)
  const [fetchError,   setFetchError]   = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setFetchError(null)
    try {
      const res  = await fetch('/api/v1/workshop/formulations')
      const json = await res.json()
      if (!res.ok) { setFetchError(json.error ?? 'Gagal memuat data.'); return }
      setAllRows((json.data ?? []).map((f: RawRow) => ({
        id:             f.id,
        access_token:   f.access_token,
        perfume_name:   f.perfume_name ?? null,
        status:         f.status,
        total_grams:    f.total_grams,
        created_at:     f.created_at,
        customer_name:  f.customer?.name  || null,
        customer_phone: f.customer?.phone || null,
        slot_date:      f.slot?.date      || null,
        item_count:     f.item_count ?? 0,
      })))
    } catch {
      setFetchError('Koneksi gagal.')
    } finally {
      setRefreshing(false)
    }
  }, [])

  // Auto-refresh setiap 30 detik
  useEffect(() => {
    const id = setInterval(refresh, 30_000)
    return () => clearInterval(id)
  }, [refresh])

  const rows = filterStatus
    ? allRows.filter(r => r.status === filterStatus)
    : allRows

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
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-[28px] text-pine">Raw Mat Experience</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-500">{rows.length} formulasi</span>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="text-xs text-pine underline underline-offset-2 hover:no-underline disabled:opacity-40"
            >
              {refreshing ? 'Memuat…' : 'Refresh'}
            </button>
          </div>
        </div>

        <FilterBar
          fields={filterFields}
          onReset={() => setFilterStatus('')}
        />

        {fetchError && (
          <div className="bg-danger-bg border border-danger-bd text-danger text-sm rounded-xl px-4 py-3 mb-4">
            {fetchError}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="bg-white border border-line rounded-2xl">
            <EmptyState heading="Belum ada formulasi" subtext="Formulasi akan muncul di sini setelah peserta mengisi form Raw Mat Experience." />
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="md:hidden space-y-3">
              {rows.map(row => (
                <div key={row.id} className="bg-white border border-line rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink-900 text-sm">{row.customer_name ?? <span className="text-ink-400 italic">—</span>}</p>
                      {row.customer_phone && <p className="text-xs text-ink-500 mt-0.5">{row.customer_phone}</p>}
                    </div>
                    <StatusBadge status={row.status === 'finalized' ? 'finalized' : 'draft'} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-ink-400 mb-0.5">Parfum</p>
                      <p className="text-ink-900 font-medium">
                        {row.perfume_name ?? <span className="text-ink-400 italic">tanpa nama</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-ink-400 mb-0.5">Sesi</p>
                      <p className="text-ink-700">{row.slot_date ? fmtDate(row.slot_date) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-ink-400 mb-0.5">Gram</p>
                      <p className="text-ink-900 font-medium tabular-nums">{fmtGram(row.total_grams)}</p>
                    </div>
                    <div>
                      <p className="text-ink-400 mb-0.5">Bahan</p>
                      <p className="text-ink-700">{row.item_count} item</p>
                    </div>
                  </div>

                  <a
                    href={`/workshop/result/${row.access_token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-full py-2.5 rounded-xl border border-pine text-pine text-sm font-medium hover:bg-pine-50 active:scale-[0.98] transition-all"
                  >
                    Lihat Detail ↗
                  </a>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block bg-white border border-line rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-sand-50 border-b border-line text-xs font-medium text-ink-500">
                    <th className="text-left px-4 py-3 font-medium">Peserta</th>
                    <th className="text-left px-4 py-3 font-medium">Parfum</th>
                    <th className="text-left px-4 py-3 font-medium">Sesi</th>
                    <th className="text-right px-4 py-3 font-medium">Gram</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map(row => (
                    <tr key={row.id} className="hover:bg-sand-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink-900">{row.customer_name ?? <span className="text-ink-400 italic">—</span>}</p>
                        {row.customer_phone && <p className="text-xs text-ink-500">{row.customer_phone}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {row.perfume_name
                          ? <p className="text-ink-900">{row.perfume_name}</p>
                          : <p className="text-ink-400 italic">tanpa nama</p>}
                      </td>
                      <td className="px-4 py-3 text-ink-500 whitespace-nowrap">
                        {row.slot_date ? fmtDate(row.slot_date) : <span className="text-ink-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-ink-900 whitespace-nowrap">
                        {fmtGram(row.total_grams)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status === 'finalized' ? 'finalized' : 'draft'} />
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`/workshop/result/${row.access_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-pine underline underline-offset-2 hover:no-underline whitespace-nowrap"
                        >
                          Lihat ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
