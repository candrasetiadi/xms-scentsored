'use client'

import { useCallback, useEffect, useState } from 'react'
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

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
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
  const STATUS_COLOR: Record<string, string> = {
    antri: 'var(--color-text-secondary)', diracik: 'var(--color-warning)',
    packing: 'var(--color-primary)', selesai: 'var(--color-success)', diambil: 'var(--color-text-secondary)',
  }

  const needsBranch = tab !== 'driver-fees'

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Laporan</h1>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {needsBranch && branches.length > 1 && (
              <select value={branchId} onChange={e => setBranchId(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-sm border"
                style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            {tab !== 'stock' && (
              <>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                  className="rounded-lg px-2 py-1.5 text-sm border"
                  style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>–</span>
                <input type="date" value={to} onChange={e => setTo(e.target.value)}
                  className="rounded-lg px-2 py-1.5 text-sm border"
                  style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
              </>
            )}
            <button onClick={load} disabled={loading}
              className="rounded-lg px-3 py-1.5 text-sm font-medium"
              style={{ background: 'var(--color-primary)', color: '#fff', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Memuat...' : 'Tampilkan'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--color-surface-raised)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: tab === t.id ? 'var(--color-surface)' : 'transparent',
                color: tab === t.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="rounded-xl px-4 py-3 text-sm"
            style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>{error}</p>
        )}

        {/* ── Sales ─────────────────────────────────────────────────────────── */}
        {tab === 'sales' && sales && (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Revenue', value: fmt(sales.totals.total_revenue) },
                { label: 'Total Order', value: fmtNum(sales.totals.total_orders) },
                { label: 'Avg/Order', value: fmt(sales.totals.avg_order_value) },
                { label: 'Total Diskon', value: fmt(sales.totals.total_discount) },
              ].map(card => (
                <div key={card.label} className="rounded-xl p-4 border"
                  style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>{card.label}</p>
                  <p className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* Daily table */}
            {sales.daily.length > 0 && (
              <div className="rounded-xl border overflow-hidden"
                style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
                <div className="flex items-center justify-between px-4 py-3 border-b"
                  style={{ borderColor: 'var(--color-border)' }}>
                  <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>Penjualan Harian</p>
                  <button onClick={() => exportCsv(sales.daily as unknown as Record<string, unknown>[], 'penjualan_harian')}
                    className="text-xs px-3 py-1 rounded-lg border"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                    Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        {['Tanggal', 'Order', 'Revenue', 'Diskon', 'Avg/Order'].map(h => (
                          <th key={h} className="text-left px-4 py-2 text-xs font-medium"
                            style={{ color: 'var(--color-text-secondary)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sales.daily.map(row => (
                        <tr key={row.day} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td className="px-4 py-2" style={{ color: 'var(--color-text-primary)' }}>{fmtDate(row.day)}</td>
                          <td className="px-4 py-2" style={{ color: 'var(--color-text-primary)' }}>{row.order_count}</td>
                          <td className="px-4 py-2 font-medium" style={{ color: 'var(--color-text-primary)' }}>{fmt(row.revenue)}</td>
                          <td className="px-4 py-2" style={{ color: 'var(--color-text-secondary)' }}>{fmt(row.total_discount)}</td>
                          <td className="px-4 py-2" style={{ color: 'var(--color-text-secondary)' }}>{fmt(row.avg_order_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Top products */}
            {sales.top_products.length > 0 && (
              <div className="rounded-xl border overflow-hidden"
                style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
                <div className="flex items-center justify-between px-4 py-3 border-b"
                  style={{ borderColor: 'var(--color-border)' }}>
                  <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>Top 10 Produk</p>
                  <button onClick={() => exportCsv(sales.top_products as unknown as Record<string, unknown>[], 'top_produk')}
                    className="text-xs px-3 py-1 rounded-lg border"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                    Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        {['#', 'Produk', 'Kategori', 'Unit Terjual', 'Revenue'].map(h => (
                          <th key={h} className="text-left px-4 py-2 text-xs font-medium"
                            style={{ color: 'var(--color-text-secondary)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sales.top_products.map((row, i) => (
                        <tr key={row.product_name} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td className="px-4 py-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{i + 1}</td>
                          <td className="px-4 py-2 font-medium" style={{ color: 'var(--color-text-primary)' }}>{row.product_name}</td>
                          <td className="px-4 py-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{row.category ?? '—'}</td>
                          <td className="px-4 py-2" style={{ color: 'var(--color-text-primary)' }}>{fmtNum(row.units_sold)}</td>
                          <td className="px-4 py-2 font-medium" style={{ color: 'var(--color-text-primary)' }}>{fmt(row.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {sales.daily.length === 0 && (
              <p className="text-center py-8 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Tidak ada data penjualan dalam periode ini.</p>
            )}
          </div>
        )}

        {/* ── Stock Valuation ───────────────────────────────────────────────── */}
        {tab === 'stock' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl p-4 border"
                style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>Total Valuasi Stok</p>
                <p className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{fmt(stockTotal)}</p>
              </div>
              <div className="rounded-xl p-4 border"
                style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>Jumlah Material</p>
                <p className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{fmtNum(stock.length)}</p>
              </div>
            </div>

            {stock.length > 0 ? (
              <div className="rounded-xl border overflow-hidden"
                style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
                <div className="flex items-center justify-between px-4 py-3 border-b"
                  style={{ borderColor: 'var(--color-border)' }}>
                  <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>Valuasi per Bahan Baku (FIFO)</p>
                  <button onClick={() => exportCsv(stock as unknown as Record<string, unknown>[], 'valuasi_stok')}
                    className="text-xs px-3 py-1 rounded-lg border"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                    Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        {['Bahan Baku', 'Stok', 'Satuan', 'Nilai FIFO'].map(h => (
                          <th key={h} className="text-left px-4 py-2 text-xs font-medium"
                            style={{ color: 'var(--color-text-secondary)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stock.map(row => (
                        <tr key={row.raw_material_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td className="px-4 py-2 font-medium" style={{ color: 'var(--color-text-primary)' }}>{row.name}</td>
                          <td className="px-4 py-2" style={{ color: 'var(--color-text-primary)' }}>{fmtNum(row.total_qty)}</td>
                          <td className="px-4 py-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{row.unit}</td>
                          <td className="px-4 py-2 font-medium" style={{ color: 'var(--color-text-primary)' }}>{fmt(row.total_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-center py-8 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Tidak ada stok tercatat.</p>
            )}
          </div>
        )}

        {/* ── Production ────────────────────────────────────────────────────── */}
        {tab === 'production' && production && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="rounded-xl p-4 border"
                style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>Avg Lead Time</p>
                <p className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>
                  {production.avg_lead_time_minutes} menit
                </p>
              </div>
              <div className="rounded-xl p-4 border"
                style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>Total Order Produksi</p>
                <p className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>
                  {fmtNum(production.by_status.reduce((s, r) => s + r.cnt, 0))}
                </p>
              </div>
            </div>

            <div className="rounded-xl border overflow-hidden"
              style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
              <p className="px-4 py-3 font-medium text-sm border-b"
                style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>
                Distribusi Status
              </p>
              <div className="p-4 space-y-2">
                {production.by_status.length === 0 ? (
                  <p className="text-sm text-center py-2" style={{ color: 'var(--color-text-secondary)' }}>Tidak ada data.</p>
                ) : production.by_status.map(row => {
                  const total = production.by_status.reduce((s, r) => s + r.cnt, 0)
                  const pct = total > 0 ? Math.round((row.cnt / total) * 100) : 0
                  return (
                    <div key={row.status} className="flex items-center gap-3">
                      <span className="w-20 text-sm font-medium" style={{ color: STATUS_COLOR[row.status] ?? 'var(--color-text-primary)' }}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: STATUS_COLOR[row.status] ?? 'var(--color-primary)' }} />
                      </div>
                      <span className="text-sm w-12 text-right" style={{ color: 'var(--color-text-secondary)' }}>{row.cnt}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Driver Fees ───────────────────────────────────────────────────── */}
        {tab === 'driver-fees' && (
          <div className="space-y-4">
            {driverFees.length === 0 ? (
              <p className="text-center py-8 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Tidak ada fee driver dalam periode ini.</p>
            ) : (
              <div className="rounded-xl border overflow-hidden"
                style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
                <div className="flex items-center justify-between px-4 py-3 border-b"
                  style={{ borderColor: 'var(--color-border)' }}>
                  <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>Rekapitulasi Fee Driver</p>
                  <button onClick={() => exportCsv(driverFees as unknown as Record<string, unknown>[], 'fee_driver')}
                    className="text-xs px-3 py-1 rounded-lg border"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                    Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        {['Driver', 'Tipe', 'Fee %', 'Order', 'Total Fee', 'Accrued', 'Dibayar'].map(h => (
                          <th key={h} className="text-left px-4 py-2 text-xs font-medium"
                            style={{ color: 'var(--color-text-secondary)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {driverFees.map(row => (
                        <tr key={row.driver_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td className="px-4 py-2 font-medium" style={{ color: 'var(--color-text-primary)' }}>{row.driver_name}</td>
                          <td className="px-4 py-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                            {row.driver_type === 'travel_driver' ? 'Driver' : 'Tour Guide'}
                          </td>
                          <td className="px-4 py-2" style={{ color: 'var(--color-text-primary)' }}>{row.fee_value}%</td>
                          <td className="px-4 py-2" style={{ color: 'var(--color-text-primary)' }}>{row.order_count}</td>
                          <td className="px-4 py-2 font-medium" style={{ color: 'var(--color-text-primary)' }}>{fmt(row.total_fee)}</td>
                          <td className="px-4 py-2" style={{ color: row.total_accrued > 0 ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>
                            {fmt(row.total_accrued)}
                          </td>
                          <td className="px-4 py-2" style={{ color: 'var(--color-success)' }}>{fmt(row.total_paid)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot style={{ borderTop: '2px solid var(--color-border)' }}>
                      <tr>
                        <td colSpan={4} className="px-4 py-2 text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>TOTAL</td>
                        <td className="px-4 py-2 font-bold" style={{ color: 'var(--color-text-primary)' }}>
                          {fmt(driverFees.reduce((s, r) => s + r.total_fee, 0))}
                        </td>
                        <td className="px-4 py-2 font-bold" style={{ color: 'var(--color-warning)' }}>
                          {fmt(driverFees.reduce((s, r) => s + r.total_accrued, 0))}
                        </td>
                        <td className="px-4 py-2 font-bold" style={{ color: 'var(--color-success)' }}>
                          {fmt(driverFees.reduce((s, r) => s + r.total_paid, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {loading && !error && (
          <p className="text-center py-8 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Memuat data...</p>
        )}
      </div>
    </div>
  )
}
