'use client'

import { useState, useEffect, useCallback } from 'react'
import Link                from 'next/link'
import { useSearchParams }  from 'next/navigation'
import { SectionHeader }   from '@/components/hr/SectionHeader'
import { StatusBadge }     from '@/components/hr/StatusBadge'
import { BottomSheet }     from '@/components/hr/BottomSheet'
import { EmptyState }      from '@/components/hr/EmptyState'
import { useToast }        from '@/components/hr/Toast'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Branch { id: string; name: string }

interface VendorPayrollRun {
  id:           string
  branch_id:    string
  period_month: number
  period_year:  number
  status:       string
  total_amount: number
  branches?:    { name: string }
}

interface Props {
  staffRole: string
  branchId:  string | null
  branches:  Branch[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

const inputCls =
  'w-full border border-line-strong rounded-md px-3 py-2.5 text-sm font-sans text-ink-900 bg-white ' +
  'focus:border-pine-400 focus:ring-2 focus:ring-pine-100 outline-none placeholder:text-ink-400'

// ── Main ──────────────────────────────────────────────────────────────────────

export function VendorPayrollClient({ staffRole, branchId, branches }: Props) {
  const { showToast } = useToast()
  const searchParams  = useSearchParams()
  const isOwner = staffRole === 'owner'

  const initialBranch = isOwner
    ? (searchParams.get('branch_id') ?? '')
    : (branchId ?? '')

  const [runs,         setRuns]         = useState<VendorPayrollRun[]>([])
  const [loading,      setLoading]      = useState(true)
  const [filterBranch, setFilterBranch] = useState(initialBranch)
  const [filterStatus, setFilterStatus] = useState('')
  const [sheetOpen,    setSheetOpen]    = useState(false)
  const [saving,       setSaving]       = useState(false)

  // Form fields
  const now = new Date()
  const [fBranch, setFBranch] = useState(isOwner ? '' : (branchId ?? ''))
  const [fMonth,  setFMonth]  = useState(String(now.getMonth() + 1))
  const [fYear,   setFYear]   = useState(String(now.getFullYear()))

  const fetchRuns = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterBranch) params.set('branch_id', filterBranch)
      if (filterStatus) params.set('status',    filterStatus)
      const res  = await fetch(`/api/v1/hr/vendor-payroll?${params}`)
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal memuat data.', 'error'); return }
      setRuns(json.data ?? [])
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setLoading(false)
    }
  }, [filterBranch, filterStatus, showToast])

  useEffect(() => { fetchRuns() }, [fetchRuns])

  async function handleCreate() {
    if (!fBranch) { showToast('Pilih cabang terlebih dahulu.', 'error'); return }
    const month = parseInt(fMonth, 10)
    const year  = parseInt(fYear,  10)
    if (isNaN(month) || month < 1 || month > 12) { showToast('Bulan tidak valid.', 'error'); return }
    if (isNaN(year)  || year < 2020)             { showToast('Tahun tidak valid.', 'error'); return }

    setSaving(true)
    try {
      const res  = await fetch('/api/v1/hr/vendor-payroll', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ branch_id: fBranch, period_month: month, period_year: year }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal membuat periode.', 'error'); return }
      showToast('Periode penggajian vendor dibuat.')
      setSheetOpen(false)
      fetchRuns()
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-sand-50 min-h-full p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <SectionHeader title="Penggajian Vendor">
          <button
            onClick={() => setSheetOpen(true)}
            className="bg-pine text-white rounded-xl px-4 py-2 text-sm font-sans font-semibold hover:bg-pine-700 transition-colors"
          >
            + Buat Periode
          </button>
        </SectionHeader>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {isOwner && (
            <select
              value={filterBranch}
              onChange={e => setFilterBranch(e.target.value)}
              className="border border-line-strong rounded-xl px-3 py-2.5 text-sm font-sans text-ink-900 bg-white focus:border-pine-400 outline-none min-w-[180px]"
            >
              <option value="">Semua Cabang</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-line-strong rounded-xl px-3 py-2.5 text-sm font-sans text-ink-900 bg-white focus:border-pine-400 outline-none min-w-[150px]"
          >
            <option value="">Semua Status</option>
            <option value="draft">Draft</option>
            <option value="finalized">Finalisasi</option>
            <option value="paid">Dibayar</option>
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border border-line rounded-2xl p-4 shadow-sm animate-pulse">
                <div className="h-4 w-40 bg-sand-100 rounded mb-2" />
                <div className="h-3 w-24 bg-sand-100 rounded" />
              </div>
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="bg-white border border-line rounded-2xl shadow-sm">
            <EmptyState
              heading="Belum ada periode penggajian vendor"
              subtext="Buat periode baru untuk mulai memproses penggajian vendor."
            />
          </div>
        ) : (
          <div className="grid gap-3">
            {runs.map(run => (
              <div key={run.id} className="bg-white border border-line rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      {MONTHS[run.period_month - 1]} {run.period_year}
                    </p>
                    {run.branches?.name && (
                      <p className="text-xs text-ink-500 mt-0.5">{run.branches.name}</p>
                    )}
                    {run.total_amount > 0 && (
                      <p className="text-sm font-semibold tabular-nums text-pine mt-1">
                        {formatRp(run.total_amount)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={run.status} />
                    <Link
                      href={`/hr/vendor-payroll/${run.id}`}
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

      {/* Create period sheet */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Buat Periode Penggajian Vendor"
      >
        <div className="space-y-3">
          {isOwner && (
            <div>
              <label className="text-xs text-ink-500 mb-1 block">Cabang *</label>
              <select
                value={fBranch}
                onChange={e => setFBranch(e.target.value)}
                className={inputCls}
              >
                <option value="">Pilih cabang...</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-ink-500 mb-1 block">Bulan *</label>
              <select
                value={fMonth}
                onChange={e => setFMonth(e.target.value)}
                className={inputCls}
              >
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={String(i + 1)}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-ink-500 mb-1 block">Tahun *</label>
              <input
                type="number"
                value={fYear}
                onChange={e => setFYear(e.target.value)}
                min={2020}
                max={2099}
                className={inputCls + ' tabular-nums'}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setSheetOpen(false)}
              className="flex-1 border border-line-strong text-ink-700 rounded-xl py-3 text-sm font-sans font-medium hover:bg-sand-50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex-1 bg-pine text-white rounded-xl py-3 text-sm font-sans font-semibold hover:bg-pine-700 disabled:opacity-45 transition-colors flex items-center justify-center gap-2"
            >
              {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Buat Periode
            </button>
          </div>
        </div>
      </BottomSheet>

      {staffRole && null}
    </div>
  )
}
