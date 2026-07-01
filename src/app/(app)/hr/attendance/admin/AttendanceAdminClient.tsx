'use client'

import { useState, useEffect, useCallback } from 'react'
import { SectionHeader }       from '@/components/hr/SectionHeader'
import { StatusBadge }         from '@/components/hr/StatusBadge'
import { FilterBar }           from '@/components/hr/FilterBar'
import { EmptyState }          from '@/components/hr/EmptyState'
import { TableWrapper, Th, Td } from '@/components/hr/TableWrapper'
import { BottomSheet }          from '@/components/hr/BottomSheet'
import { FormCard }             from '@/components/hr/FormCard'
import { useToast }             from '@/components/hr/Toast'

interface Branch { id: string; name: string }

interface AttendanceRow {
  id:             string
  staff_name:     string
  branch_name:    string
  date:           string
  clock_in_at:    string | null
  clock_out_at:   string | null
  worked_minutes: number | null
  status:         string
}

interface Summary { present: number; late: number; absent: number; on_leave: number }

interface Props {
  branches:        Branch[]
  defaultBranchId: string | null
  role:            string
}

const inputCls = 'w-full border border-line-strong rounded-md px-3 py-2.5 text-sm font-sans text-ink-900 bg-white focus:border-pine-400 focus:ring-2 focus:ring-pine-100 outline-none'

function formatTime(iso: string | null) {
  if (!iso) return '–'
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function formatWorked(min: number | null) {
  if (!min || min <= 0) return '–'
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h}j ${m}m` : `${h}j`
}

export function AttendanceAdminClient({ branches, defaultBranchId }: Props) {
  const { showToast } = useToast()
  const today = new Date().toISOString().split('T')[0]

  const [branchId, setBranchId] = useState(defaultBranchId ?? '')
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo,   setDateTo]   = useState(today)
  const [search,   setSearch]   = useState('')
  const [status,   setStatus]   = useState('')

  const [rows,     setRows]     = useState<AttendanceRow[]>([])
  const [summary,  setSummary]  = useState<Summary>({ present: 0, late: 0, absent: 0, on_leave: 0 })
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const [manualOpen,   setManualOpen]   = useState(false)
  const [manualStaff,  setManualStaff]  = useState('')
  const [manualDate,   setManualDate]   = useState(today)
  const [manualIn,     setManualIn]     = useState('')
  const [manualOut,    setManualOut]    = useState('')
  const [manualNote,   setManualNote]   = useState('')
  const [manualLoading, setManualLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo })
      if (branchId) params.set('branch_id', branchId)
      if (status)   params.set('status', status)
      if (search)   params.set('search', search)
      const res  = await fetch(`/api/v1/hr/attendance?${params}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error?.message ?? 'Gagal memuat data.'); return }
      setRows(json.data?.records ?? [])
      setSummary(json.data?.summary ?? { present: 0, late: 0, absent: 0, on_leave: 0 })
    } catch {
      setError('Koneksi gagal.')
    } finally {
      setLoading(false)
    }
  }, [branchId, dateFrom, dateTo, status, search])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleManualSave() {
    if (!manualStaff || !manualDate || !manualIn) { showToast('Isi kolom wajib.', 'error'); return }
    setManualLoading(true)
    try {
      const res  = await fetch('/api/v1/hr/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: manualStaff, date: manualDate, clock_in_at: manualIn, clock_out_at: manualOut || null, note: manualNote }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error?.message ?? 'Gagal menyimpan.', 'error'); return }
      showToast('Absensi berhasil disimpan.')
      setManualOpen(false)
      fetchData()
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setManualLoading(false)
    }
  }

  const filterFields = [
    {
      key: 'branch', type: 'select' as const, label: 'Cabang', value: branchId,
      onChange: setBranchId,
      options: [{ value: '', label: 'Semua Cabang' }, ...branches.map(b => ({ value: b.id, label: b.name }))],
    },
    { key: 'from', type: 'date' as const, label: 'Dari', value: dateFrom, onChange: setDateFrom },
    { key: 'to',   type: 'date' as const, label: 'Sampai', value: dateTo, onChange: setDateTo },
    {
      key: 'status', type: 'select' as const, label: 'Status', value: status,
      onChange: setStatus,
      options: [
        { value: '', label: 'Semua Status' },
        { value: 'present',  label: 'Hadir' },
        { value: 'late',     label: 'Terlambat' },
        { value: 'absent',   label: 'Absen' },
        { value: 'on_leave', label: 'Izin/Cuti' },
      ],
    },
    { key: 'search', type: 'text' as const, label: 'Cari karyawan', value: search, onChange: setSearch, placeholder: 'Nama...' },
  ]

  return (
    <div className="bg-sand-50 min-h-full p-4 md:p-6">
      <SectionHeader title="Rekap Absensi">
        <button
          onClick={() => setManualOpen(true)}
          className="border border-line-strong text-ink-700 rounded-md px-3 py-1.5 text-sm font-sans font-medium hover:bg-sand-100 transition-colors"
        >
          Input Manual
        </button>
      </SectionHeader>

      <FilterBar fields={filterFields} onReset={() => { setBranchId(''); setDateFrom(today); setDateTo(today); setStatus(''); setSearch('') }} />

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Hadir',     count: summary.present,  color: 'text-success'  },
          { label: 'Terlambat', count: summary.late,     color: 'text-warning'  },
          { label: 'Izin/Cuti', count: summary.on_leave, color: 'text-pine'     },
          { label: 'Absen',     count: summary.absent,   color: 'text-danger'   },
        ].map(s => (
          <div key={s.label} className="bg-white border border-line rounded-xl p-3 text-center shadow-sm">
            <p className={`text-xl font-sans font-semibold tabular-nums ${s.color}`}>{s.count}</p>
            <p className="text-xs text-ink-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-danger-bg border border-danger-bd text-danger rounded-lg p-3 text-sm mb-4">{error}</div>
      )}

      {loading ? (
        <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden motion-safe:animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 border-b border-line flex gap-4">
              <div className="h-4 w-32 bg-sand-100 rounded" />
              <div className="h-4 w-20 bg-sand-100 rounded" />
              <div className="h-4 w-24 bg-sand-100 rounded" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl shadow-sm">
          <EmptyState heading="Tidak ada data" subtext="Tidak ada data untuk filter ini." />
        </div>
      ) : (
        <TableWrapper>
          <thead>
            <tr>
              <Th>Nama</Th>
              <Th>Cabang</Th>
              <Th>Tanggal</Th>
              <Th>Masuk</Th>
              <Th>Keluar</Th>
              <Th right>Jam Kerja</Th>
              <Th>Status</Th>
              <Th>Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="border-b border-line hover:bg-sand-50 motion-safe:transition-colors">
                <Td>{row.staff_name}</Td>
                <Td className="text-ink-500">{row.branch_name}</Td>
                <Td className="tabular-nums text-ink-500">{new Date(row.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</Td>
                <Td className="tabular-nums">{formatTime(row.clock_in_at)}</Td>
                <Td className="tabular-nums">{formatTime(row.clock_out_at)}</Td>
                <Td right>{formatWorked(row.worked_minutes)}</Td>
                <Td><StatusBadge status={row.status} /></Td>
                <Td>
                  <button className="text-xs text-pine underline underline-offset-2 hover:no-underline">
                    Koreksi
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrapper>
      )}

      {/* Manual input sheet */}
      <BottomSheet open={manualOpen} onClose={() => setManualOpen(false)} title="Input Absensi Manual">
        <div className="grid gap-4">
          <label>
            <span className="text-xs text-ink-500 mb-1 block">ID Karyawan</span>
            <input type="text" value={manualStaff} onChange={e => setManualStaff(e.target.value)} className={inputCls} placeholder="ID staff..." />
          </label>
          <label>
            <span className="text-xs text-ink-500 mb-1 block">Tanggal</span>
            <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className={inputCls} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="text-xs text-ink-500 mb-1 block">Jam Masuk</span>
              <input type="time" value={manualIn} onChange={e => setManualIn(e.target.value)} className={inputCls} />
            </label>
            <label>
              <span className="text-xs text-ink-500 mb-1 block">Jam Keluar</span>
              <input type="time" value={manualOut} onChange={e => setManualOut(e.target.value)} className={inputCls} />
            </label>
          </div>
          <label>
            <span className="text-xs text-ink-500 mb-1 block">Catatan</span>
            <textarea value={manualNote} onChange={e => setManualNote(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="Opsional..." />
          </label>
          <button
            onClick={handleManualSave}
            disabled={manualLoading}
            className="w-full bg-pine text-white rounded-xl py-3 text-sm font-sans font-semibold hover:bg-pine-700 disabled:opacity-45 transition-colors flex items-center justify-center gap-2"
          >
            {manualLoading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Simpan
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
