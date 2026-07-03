'use client'

import { useState, useEffect, useCallback } from 'react'
import Link                from 'next/link'
import { SectionHeader }   from '@/components/hr/SectionHeader'
import { StatusBadge }     from '@/components/hr/StatusBadge'
import { BottomSheet }     from '@/components/hr/BottomSheet'
import { EmptyState }      from '@/components/hr/EmptyState'
import { TableWrapper, Th, Td } from '@/components/hr/TableWrapper'
import { useToast }        from '@/components/hr/Toast'

// ── Types ──────────────────────────────────────────────────────────────────────

interface VendorPayslip {
  id:           string
  vendor_id:    string
  tx_count:     number
  fee_per_tx:   number
  total_amount: number
  status:       string
  vendors:      { name: string; phone: string | null }
}

interface Props {
  runId:       string
  month:       number
  year:        number
  status:      string
  totalAmount: number
  branchName:  string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
]

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

// ── Main ──────────────────────────────────────────────────────────────────────

export function VendorPayrollDetailClient({
  runId, month, year, status: initialStatus, totalAmount: initialTotal, branchName,
}: Props) {
  const { showToast } = useToast()

  const [payslips,       setPayslips]       = useState<VendorPayslip[]>([])
  const [loading,        setLoading]        = useState(true)
  const [currentStatus,  setCurrentStatus]  = useState(initialStatus)
  const [currentTotal,   setCurrentTotal]   = useState(initialTotal)
  const [generating,     setGenerating]     = useState(false)
  const [finalizeSheet,  setFinalizeSheet]  = useState(false)
  const [finalizing,     setFinalizing]     = useState(false)
  const [markingPaid,    setMarkingPaid]    = useState(false)
  const [paidSheet,      setPaidSheet]      = useState(false)

  const periodLabel = `${MONTHS[month - 1]} ${year}`

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/v1/hr/vendor-payroll/${runId}`)
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal memuat data.', 'error'); return }
      const data = json.data ?? json
      setPayslips(data.vendor_payslips ?? [])
      if (data.total_amount != null) setCurrentTotal(Number(data.total_amount))
      if (data.status)               setCurrentStatus(data.status)
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setLoading(false)
    }
  }, [runId, showToast])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res  = await fetch(`/api/v1/hr/vendor-payroll/${runId}/generate`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal generate payslip vendor.', 'error'); return }
      showToast('Payslip vendor berhasil di-generate.')
      fetchDetail()
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setGenerating(false)
    }
  }

  async function handleFinalize() {
    setFinalizeSheet(false)
    setFinalizing(true)
    try {
      const res  = await fetch(`/api/v1/hr/vendor-payroll/${runId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: 'finalized' }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal finalisasi.', 'error'); return }
      showToast('Penggajian vendor difinalisasi.')
      setCurrentStatus('finalized')
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setFinalizing(false)
    }
  }

  async function handleMarkPaid() {
    setPaidSheet(false)
    setMarkingPaid(true)
    try {
      const res  = await fetch(`/api/v1/hr/vendor-payroll/${runId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: 'paid' }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal menandai lunas.', 'error'); return }
      showToast('Penggajian vendor ditandai lunas.')
      setCurrentStatus('paid')
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setMarkingPaid(false)
    }
  }

  const isDraft     = currentStatus === 'draft'
  const isFinalized = currentStatus === 'finalized'
  const hasPayslips = payslips.length > 0

  return (
    <div className="bg-sand-50 min-h-full p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-1">
          <Link href="/hr/vendor-payroll" className="text-xs text-ink-500 hover:text-ink-900 transition-colors">
            ← Penggajian Vendor
          </Link>
        </div>

        <SectionHeader title={`Penggajian Vendor – ${periodLabel}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={currentStatus} />
            {isDraft && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="border border-line-strong text-ink-700 rounded-md px-3 py-1.5 text-sm font-sans font-medium hover:bg-sand-100 disabled:opacity-45 transition-colors flex items-center gap-1.5"
              >
                {generating && <span className="w-3 h-3 border-2 border-ink-400 border-t-transparent rounded-full animate-spin" />}
                Generate
              </button>
            )}
            {isDraft && hasPayslips && (
              <button
                onClick={() => setFinalizeSheet(true)}
                disabled={finalizing}
                className="bg-pine text-white rounded-md px-3 py-1.5 text-sm font-sans font-semibold hover:bg-pine-700 disabled:opacity-45 transition-colors"
              >
                Finalisasi
              </button>
            )}
            {isFinalized && (
              <button
                onClick={() => setPaidSheet(true)}
                disabled={markingPaid}
                className="bg-pine text-white rounded-md px-3 py-1.5 text-sm font-sans font-semibold hover:bg-pine-700 disabled:opacity-45 transition-colors"
              >
                Tandai Lunas
              </button>
            )}
          </div>
        </SectionHeader>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white border border-line rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-ink-500 mb-1">Cabang</p>
            <p className="text-sm font-semibold text-ink-900">{branchName || '—'}</p>
          </div>
          <div className="bg-white border border-line rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-ink-500 mb-1">Total Fee</p>
            <p className="text-sm font-semibold tabular-nums text-pine">{formatRp(currentTotal)}</p>
          </div>
          <div className="bg-white border border-line rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-ink-500 mb-1">Jumlah Vendor</p>
            <p className="text-sm font-semibold text-ink-900">{payslips.length}</p>
          </div>
        </div>

        {/* Payslips table */}
        {loading ? (
          <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-4 py-3 border-b border-line flex gap-4">
                <div className="h-4 w-36 bg-sand-100 rounded" />
                <div className="h-4 w-16 bg-sand-100 rounded" />
                <div className="h-4 w-24 bg-sand-100 rounded" />
              </div>
            ))}
          </div>
        ) : payslips.length === 0 ? (
          <div className="bg-white border border-line rounded-2xl shadow-sm">
            <EmptyState
              heading="Belum ada data vendor"
              subtext={isDraft ? 'Klik tombol Generate untuk membuat payslip vendor.' : 'Tidak ada data vendor.'}
            />
          </div>
        ) : (
          <TableWrapper>
            <thead>
              <tr>
                <Th>Nama Vendor</Th>
                <Th right>Jml. Transaksi</Th>
                <Th right>Tarif/Transaksi</Th>
                <Th right>Total Fee</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {payslips.map(p => (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-sand-50 transition-colors">
                  <Td className="font-medium">{p.vendors?.name ?? '—'}</Td>
                  <Td right>{Number(p.tx_count).toLocaleString('id-ID')}</Td>
                  <Td right>{formatRp(Number(p.fee_per_tx))}</Td>
                  <Td right>
                    <span className="font-semibold tabular-nums text-pine">{formatRp(Number(p.total_amount))}</span>
                  </Td>
                  <Td>
                    <StatusBadge status={p.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        )}
      </div>

      {/* Finalize confirm */}
      <BottomSheet
        open={finalizeSheet}
        onClose={() => setFinalizeSheet(false)}
        title="Finalisasi Penggajian Vendor"
      >
        <p className="text-sm text-ink-500 mb-4">
          Setelah difinalisasi, data tidak dapat diubah. Lanjutkan?
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setFinalizeSheet(false)}
            className="flex-1 border border-line-strong text-ink-700 rounded-xl py-3 text-sm font-sans font-medium hover:bg-sand-50 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleFinalize}
            className="flex-1 bg-pine text-white rounded-xl py-3 text-sm font-sans font-semibold hover:bg-pine-700 transition-colors"
          >
            Ya, Finalisasi
          </button>
        </div>
      </BottomSheet>

      {/* Mark paid confirm */}
      <BottomSheet
        open={paidSheet}
        onClose={() => setPaidSheet(false)}
        title="Tandai Lunas"
      >
        <p className="text-sm text-ink-500 mb-4">
          Tandai penggajian vendor periode {periodLabel} sebagai sudah dibayar?
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPaidSheet(false)}
            className="flex-1 border border-line-strong text-ink-700 rounded-xl py-3 text-sm font-sans font-medium hover:bg-sand-50 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleMarkPaid}
            className="flex-1 bg-pine text-white rounded-xl py-3 text-sm font-sans font-semibold hover:bg-pine-700 transition-colors"
          >
            Ya, Lunas
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
