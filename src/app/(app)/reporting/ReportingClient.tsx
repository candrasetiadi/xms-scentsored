'use client'

import React, { useCallback, useEffect, useState } from 'react'
import type {
  SalesReport, StockValuationRow, ProductionReport, DriverFeeReportRow,
} from '@/types/database'

type Tab = 'sales' | 'stock' | 'production' | 'driver-fees'

const TABS: { id: Tab; label: string }[] = [
  { id: 'sales',       label: 'Penjualan' },
  { id: 'stock',       label: 'Valuasi Stok' },
  { id: 'production',  label: 'Produksi' },
  { id: 'driver-fees', label: 'Fee Driver' },
]

const _rp  = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
const fmt  = (n: number) => 'Rp ' + _rp.format(Math.round(n))
const fmtNum = (n: number) => new Intl.NumberFormat('id-ID').format(n)
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

function today() { return new Date().toISOString().slice(0, 10) }
function monthStart() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }

function exportCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${filename}_${today()}.csv`
  a.click()
}

function TableCard({
  title, onExport, headers, footer, children,
}: {
  title: string
  onExport?: () => void
  headers: string[]
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <p className="font-medium text-sm text-ink-900">{title}</p>
        {onExport && (
          <button onClick={onExport}
            className="text-xs px-3 py-1.5 rounded-md border border-line text-ink-500 hover:text-ink-900 hover:border-line-strong transition-colors">
            Export CSV
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-sand-50">
            <tr>
              {headers.map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-ink-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
    </div>
  )
}

interface Props {
  staffRole: string
  defaultBranchId: string | null
  branches: { id: string; name: string }[]
}

export function ReportingClient({ defaultBranchId, branches }: Props) {
  const [tab, setTab] = useState<Tab>('sales')
  const [branchId, setBranchId] = useState(defaultBranchId ?? '')
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Report data
  const [sales, setSales] = useState<SalesReport | null>(null)
  const [stock, setStock] = useState<StockValuationRow[]>([])
  const [stockTotal, setStockTotal] = useState(0)
  const [production, setProduction] = useState<ProductionReport | null>(null)
  const [driverFees, setDriverFees] = useState<DriverFeeReportRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      if (tab === 'sales') {
        const res = await fetch(`/api/v1/reports/sales?branch_id=${branchId}&from=${from}&to=${to}`)
        const json = await res.json()
        if (!res.ok) { setError(json.error?.message ?? 'Gagal memuat.'); return }
        setSales(json.data)

      } else if (tab === 'stock') {
        const res = await fetch(`/api/v1/reports/stock?branch_id=${branchId}`)
        const json = await res.json()
        if (!res.ok) { setError(json.error?.message ?? 'Gagal memuat.'); return }
        setStock(json.data ?? [])
        setStockTotal(json.meta?.total_value ?? 0)

      } else if (tab === 'production') {
        const res = await fetch(`/api/v1/reports/production?branch_id=${branchId}&from=${from}&to=${to}`)
        const json = await res.json()
        if (!res.ok) { setError(json.error?.message ?? 'Gagal memuat.'); return }
        setProduction(json.data)

      } else if (tab === 'driver-fees') {
        const res = await fetch(`/api/v1/reports/driver-fees?from=${from}&to=${to}`)
        const json = await res.json()
        if (!res.ok) { setError(json.error?.message ?? 'Gagal memuat.'); return }
        setDriverFees(json.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [tab, branchId, from, to])

  useEffect(() => { if (branchId) load() }, [load, branchId])

  const STATUS_LABEL: Record<string, string> = {
    antri: 'Antri', diracik: 'Diracik', packing: 'Packing',
    selesai: 'Selesai', diambil: 'Diambil',
  }
  const needsBranch = tab !== 'driver-fees'

  const ctrl = "h-9 rounded-md border border-line-strong bg-white px-3 text-sm text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100"

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-[28px] text-pine">Laporan</h1>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {needsBranch && branches.length > 1 && (
            <select value={branchId} onChange={e => setBranchId(e.target.value)} className={ctrl}>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {tab !== 'stock' && (
            <>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={ctrl} />
              <span className="text-ink-400 text-sm select-none">—</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className={ctrl} />
            </>
          )}
          <button onClick={load} disabled={loading}
            className="h-9 px-4 rounded-md bg-pine text-white text-sm font-medium hover:bg-pine-700 disabled:opacity-50 transition-colors">
            {loading ? 'Memuat…' : 'Tampilkan'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-sand-100 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={[
              'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.id
                ? 'bg-white text-ink-900 shadow-sm'
                : 'text-ink-500 hover:text-ink-700',
            ].join(' ')}>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg px-4 py-3 text-sm bg-danger-bg text-danger border border-danger-bd">{error}</p>
      )}

        {/* ── Sales ──────────────────────────────────────────────────────────── */}
        {tab === 'sales' && sales && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Revenue',       value: fmt(sales.totals.total_revenue) },
                { label: 'Total Order',   value: fmtNum(sales.totals.total_orders) },
                { label: 'Rata-rata/Order', value: fmt(sales.totals.avg_order_value) },
                { label: 'Total Diskon',  value: fmt(sales.totals.total_discount) },
              ].map(card => (
                <div key={card.label} className="bg-white border border-line rounded-lg p-4 shadow-sm">
                  <p className="text-xs text-ink-500 mb-1">{card.label}</p>
                  <p className="font-bold text-base text-ink-900">{card.value}</p>
                </div>
              ))}
            </div>

            {sales.daily.length > 0 && <TableCard
              title="Penjualan Harian"
              onExport={() => exportCsv(sales.daily as unknown as Record<string, unknown>[], 'penjualan_harian')}
              headers={['Tanggal', 'Order', 'Revenue', 'Diskon', 'Avg/Order']}
            >
              {sales.daily.map(row => (
                <tr key={row.day} className="border-b border-line last:border-0 hover:bg-sand-50">
                  <td className="px-4 py-2.5 text-ink-700">{fmtDate(row.day)}</td>
                  <td className="px-4 py-2.5 text-ink-900 tabular-nums">{row.order_count}</td>
                  <td className="px-4 py-2.5 font-medium text-ink-900 tabular-nums">{fmt(row.revenue)}</td>
                  <td className="px-4 py-2.5 text-ink-500 tabular-nums">{fmt(row.total_discount)}</td>
                  <td className="px-4 py-2.5 text-ink-500 tabular-nums">{fmt(row.avg_order_value)}</td>
                </tr>
              ))}
            </TableCard>}

            {sales.top_products.length > 0 && <TableCard
              title="Top 10 Produk"
              onExport={() => exportCsv(sales.top_products as unknown as Record<string, unknown>[], 'top_produk')}
              headers={['#', 'Produk', 'Kategori', 'Unit Terjual', 'Revenue']}
            >
              {sales.top_products.map((row, i) => (
                <tr key={row.product_name} className="border-b border-line last:border-0 hover:bg-sand-50">
                  <td className="px-4 py-2.5 text-xs text-ink-400 tabular-nums">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-ink-900">{row.product_name}</td>
                  <td className="px-4 py-2.5 text-xs text-ink-500">{row.category ?? '—'}</td>
                  <td className="px-4 py-2.5 text-ink-900 tabular-nums">{fmtNum(row.units_sold)}</td>
                  <td className="px-4 py-2.5 font-medium text-ink-900 tabular-nums">{fmt(row.revenue)}</td>
                </tr>
              ))}
            </TableCard>}

            {sales.daily.length === 0 && (
              <p className="text-center py-10 text-sm text-ink-400">Tidak ada data penjualan dalam periode ini.</p>
            )}
          </div>
        )}

        {/* ── Stock Valuation ───────────────────────────────────────────────── */}
        {tab === 'stock' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-line rounded-lg p-4 shadow-sm">
                <p className="text-xs text-ink-500 mb-1">Total Valuasi Stok</p>
                <p className="font-bold text-lg text-ink-900">{fmt(stockTotal)}</p>
              </div>
              <div className="bg-white border border-line rounded-lg p-4 shadow-sm">
                <p className="text-xs text-ink-500 mb-1">Jumlah Material</p>
                <p className="font-bold text-lg text-ink-900">{fmtNum(stock.length)}</p>
              </div>
            </div>

            {stock.length > 0
              ? <TableCard
                  title="Valuasi per Bahan Baku (FIFO)"
                  onExport={() => exportCsv(stock as unknown as Record<string, unknown>[], 'valuasi_stok')}
                  headers={['Bahan Baku', 'Stok', 'Satuan', 'Nilai FIFO']}
                >
                  {stock.map(row => (
                    <tr key={row.raw_material_id} className="border-b border-line last:border-0 hover:bg-sand-50">
                      <td className="px-4 py-2.5 font-medium text-ink-900">{row.name}</td>
                      <td className="px-4 py-2.5 text-ink-900 tabular-nums">{fmtNum(row.total_qty)}</td>
                      <td className="px-4 py-2.5 text-xs text-ink-500">{row.unit}</td>
                      <td className="px-4 py-2.5 font-medium text-ink-900 tabular-nums">{fmt(row.total_value)}</td>
                    </tr>
                  ))}
                </TableCard>
              : <p className="text-center py-10 text-sm text-ink-400">Tidak ada stok tercatat.</p>
            }
          </div>
        )}

        {/* ── Production ────────────────────────────────────────────────────── */}
        {tab === 'production' && production && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-line rounded-lg p-4 shadow-sm">
                <p className="text-xs text-ink-500 mb-1">Avg Lead Time</p>
                <p className="font-bold text-lg text-ink-900">{production.avg_lead_time_minutes} menit</p>
              </div>
              <div className="bg-white border border-line rounded-lg p-4 shadow-sm">
                <p className="text-xs text-ink-500 mb-1">Total Order Produksi</p>
                <p className="font-bold text-lg text-ink-900">
                  {fmtNum(production.by_status.reduce((s, r) => s + r.cnt, 0))}
                </p>
              </div>
            </div>

            <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
              <p className="px-4 py-3 font-medium text-sm text-ink-900 border-b border-line">Distribusi Status</p>
              <div className="p-4 space-y-3">
                {production.by_status.length === 0
                  ? <p className="text-sm text-center py-2 text-ink-400">Tidak ada data.</p>
                  : production.by_status.map(row => {
                      const total = production.by_status.reduce((s, r) => s + r.cnt, 0)
                      const pct   = total > 0 ? Math.round((row.cnt / total) * 100) : 0
                      return (
                        <div key={row.status} className="flex items-center gap-3">
                          <span className="w-20 text-sm font-medium text-ink-700">
                            {STATUS_LABEL[row.status] ?? row.status}
                          </span>
                          <div className="flex-1 h-1.5 bg-sand-200 rounded-full overflow-hidden">
                            <div className="h-full bg-pine rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-sm text-ink-500 w-10 text-right tabular-nums">{row.cnt}</span>
                        </div>
                      )
                    })
                }
              </div>
            </div>
          </div>
        )}

        {/* ── Driver Fees ───────────────────────────────────────────────────── */}
        {tab === 'driver-fees' && (
          driverFees.length === 0
            ? <p className="text-center py-10 text-sm text-ink-400">Tidak ada fee driver dalam periode ini.</p>
            : <TableCard
                title="Rekapitulasi Fee Driver"
                onExport={() => exportCsv(driverFees as unknown as Record<string, unknown>[], 'fee_driver')}
                headers={['Driver', 'Tipe', 'Fee %', 'Order', 'Total Fee', 'Pending', 'Dibayar']}
                footer={
                  <tr className="border-t-2 border-line bg-sand-50">
                    <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-ink-500 uppercase tracking-wider">Total</td>
                    <td className="px-4 py-2.5 font-bold text-ink-900 tabular-nums">{fmt(driverFees.reduce((s, r) => s + r.total_fee, 0))}</td>
                    <td className="px-4 py-2.5 font-bold text-warning tabular-nums">{fmt(driverFees.reduce((s, r) => s + r.total_accrued, 0))}</td>
                    <td className="px-4 py-2.5 font-bold text-success tabular-nums">{fmt(driverFees.reduce((s, r) => s + r.total_paid, 0))}</td>
                  </tr>
                }
              >
                {driverFees.map(row => (
                  <tr key={row.driver_id} className="border-b border-line last:border-0 hover:bg-sand-50">
                    <td className="px-4 py-2.5 font-medium text-ink-900">{row.driver_name}</td>
                    <td className="px-4 py-2.5 text-xs text-ink-500">{row.driver_type === 'travel_driver' ? 'Driver' : 'Tour Guide'}</td>
                    <td className="px-4 py-2.5 text-ink-700 tabular-nums">{row.fee_value}%</td>
                    <td className="px-4 py-2.5 text-ink-700 tabular-nums">{row.order_count}</td>
                    <td className="px-4 py-2.5 font-medium text-ink-900 tabular-nums">{fmt(row.total_fee)}</td>
                    <td className={`px-4 py-2.5 tabular-nums font-medium ${row.total_accrued > 0 ? 'text-warning' : 'text-ink-400'}`}>
                      {fmt(row.total_accrued)}
                    </td>
                    <td className="px-4 py-2.5 text-success tabular-nums font-medium">{fmt(row.total_paid)}</td>
                  </tr>
                ))}
              </TableCard>
        )}

        {loading && !error && (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="h-12 bg-sand-100 rounded-lg animate-pulse" />)}
          </div>
        )}
    </div>
  )
}
