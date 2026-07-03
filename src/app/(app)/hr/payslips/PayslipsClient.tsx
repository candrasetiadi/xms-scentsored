'use client'

import { useState, useEffect, useCallback } from 'react'
import { SectionHeader } from '@/components/hr/SectionHeader'
import { StatusBadge }   from '@/components/hr/StatusBadge'
import { BottomSheet }   from '@/components/hr/BottomSheet'
import { EmptyState }    from '@/components/hr/EmptyState'
import { useToast }      from '@/components/hr/Toast'

// ── Types ──────────────────────────────────────────────────────────────────────

interface PayslipSummary {
  id:          string
  month:       number
  year:        number
  branch_name: string
  status:      string
  net:         number
}

interface ComponentSnapshot {
  name:   string
  type:   'basic' | 'allowance' | 'deduction'
  amount: number
}

interface PayslipDetail extends PayslipSummary {
  staff_name:          string
  basic:               number
  allowances:          number
  overtime:            number
  sales_fee_amount:    number
  deductions:          number
  tax_amount:          number
  components_snapshot: ComponentSnapshot[]
}

interface Props {
  staffId:   string
  staffRole: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
]

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

// ── Slip detail view ──────────────────────────────────────────────────────────

function SlipDetail({ slip }: { slip: PayslipDetail }) {
  const basics     = slip.components_snapshot.filter(c => c.type === 'basic')
  const allowances = slip.components_snapshot.filter(c => c.type === 'allowance')
  const deductions = slip.components_snapshot.filter(c => c.type === 'deduction')

  return (
    <div className="font-sans">
      {/* Header */}
      <div className="text-center mb-4 pb-4 border-b border-line">
        <p className="font-display text-pine text-xl font-semibold">Scentsored</p>
        <p className="text-sm font-medium text-ink-900 mt-1">{slip.staff_name}</p>
        <p className="text-xs text-ink-500">
          Periode: {MONTHS[slip.month - 1]} {slip.year} · {slip.branch_name}
        </p>
      </div>

      {/* Gaji Pokok & Tunjangan */}
      {basics.map((c, i) => (
        <div key={i} className="flex justify-between text-sm py-1.5">
          <span className="text-ink-700">{c.name}</span>
          <span className="tabular-nums text-ink-900">{formatRp(c.amount)}</span>
        </div>
      ))}

      {allowances.length > 0 && (
        <>
          <p className="text-xs text-ink-400 uppercase tracking-wide mt-3 mb-1">Tunjangan</p>
          {allowances.map((c, i) => (
            <div key={i} className="flex justify-between text-sm py-1.5">
              <span className="text-ink-700">{c.name}</span>
              <span className="tabular-nums text-ink-900">{formatRp(c.amount)}</span>
            </div>
          ))}
        </>
      )}

      {slip.overtime > 0 && (
        <div className="flex justify-between text-sm py-1.5">
          <span className="text-ink-700">Lembur</span>
          <span className="tabular-nums text-ink-900">{formatRp(slip.overtime)}</span>
        </div>
      )}

      {slip.sales_fee_amount > 0 && (
        <div className="flex justify-between text-sm py-1.5">
          <span className="text-ink-700">Komisi Penjualan</span>
          <span className="tabular-nums text-ink-900">{formatRp(slip.sales_fee_amount)}</span>
        </div>
      )}

      {/* Separator */}
      <div className="border-t border-dashed border-line my-3" />

      {/* Potongan */}
      {(deductions.length > 0 || slip.tax_amount > 0) && (
        <>
          <p className="text-xs text-ink-400 uppercase tracking-wide mb-1">Potongan</p>
          {deductions.map((c, i) => (
            <div key={i} className="flex justify-between text-sm py-1.5">
              <span className="text-ink-700">{c.name}</span>
              <span className="tabular-nums text-danger">({formatRp(c.amount)})</span>
            </div>
          ))}
          {slip.tax_amount > 0 && (
            <div className="flex justify-between text-sm py-1.5">
              <span className="text-ink-700">Pajak (PPh21)</span>
              <span className="tabular-nums text-danger">({formatRp(slip.tax_amount)})</span>
            </div>
          )}
        </>
      )}

      {/* Net */}
      <div className="border-t-2 border-ink-900 mt-3 pt-3 flex justify-between items-center">
        <span className="text-sm font-semibold text-ink-900">Net Gaji</span>
        <span className="text-xl font-semibold tabular-nums text-pine">{formatRp(slip.net)}</span>
      </div>

      {/* Print button */}
      <button
        onClick={() => window.open(`/print/payslips/${slip.id}`, '_blank')}
        className="mt-5 w-full border border-line-strong text-ink-700 rounded-xl py-2.5 text-sm font-sans font-medium hover:bg-sand-50 transition-colors"
      >
        Cetak / Download PDF
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function PayslipsClient({ staffId, staffRole }: Props) {
  const { showToast } = useToast()

  const [list,        setList]        = useState<PayslipSummary[]>([])
  const [loading,     setLoading]     = useState(true)
  const [detail,      setDetail]      = useState<PayslipDetail | null>(null)
  const [detailOpen,  setDetailOpen]  = useState(false)
  const [detailLoad,  setDetailLoad]  = useState(false)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/v1/hr/payslips')
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal memuat slip gaji.', 'error'); return }
      setList(json.data ?? [])
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { fetchList() }, [fetchList])

  async function handleView(id: string) {
    setDetailOpen(true)
    setDetailLoad(true)
    try {
      const res  = await fetch(`/api/v1/hr/payslips/${id}/pdf`)
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal memuat detail.', 'error'); setDetailOpen(false); return }
      setDetail(json.data)
    } catch {
      showToast('Koneksi gagal.', 'error')
      setDetailOpen(false)
    } finally {
      setDetailLoad(false)
    }
  }

  return (
    <div className="bg-sand-50 min-h-full p-4 md:p-6">
      <div className="max-w-xl mx-auto">
        <SectionHeader title="Slip Gaji" />

        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border border-line rounded-2xl p-4 shadow-sm animate-pulse">
                <div className="h-4 w-32 bg-sand-100 rounded mb-2" />
                <div className="h-3 w-48 bg-sand-100 rounded" />
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="bg-white border border-line rounded-2xl shadow-sm">
            <EmptyState heading="Belum ada slip gaji" subtext="Slip gaji Anda akan muncul di sini setelah payroll diproses." />
          </div>
        ) : (
          <div className="grid gap-3">
            {list.map(slip => (
              <div key={slip.id} className="bg-white border border-line rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      {MONTHS[slip.month - 1]} {slip.year}
                    </p>
                    <p className="text-xs text-ink-500 mt-0.5">{slip.branch_name}</p>
                    <p className="text-sm font-semibold tabular-nums text-pine mt-1">
                      {formatRp(slip.net)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={slip.status} />
                    <button
                      onClick={() => handleView(slip.id)}
                      className="text-xs text-pine underline underline-offset-2 hover:no-underline"
                    >
                      Lihat
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail sheet */}
      <BottomSheet
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetail(null) }}
        title="Slip Gaji"
      >
        {detailLoad ? (
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-32 bg-sand-100 rounded mx-auto" />
            <div className="h-3 w-48 bg-sand-100 rounded mx-auto" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 w-32 bg-sand-100 rounded" />
                <div className="h-4 w-24 bg-sand-100 rounded" />
              </div>
            ))}
          </div>
        ) : detail ? (
          <SlipDetail slip={detail} />
        ) : null}
      </BottomSheet>

      {staffId && null}
      {staffRole && null}
    </div>
  )
}
