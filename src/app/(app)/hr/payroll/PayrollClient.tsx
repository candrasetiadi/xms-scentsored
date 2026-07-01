'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { SectionHeader } from '@/components/hr/SectionHeader'
import { StatusBadge }   from '@/components/hr/StatusBadge'
import { BottomSheet }   from '@/components/hr/BottomSheet'
import { EmptyState }    from '@/components/hr/EmptyState'
import { FilterBar }     from '@/components/hr/FilterBar'
import { useToast }      from '@/components/hr/Toast'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Branch { id: string; name: string }

interface PayrollRun {
  id:            string
  month:         number
  year:          number
  branch_id:     string
  branch_name:   string
  status:        string
  staff_count:   number
  total_net:     number
  created_at:    string
}

interface Props {
  staffRole: string
  branchId:  string | null
  branches:  Branch[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  'w-full border border-line-strong rounded-md px-3 py-2.5 text-sm font-sans text-ink-900 bg-white ' +
  'focus:border-pine-400 focus:ring-2 focus:ring-pine-100 outline-none placeholder:text-ink-400'

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

const MONTHS = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
]

// ── Main ──────────────────────────────────────────────────────────────────────

export function PayrollClient({ staffRole, branchId, branches }: Props) {
  const { showToast } = useToast()
  const now = new Date()

  const [runs,         setRuns]         = useState<PayrollRun[]>([])
  const [loading,      setLoading]      = useState(true)
  const [filterBranch, setFilterBranch] = useState(branchId ?? '')
  const [filterYear,   setFilterYear]   = useState(String(now.getFullYear()))

  // New payroll sheet
  const [sheetOpen,    setSheetOpen]    = useState(false)
  const [newBranch,    setNewBranch]    = useState(branchId ?? '')
  const [newMonth,     setNewMonth]     = useState(String(now.getMonth() + 1))
  const [newYear,      setNewYear]      = useState(String(now.getFullYear()))
  const [creating,     setCreating]     = useState(false)

  const fetchRuns = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ year: filterYear })
      if (filterBranch) params.set('branch_id', filterBranch)
      const res  = await fetch(`/api/v1/hr/payroll?${params}`)
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal memuat data.', 'error'); return }
      setRuns(json.data ?? [])
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setLoading(false)
    }
  }, [filterBranch, filterYear, showToast])

  useEffect(() => { fetchRuns() }, [fetchRuns])

  async function handleCreate() {
    if (!newBranch) { showToast('Pilih cabang terlebih dahulu.', 'error'); return }
    setCreating(true)
    try {
      const res  = await fetch('/api/v1/hr/payroll', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ branch_id: newBranch, month: parseInt(newMonth), year: parseInt(newYear) }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal membuat payroll.', 'error'); return }
      showToast('Payroll baru berhasil dibuat.')
      setSheetOpen(false)
      fetchRuns()
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setCreating(false)
    }
  }

  const yearOpts = Array.from({ length: 3 }, (_, i) => {
    const y = String(now.getFullYear() - i)
    return { value: y, label: y }
  })

  const filterFields = [
    {
      key: 'year', type: 'select' as const, label: 'Tahun', value: filterYear, onChange: setFilterYear,
      options: yearOpts,
    },
    {
      key: 'branch', type: 'select' as const, label: 'Cabang', value: filterBranch, onChange: setFilterBranch,
      options: [{ value: '', label: 'Semua Cabang' }, ...branches.map(b => ({ value: b.id, label: b.name }))],
    },
  ]

  return (
    <div className="bg-sand-50 min-h-full p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <SectionHeader title="Penggajian">
          <button
            onClick={() => setSheetOpen(true)}
            className="bg-pine text-white rounded-lg px-4 py-2 text-sm font-sans font-semibold hover:bg-pine-700 transition-colors"
          >
            + Buat Payroll
          </button>
        </SectionHeader>

        <FilterBar
          fields={filterFields}
          onReset={() => { setFilterBranch(branchId ?? ''); setFilterYear(String(now.getFullYear())) }}
        />

        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white border border-line rounded-2xl p-4 shadow-sm animate-pulse">
                <div className="h-4 w-36 bg-sand-100 rounded mb-2" />
                <div className="h-3 w-52 bg-sand-100 rounded" />
              </div>
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="bg-white border border-line rounded-2xl shadow-sm">
            <EmptyState heading="Belum ada data payroll" subtext="Buat payroll baru untuk mulai memproses penggajian." />
          </div>
        ) : (
          <div className="grid gap-3">
            {runs.map(run => (
              <div key={run.id} className="bg-white border border-line rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      {MONTHS[run.month - 1]} {run.year}
                    </p>
                    <p className="text-xs text-ink-500 mt-0.5">
                      {run.branch_name} · {run.staff_count} karyawan
                    </p>
                    <p className="text-sm font-semibold tabular-nums text-pine mt-1">
                      {formatRp(run.total_net)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={run.status} />
                    <Link
                      href={`/hr/payroll/${run.id}`}
                      className="text-xs text-pine underline underline-offset-2 hover:no-underline"
                    >
                      Lihat Detail
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New payroll sheet */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Buat Payroll Baru">
        <div className="grid gap-3">
          <label>
            <span className="text-xs text-ink-500 mb-1 block">Cabang</span>
            <select value={newBranch} onChange={e => setNewBranch(e.target.value)} className={inputCls}>
              <option value="">Pilih cabang...</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="text-xs text-ink-500 mb-1 block">Bulan</span>
              <select value={newMonth} onChange={e => setNewMonth(e.target.value)} className={inputCls}>
                {MONTHS.map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
              </select>
            </label>
            <label>
              <span className="text-xs text-ink-500 mb-1 block">Tahun</span>
              <select value={newYear} onChange={e => setNewYear(e.target.value)} className={inputCls}>
                {yearOpts.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
              </select>
            </label>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full bg-pine text-white rounded-xl py-3 text-sm font-sans font-semibold hover:bg-pine-700 disabled:opacity-45 transition-colors flex items-center justify-center gap-2"
          >
            {creating && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Buat Payroll
          </button>
        </div>
      </BottomSheet>

      {staffRole && null}
    </div>
  )
}
