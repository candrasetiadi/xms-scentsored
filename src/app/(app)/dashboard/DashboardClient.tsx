'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DashboardStats } from '@/types/database'

// ── Types ─────────────────────────────────────────────────────────────────────

type Range = 'today' | '7d' | 'month' | 'custom'

interface Props {
  staffName: string
  staffRole: string
  branchId:  string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRingkas(n: number): string {
  if (n >= 1_000_000) {
    return 'Rp ' + (n / 1_000_000).toFixed(1).replace('.', ',') + 'jt'
  }
  if (n >= 1_000) {
    return 'Rp ' + (n / 1_000).toFixed(1).replace('.', ',') + 'rb'
  }
  return 'Rp ' + Math.round(n)
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getDateRange(range: Range, customFrom: string, customTo: string): { from: string; to: string } {
  const today = new Date()
  const toDate = toISODate(today)

  if (range === 'custom') {
    return { from: customFrom || toDate, to: customTo || toDate }
  }
  if (range === 'today') {
    return { from: toDate, to: toDate }
  }
  if (range === '7d') {
    const from = new Date(today)
    from.setDate(from.getDate() - 6)
    return { from: toISODate(from), to: toDate }
  }
  // month
  const from = new Date(today.getFullYear(), today.getMonth(), 1)
  return { from: toISODate(from), to: toDate }
}

function periodLabel(range: Range): string {
  if (range === 'today')  return 'Hari ini'
  if (range === '7d')     return '7 hari terakhir'
  if (range === 'month')  return 'Bulan ini'
  return 'Periode custom'
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard({ className }: { className?: string }) {
  return <div className={`bg-sand-200 animate-pulse rounded-lg h-32 ${className ?? ''}`} />
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyRanking({ letter }: { letter: string }) {
  return (
    <div className="py-12 flex flex-col items-center gap-2 text-center px-6">
      <div className="w-9 h-9 rounded-full bg-sand-100 flex items-center justify-center font-display text-lg text-ink-400">
        {letter}
      </div>
      <p className="font-sans text-sm font-medium text-ink-700">Belum ada data</p>
      <p className="font-sans text-xs text-ink-400 max-w-[180px]">
        Pilih periode yang berbeda atau tunggu transaksi pertama.
      </p>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DashboardClient({ staffName, branchId }: Props) {
  const [range,      setRange]      = useState<Range>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [data,       setData]       = useState<DashboardStats | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)

  const fetchData = useCallback(async (r: Range, from: string, to: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ from, to })
      if (branchId) params.set('branch_id', branchId)
      const res  = await fetch(`/api/v1/dashboard?${params}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error?.message ?? 'Gagal memuat data.'); return }
      setData(json.data)
    } catch {
      setError('Koneksi gagal. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    if (range === 'custom') return // custom triggered manually
    const { from, to } = getDateRange(range, customFrom, customTo)
    fetchData(range, from, to)
  }, [range, fetchData]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleRangeClick(r: 'today' | '7d' | 'month') {
    setShowCustom(false)
    setRange(r)
  }

  function handleCustomSubmit() {
    if (!customFrom || !customTo) return
    setRange('custom')
    fetchData('custom', customFrom, customTo)
  }

  const totalLowStock = (data?.low_stock_products?.length ?? 0) + (data?.low_stock_materials?.length ?? 0)

  // ── Tabs ──────────────────────────────────────────────────────────────────

  const TABS: { key: 'today' | '7d' | 'month'; label: string }[] = [
    { key: 'today', label: 'Hari Ini' },
    { key: '7d',    label: '7 Hari'   },
    { key: 'month', label: 'Bulan Ini' },
  ]

  return (
    <div className="bg-sand-50 min-h-screen">
      <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">

        {/* ── A. Header + Filter ─────────────────────────────────────────── */}
        <header className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="font-display text-[30px] leading-tight text-ink-900">Dashboard</h1>
            <p className="font-sans text-sm text-ink-500 mt-0.5">Selamat pagi, {staffName}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Segmented control */}
            <div className="flex items-center p-1 bg-sand-100 rounded-md gap-0.5">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => handleRangeClick(t.key)}
                  className={
                    range === t.key && !showCustom
                      ? 'font-sans text-sm font-medium text-pine px-3 py-1.5 rounded-[6px] bg-white shadow-sm whitespace-nowrap'
                      : 'font-sans text-sm font-medium text-ink-500 px-3 py-1.5 rounded-[6px] hover:bg-white hover:text-ink-900 hover:shadow-sm transition-colors whitespace-nowrap'
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
            {/* Custom button */}
            <button
              onClick={() => setShowCustom(v => !v)}
              className={`font-sans text-sm font-medium px-3 py-1.5 border rounded-md transition-colors ${
                showCustom
                  ? 'border-pine-400 text-pine bg-pine-50'
                  : 'text-ink-700 border-line-strong bg-white hover:border-pine-400 hover:text-pine'
              }`}
            >
              Custom
            </button>
          </div>
        </header>

        {/* Custom range inputs */}
        {showCustom && (
          <div className="flex items-center gap-3 flex-wrap -mt-4 pb-2">
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="bg-white border border-line-strong rounded-md px-3 py-1.5 text-sm text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100"
            />
            <span className="text-ink-400 text-sm">—</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="bg-white border border-line-strong rounded-md px-3 py-1.5 text-sm text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100"
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!customFrom || !customTo}
              className="bg-pine text-white font-sans text-sm font-medium px-4 py-1.5 rounded-md hover:bg-pine-700 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              Tampilkan
            </button>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-danger-bg border border-danger-bd text-danger text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* ── B. Summary Cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-1 md:grid-cols-2">
          {loading ? (
            <>
              <SkeletonCard className="md:col-span-2 sm:col-span-1" />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : data ? (
            <>
              {/* Revenue */}
              <div className="bg-pine rounded-lg p-6 shadow-md md:col-span-2 sm:col-span-1">
                <p className="font-sans text-[11px] font-medium uppercase tracking-[.22em] text-pine-200">
                  Total Revenue
                </p>
                <p className="font-sans text-[36px] font-semibold tabular-nums leading-none text-white mt-2">
                  {formatRingkas(data.summary.total_revenue)}
                </p>
                <p className="font-sans text-xs text-pine-200 mt-1">
                  {periodLabel(range)} · {data.summary.total_orders} order
                </p>
              </div>

              {/* Total Orders */}
              <div className="bg-white border border-line rounded-lg p-6 shadow-sm">
                <p className="font-sans text-[11px] font-medium uppercase tracking-[.22em] text-ink-400">
                  Total Order
                </p>
                <p className="font-sans text-[36px] font-semibold tabular-nums leading-none text-ink-900 mt-2">
                  {data.summary.total_orders}
                </p>
                <p className="font-sans text-xs text-ink-500 mt-1">transaksi</p>
              </div>

              {/* Avg Order Value */}
              <div className="bg-white border border-line rounded-lg p-6 shadow-sm">
                <p className="font-sans text-[11px] font-medium uppercase tracking-[.22em] text-ink-400">
                  Rata-rata Order
                </p>
                <p className="font-sans text-[36px] font-semibold tabular-nums leading-none text-ink-900 mt-2">
                  {formatRingkas(data.summary.avg_order_value)}
                </p>
                <p className="font-sans text-xs text-ink-500 mt-1">per transaksi</p>
              </div>
            </>
          ) : null}
        </div>

        {/* ── C. Rankings ──────────────────────────────────────────────── */}
        {!loading && data && (
          <div className="grid grid-cols-2 gap-6">

            {/* Top Sales */}
            <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-line flex items-center justify-between">
                <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[.22em] text-ink-400">
                  Top Sales
                </h2>
              </div>
              {data.top_sales.length === 0 ? (
                <EmptyRanking letter="S" />
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-sand-100">
                    <tr>
                      <th className="font-sans text-[11px] uppercase tracking-[.22em] text-ink-400 font-medium px-4 py-3 text-left w-10">#</th>
                      <th className="font-sans text-[11px] uppercase tracking-[.22em] text-ink-400 font-medium px-4 py-3 text-left">Nama</th>
                      <th className="font-sans text-[11px] uppercase tracking-[.22em] text-ink-400 font-medium px-4 py-3 text-right">Order</th>
                      <th className="font-sans text-[11px] uppercase tracking-[.22em] text-ink-400 font-medium px-4 py-3 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_sales.map((row, i) => (
                      <tr key={row.staff_id} className="border-b border-line last:border-0 hover:bg-sand-50 transition-colors">
                        <td className="px-4 py-3">
                          {i === 0
                            ? <span className="w-6 h-6 rounded-full bg-pine text-white text-[11px] font-semibold flex items-center justify-center">1</span>
                            : <span className="w-6 h-6 rounded-full bg-sand-100 text-ink-500 text-[11px] font-medium flex items-center justify-center">{i + 1}</span>
                          }
                        </td>
                        <td className="px-4 py-3 font-sans text-sm font-medium text-ink-900">{row.staff_name}</td>
                        <td className="px-4 py-3 font-sans text-sm tabular-nums text-ink-500 text-right">{row.order_count}</td>
                        <td className="px-4 py-3 font-sans text-sm tabular-nums font-medium text-ink-900 text-right">{formatRingkas(row.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Top Drivers */}
            <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-line flex items-center justify-between">
                <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[.22em] text-ink-400">
                  Top Driver
                </h2>
              </div>
              {data.top_drivers.length === 0 ? (
                <EmptyRanking letter="D" />
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-sand-100">
                    <tr>
                      <th className="font-sans text-[11px] uppercase tracking-[.22em] text-ink-400 font-medium px-4 py-3 text-left w-10">#</th>
                      <th className="font-sans text-[11px] uppercase tracking-[.22em] text-ink-400 font-medium px-4 py-3 text-left">Nama</th>
                      <th className="font-sans text-[11px] uppercase tracking-[.22em] text-ink-400 font-medium px-4 py-3 text-right">Order</th>
                      <th className="font-sans text-[11px] uppercase tracking-[.22em] text-ink-400 font-medium px-4 py-3 text-right">Revenue</th>
                      <th className="font-sans text-[11px] uppercase tracking-[.22em] text-rust/70 font-medium px-4 py-3 text-right">Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_drivers.map((row, i) => (
                      <tr key={row.driver_id} className="border-b border-line last:border-0 hover:bg-sand-50 transition-colors">
                        <td className="px-4 py-3">
                          {i === 0
                            ? <span className="w-6 h-6 rounded-full bg-pine text-white text-[11px] font-semibold flex items-center justify-center">1</span>
                            : <span className="w-6 h-6 rounded-full bg-sand-100 text-ink-500 text-[11px] font-medium flex items-center justify-center">{i + 1}</span>
                          }
                        </td>
                        <td className="px-4 py-3 font-sans text-sm font-medium text-ink-900">{row.driver_name}</td>
                        <td className="px-4 py-3 font-sans text-sm tabular-nums text-ink-500 text-right">{row.order_count}</td>
                        <td className="px-4 py-3 font-sans text-sm tabular-nums font-medium text-ink-900 text-right">{formatRingkas(row.revenue)}</td>
                        <td className="px-4 py-3 font-sans text-sm tabular-nums font-semibold text-rust text-right">{formatRingkas(row.fee_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── D. Low Stock ─────────────────────────────────────────────── */}
        {!loading && data && (
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2 bg-white border border-line rounded-lg shadow-sm overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-line flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-warning flex-shrink-0" />
                <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[.22em] text-ink-400">
                  Stok Perlu Perhatian
                </h2>
                <span className="ml-auto font-sans text-xs text-ink-400">{totalLowStock} item</span>
              </div>

              {/* Two columns */}
              <div className="grid grid-cols-2 divide-x divide-line sm:grid-cols-1 sm:divide-x-0 sm:divide-y sm:divide-line">

                {/* Products */}
                <div className="p-6">
                  <p className="font-sans text-[11px] font-medium uppercase tracking-[.22em] text-ink-400 mb-4">
                    Produk Siap Jual
                  </p>
                  {data.low_stock_products.length === 0 ? (
                    <p className="font-sans text-xs text-ink-400">Semua stok produk aman.</p>
                  ) : (
                    data.low_stock_products.map(item => (
                      <div key={item.product_id} className="flex items-center justify-between py-2.5 border-b border-line last:border-0">
                        <div>
                          <p className="font-sans text-sm font-medium text-ink-900">{item.product_name}</p>
                          <p className="font-sans text-xs text-ink-400">{item.sku} · Min. {item.reorder_level}</p>
                        </div>
                        <span className={`text-xs font-semibold tabular-nums px-2.5 py-0.5 rounded-full ${
                          item.stock === 0
                            ? 'bg-danger-bg text-danger border border-danger-bd'
                            : 'bg-warning-bg text-warning border border-warning-bd'
                        }`}>
                          {item.stock}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Raw materials */}
                <div className="p-6">
                  <p className="font-sans text-[11px] font-medium uppercase tracking-[.22em] text-ink-400 mb-4">
                    Bahan Baku
                  </p>
                  {data.low_stock_materials.length === 0 ? (
                    <p className="font-sans text-xs text-ink-400">Semua stok bahan baku aman.</p>
                  ) : (
                    data.low_stock_materials.map(item => (
                      <div key={item.raw_material_id} className="flex items-center justify-between py-2.5 border-b border-line last:border-0">
                        <div>
                          <p className="font-sans text-sm font-medium text-ink-900">{item.name}</p>
                          <p className="font-sans text-xs text-ink-400">Min. {item.reorder_level} {item.unit}</p>
                        </div>
                        <span className={`text-xs font-semibold tabular-nums px-2.5 py-0.5 rounded-full ${
                          item.qty_remaining === 0
                            ? 'bg-danger-bg text-danger border border-danger-bd'
                            : 'bg-warning-bg text-warning border border-warning-bd'
                        }`}>
                          {item.qty_remaining} {item.unit}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
