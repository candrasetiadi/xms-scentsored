'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Attendance {
  clock_in:       string | null
  clock_out:      string | null
  worked_minutes: number | null
  is_full_shift:  boolean
  shift_bonus:    number
}

interface StaffRow {
  id:             string
  name:           string
  role:           string
  designation_id: string | null
  is_designated:  boolean
  attendance:     Attendance | null
  loading:        boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner', admin: 'Admin', cashier: 'Kasir',
  perfumer: 'Peracik', stock_keeper: 'Stock Keeper',
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function fmtMinutes(m: number | null) {
  if (m == null) return '—'
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${h}j ${min}m`
}

function fmtRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FullShiftClient() {
  const [date,       setDate]       = useState(todayDate)
  const [rows,       setRows]       = useState<StaffRow[]>([])
  const [fetching,   setFetching]   = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const load = useCallback(async (d: string) => {
    setFetching(true)
    setFetchError(null)
    try {
      const res  = await fetch(`/api/v1/hr/full-shift-designations?date=${d}`)
      const json = await res.json()
      if (!res.ok) { setFetchError(json.error ?? 'Gagal memuat data.'); return }
      setRows((json.data ?? []).map((s: StaffRow) => ({ ...s, loading: false })))
    } catch {
      setFetchError('Koneksi gagal.')
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => { load(date) }, [date, load])

  async function toggle(row: StaffRow) {
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, loading: true } : r))

    try {
      if (row.is_designated && row.designation_id) {
        const res = await fetch(`/api/v1/hr/full-shift-designations/${row.designation_id}`, { method: 'DELETE' })
        if (!res.ok && res.status !== 204) {
          const json = await res.json().catch(() => ({}))
          alert(json.error ?? 'Gagal menghapus penunjukan.')
          setRows(prev => prev.map(r => r.id === row.id ? { ...r, loading: false } : r))
          return
        }
        setRows(prev => prev.map(r =>
          r.id === row.id ? { ...r, is_designated: false, designation_id: null, loading: false } : r
        ))
      } else {
        const res  = await fetch('/api/v1/hr/full-shift-designations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, staff_id: row.id }),
        })
        const json = await res.json()
        if (!res.ok) {
          alert(json.error ?? 'Gagal menambah penunjukan.')
          setRows(prev => prev.map(r => r.id === row.id ? { ...r, loading: false } : r))
          return
        }
        setRows(prev => prev.map(r =>
          r.id === row.id
            ? { ...r, is_designated: true, designation_id: json.data?.id ?? null, loading: false }
            : r
        ))
      }
    } catch {
      alert('Koneksi gagal.')
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, loading: false } : r))
    }
  }

  const designatedCount = rows.filter(r => r.is_designated).length

  return (
    <div className="bg-sand-50 min-h-full p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-xl font-bold text-ink-900">Penunjukan Full Shift</h1>
          <p className="text-sm text-ink-400 mt-0.5">
            Tandai karyawan yang ditugaskan bekerja Full Shift pada tanggal tertentu.
            Bonus otomatis diberikan saat clock out jika jam kerja memenuhi syarat.
          </p>
        </div>

        {/* Date picker */}
        <div className="bg-white border border-line rounded-2xl p-4 mb-4 flex items-center gap-4">
          <label className="text-sm font-medium text-ink-700 shrink-0">Tanggal</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="flex-1 text-sm border border-line rounded-lg px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-pine/30"
          />
          {designatedCount > 0 && (
            <span className="shrink-0 text-sm font-semibold text-pine">
              {designatedCount} ditunjuk
            </span>
          )}
        </div>

        {fetchError && (
          <div className="bg-danger-bg border border-danger-bd text-danger text-sm rounded-xl px-4 py-3 mb-4">
            {fetchError}
          </div>
        )}

        {/* Staff list */}
        {fetching ? (
          <div className="bg-white border border-line rounded-2xl p-8 text-center text-ink-400 text-sm">
            Memuat…
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white border border-line rounded-2xl p-8 text-center text-ink-400 text-sm">
            Tidak ada karyawan aktif.
          </div>
        ) : (
          <div className="bg-white border border-line rounded-2xl overflow-hidden divide-y divide-line">
            {rows.map(row => {
              const att = row.attendance
              const hasClockIn  = !!att?.clock_in
              const hasClockOut = !!att?.clock_out
              const qualifies   = att && row.is_designated && att.is_full_shift

              return (
                <div key={row.id} className="flex items-center gap-4 px-4 py-3.5">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-pine-100 text-pine flex items-center justify-center text-sm font-semibold shrink-0 select-none">
                    {row.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-ink-900 truncate">{row.name}</p>
                      <span className="text-xs text-ink-400 bg-sand-100 px-1.5 py-0.5 rounded-md">
                        {ROLE_LABEL[row.role] ?? row.role}
                      </span>
                      {qualifies && (
                        <span className="text-xs font-semibold text-pine bg-pine-50 border border-pine/20 px-1.5 py-0.5 rounded-md">
                          Full Shift ✓
                        </span>
                      )}
                    </div>

                    {/* Attendance summary */}
                    {hasClockIn ? (
                      <p className="text-xs text-ink-400 mt-0.5">
                        Masuk {fmtTime(att!.clock_in)}
                        {hasClockOut
                          ? ` · Keluar ${fmtTime(att!.clock_out)} · ${fmtMinutes(att!.worked_minutes)}${att!.shift_bonus > 0 ? ` · Bonus ${fmtRp(att!.shift_bonus)}` : ''}`
                          : ' · Belum clock out'}
                      </p>
                    ) : (
                      <p className="text-xs text-ink-300 mt-0.5">Belum absen</p>
                    )}
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => toggle(row)}
                    disabled={row.loading}
                    aria-pressed={row.is_designated}
                    className={[
                      'relative inline-flex w-11 h-6 rounded-full transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-pine/40 disabled:opacity-50',
                      row.is_designated ? 'bg-pine' : 'bg-sand-300',
                    ].join(' ')}
                  >
                    <span className={[
                      'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                      row.is_designated ? 'translate-x-5' : 'translate-x-0',
                    ].join(' ')} />
                    <span className="sr-only">
                      {row.is_designated ? 'Hapus penunjukan Full Shift' : 'Tunjuk Full Shift'}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 bg-white border border-line rounded-2xl p-4">
          <p className="text-xs font-semibold text-ink-500 mb-2">Cara kerja</p>
          <ul className="space-y-1 text-xs text-ink-400">
            <li>• Aktifkan toggle untuk menunjuk karyawan bekerja Full Shift.</li>
            <li>• Saat clock out, sistem otomatis mengecek jam kerja vs. konfigurasi minimum.</li>
            <li>• Jika memenuhi syarat, bonus dicatat di absensi dan masuk ke payroll.</li>
            <li>• Status "Full Shift ✓" muncul setelah karyawan clock out dan qualify.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
