'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { SectionHeader } from '@/components/hr/SectionHeader'
import { StatusBadge }   from '@/components/hr/StatusBadge'
import { BottomSheet }   from '@/components/hr/BottomSheet'
import { EmptyState }    from '@/components/hr/EmptyState'
import { TableWrapper, Th, Td } from '@/components/hr/TableWrapper'
import { useToast }      from '@/components/hr/Toast'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Payslip {
  id:          string
  staff_name:  string
  basic:       number
  allowances:  number
  overtime:    number
  deductions:  number
  tax_amount:  number
  net:         number
}

interface Props {
  runId:      string
  month:      number
  year:       number
  status:     string
  branchName: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
]

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

function exportToCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function PayrollDetailClient({ runId, month, year, status: initialStatus, branchName }: Props) {
  const { showToast } = useToast()

  const [payslips,       setPayslips]       = useState<Payslip[]>([])
  const [loading,        setLoading]        = useState(true)
  const [currentStatus,  setCurrentStatus]  = useState(initialStatus)
  const [generating,     setGenerating]     = useState(false)
  const [finalizing,     setFinalizing]     = useState(false)
  const [finalizeSheet,  setFinalizeSheet]  = useState(false)
  const [taxEdits,       setTaxEdits]       = useState<Record<string, string>>({})

  const periodLabel = `${MONTHS[month - 1]} ${year}`

  const fetchPayslips = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/v1/hr/payslips?payroll_run_id=${runId}`)
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal memuat data.', 'error'); return }
      setPayslips(json.data ?? [])
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setLoading(false)
    }
  }, [runId, showToast])

  useEffect(() => { fetchPayslips() }, [fetchPayslips])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res  = await fetch(`/api/v1/hr/payroll/${runId}/generate`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal generate payslip.', 'error'); return }
      showToast('Payslip berhasil di-generate.')
      fetchPayslips()
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
      const res  = await fetch(`/api/v1/hr/payroll/${runId}/finalize`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal finalisasi payroll.', 'error'); return }
      showToast('Payroll berhasil difinalisasi.')
      setCurrentStatus('finalized')
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setFinalizing(false)
    }
  }

  async function handleTaxBlur(payslipId: string) {
    const raw    = taxEdits[payslipId]
    if (raw === undefined) return
    const amount = parseInt(raw, 10)
    if (isNaN(amount)) return
    try {
      const res  = await fetch(`/api/v1/hr/payslips/${payslipId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tax_amount: amount }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal menyimpan pajak.', 'error'); return }
      setPayslips(prev =>
        prev.map(p => p.id === payslipId ? { ...p, tax_amount: amount, net: p.basic + p.allowances + p.overtime - p.deductions - amount } : p)
      )
    } catch {
      showToast('Koneksi gagal.', 'error')
    }
  }

  async function handleExport() {
    try {
      const res  = await fetch(`/api/v1/hr/payroll/${runId}/export`)
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal export.', 'error'); return }
      exportToCsv(json.data ?? payslips, `payroll-${periodLabel.replace(' ', '-')}.csv`)
    } catch {
      // Fallback: export from local state
      exportToCsv(
        payslips.map(p => ({
          Nama:       p.staff_name,
          Gaji_Pokok: p.basic,
          Tunjangan:  p.allowances,
          Lembur:     p.overtime,
          Potongan:   p.deductions,
          Pajak:      p.tax_amount,
          Net:        p.net,
        })),
        `payroll-${periodLabel.replace(' ', '-')}.csv`
      )
    }
  }

  const isDraft     = currentStatus === 'draft'
  const hasPayslips = payslips.length > 0

  return (
    <div className="bg-sand-50 min-h-full p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <Link href="/hr/payroll" className="text-xs text-ink-500 hover:text-ink-900 transition-colors">
            ← Penggajian
          </Link>
        </div>

        <SectionHeader title={`${periodLabel} — ${branchName}`}>
          <div className="flex items-center gap-2">
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
                Finalize
              </button>
            )}
            {hasPayslips && (
              <button
                onClick={handleExport}
                className="border border-line-strong text-ink-700 rounded-md px-3 py-1.5 text-sm font-sans font-medium hover:bg-sand-100 transition-colors"
              >
                Export CSV
              </button>
            )}
          </div>
        </SectionHeader>

        {loading ? (
          <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3 border-b border-line flex gap-4">
                <div className="h-4 w-32 bg-sand-100 rounded" />
                <div className="h-4 w-20 bg-sand-100 rounded" />
                <div className="h-4 w-20 bg-sand-100 rounded" />
              </div>
            ))}
          </div>
        ) : payslips.length === 0 ? (
          <div className="bg-white border border-line rounded-2xl shadow-sm">
            <EmptyState
              heading="Belum ada payslip"
              subtext={isDraft ? 'Klik tombol Generate untuk membuat payslip karyawan.' : 'Tidak ada data payslip.'}
            />
          </div>
        ) : (
          <TableWrapper>
            <thead>
              <tr>
                <Th>Nama</Th>
                <Th right>Gaji Pokok</Th>
                <Th right>Tunjangan</Th>
                <Th right>Lembur</Th>
                <Th right>Potongan</Th>
                <Th right>Pajak</Th>
                <Th right>Net</Th>
              </tr>
            </thead>
            <tbody>
              {payslips.map(p => (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-sand-50 transition-colors">
                  <Td className="font-medium">{p.staff_name}</Td>
                  <Td right>{formatRp(p.basic)}</Td>
                  <Td right>{formatRp(p.allowances)}</Td>
                  <Td right>{p.overtime > 0 ? formatRp(p.overtime) : '–'}</Td>
                  <Td right>{p.deductions > 0 ? formatRp(p.deductions) : '–'}</Td>
                  <Td right>
                    {isDraft ? (
                      <input
                        type="number"
                        value={taxEdits[p.id] ?? p.tax_amount}
                        onChange={e => setTaxEdits(prev => ({ ...prev, [p.id]: e.target.value }))}
                        onBlur={() => handleTaxBlur(p.id)}
                        className="w-24 border border-line rounded px-2 py-1 text-sm tabular-nums text-right font-sans focus:border-pine-400 outline-none"
                      />
                    ) : (
                      formatRp(p.tax_amount)
                    )}
                  </Td>
                  <Td right>
                    <span className="font-semibold text-pine tabular-nums">{formatRp(p.net)}</span>
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
        title="Finalisasi Payroll"
      >
        <p className="text-sm text-ink-500 mb-4">
          Setelah difinalisasi, data payroll tidak bisa diubah. Lanjutkan?
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
    </div>
  )
}
