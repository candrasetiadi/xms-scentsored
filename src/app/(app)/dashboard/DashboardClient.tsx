'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DashboardStats } from '@/types/database'

// ── Types ─────────────────────────────────────────────────────────────────────

type Range = 'today' | '7d' | 'month' | 'custom'

interface OrderItem {
  qty:          number
  unit_price:   number
  product_name: string
}

interface MyOrder {
  id:             string
  order_number:   string
  total:          number
  subtotal:       number
  discount:       number
  paid_at:        string | null
  customer_name:  string | null
  customer_phone: string | null
  item_count:     number
  items:          OrderItem[]
}

interface MySalesData {
  summary: { total_revenue: number; total_orders: number; avg_order_value: number }
  orders:  MyOrder[]
}

interface Props {
  staffId:   string | null
  staffName: string
  staffRole: string
  branchId:  string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtRp(n: number): string {
  if (n >= 1_000_000) return 'Rp ' + (n / 1_000_000).toFixed(1).replace('.', ',') + 'jt'
  if (n >= 1_000)     return 'Rp ' + (n / 1_000).toFixed(1).replace('.', ',') + 'rb'
  return 'Rp ' + Math.round(n)
}

function fmtRpFull(n: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getDateRange(range: Range, customFrom: string, customTo: string): { from: string; to: string } {
  const today = new Date()
  const toDate = toISODate(today)
  if (range === 'custom') return { from: customFrom || toDate, to: customTo || toDate }
  if (range === 'today')  return { from: toDate, to: toDate }
  if (range === '7d') {
    const from = new Date(today); from.setDate(from.getDate() - 6)
    return { from: toISODate(from), to: toDate }
  }
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

function EmptyRanking({ letter }: { letter: string }) {
  return (
    <div className="py-12 flex flex-col items-center gap-2 text-center px-6">
      <div className="w-9 h-9 rounded-full bg-sand-100 flex items-center justify-center font-display text-lg text-ink-400">{letter}</div>
      <p className="font-sans text-sm font-medium text-ink-700">Belum ada data</p>
      <p className="font-sans text-xs text-ink-400 max-w-[180px]">Pilih periode yang berbeda atau tunggu transaksi pertama.</p>
    </div>
  )
}

// ── Order detail expandable row ───────────────────────────────────────────────

function OrderRow({ order }: { order: MyOrder }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <tr
        className="hover:bg-sand-50/70 transition-colors cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <td className="px-4 py-3">
          <p className="font-sans text-sm font-semibold text-ink-900">{order.order_number}</p>
          <p className="font-sans text-xs text-ink-400 mt-0.5">{fmtTime(order.paid_at)}</p>
        </td>
        <td className="px-4 py-3">
          {order.customer_name
            ? <p className="font-sans text-sm text-ink-900">{order.customer_name}</p>
            : <p className="font-sans text-sm text-ink-300 italic">Tanpa nama</p>}
          {order.customer_phone && <p className="font-sans text-xs text-ink-400">{order.customer_phone}</p>}
        </td>
        <td className="px-4 py-3 text-center">
          <span className="font-sans text-xs text-ink-500 bg-sand-100 px-2 py-0.5 rounded-full">
            {order.item_count} item
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <p className="font-sans text-sm font-semibold tabular-nums text-ink-900">{fmtRpFull(order.total)}</p>
          {order.discount > 0 && (
            <p className="font-sans text-xs text-ink-400 line-through tabular-nums">{fmtRpFull(order.subtotal)}</p>
          )}
        </td>
        <td className="px-3 py-3 text-ink-300">
          <svg
            width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75"
            strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path d="M2 5l5 4 5-4" />
          </svg>
        </td>
      </tr>

      {open && (
        <tr className="bg-sand-50/50">
          <td colSpan={5} className="px-4 pb-3">
            <div className="border border-line rounded-lg overflow-hidden mt-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-sand-100 text-ink-400">
                    <th className="px-3 py-2 text-left font-medium">Produk</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Harga</th>
                    <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {order.items.map((item, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-ink-900 font-medium">{item.product_name}</td>
                      <td className="px-3 py-2 text-right text-ink-500 tabular-nums">{item.qty}</td>
                      <td className="px-3 py-2 text-right text-ink-500 tabular-nums">{fmtRpFull(item.unit_price)}</td>
                      <td className="px-3 py-2 text-right text-ink-900 font-medium tabular-nums">{fmtRpFull(item.qty * item.unit_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Date range header shared ──────────────────────────────────────────────────

interface RangeControlProps {
  range:         Range
  showCustom:    boolean
  customFrom:    string
  customTo:      string
  onRangeClick:  (r: 'today' | '7d' | 'month') => void
  onCustomToggle: () => void
  onCustomFrom:  (v: string) => void
  onCustomTo:    (v: string) => void
  onCustomSubmit: () => void
  staffName:     string
}

function RangeHeader({
  range, showCustom, customFrom, customTo,
  onRangeClick, onCustomToggle, onCustomFrom, onCustomTo, onCustomSubmit,
  staffName,
}: RangeControlProps) {
  const TABS: { key: 'today' | '7d' | 'month'; label: string }[] = [
    { key: 'today', label: 'Hari Ini' },
    { key: '7d',    label: '7 Hari'   },
    { key: 'month', label: 'Bulan Ini' },
  ]

  return (
    <>
      <header className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="font-display text-[30px] leading-tight text-ink-900">Dashboard</h1>
          <p className="font-sans text-sm text-ink-500 mt-0.5">Selamat pagi, {staffName}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-1 bg-sand-100 rounded-md gap-0.5">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => onRangeClick(t.key)}
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
          <button
            onClick={onCustomToggle}
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

      {showCustom && (
        <div className="flex items-center gap-3 flex-wrap -mt-4 pb-2">
          <input type="date" value={customFrom} onChange={e => onCustomFrom(e.target.value)}
            className="bg-white border border-line-strong rounded-md px-3 py-1.5 text-sm text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100" />
          <span className="text-ink-400 text-sm">—</span>
          <input type="date" value={customTo} onChange={e => onCustomTo(e.target.value)}
            className="bg-white border border-line-strong rounded-md px-3 py-1.5 text-sm text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100" />
          <button
            onClick={onCustomSubmit}
            disabled={!customFrom || !customTo}
            className="bg-pine text-white font-sans text-sm font-medium px-4 py-1.5 rounded-md hover:bg-pine-700 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            Tampilkan
          </button>
        </div>
      )}
    </>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DashboardClient({ staffId, staffName, staffRole, branchId }: Props) {
  const isAdmin = staffRole === 'owner' || staffRole === 'admin'

  const [range,       setRange]       = useState<Range>('today')
  const [customFrom,  setCustomFrom]  = useState('')
  const [customTo,    setCustomTo]    = useState('')
  const [showCustom,  setShowCustom]  = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  // Admin state
  const [adminData, setAdminData] = useState<DashboardStats | null>(null)

  // Non-admin state
  const [myData, setMyData] = useState<MySalesData | null>(null)

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchAdmin = useCallback(async (from: string, to: string) => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ from, to })
      if (branchId) params.set('branch_id', branchId)
      const res  = await fetch(`/api/v1/dashboard?${params}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error?.message ?? 'Gagal memuat data.'); return }
      setAdminData(json.data)
    } catch { setError('Koneksi gagal.') }
    finally  { setLoading(false) }
  }, [branchId])

  const fetchMySales = useCallback(async (from: string, to: string) => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ from, to })
      const res  = await fetch(`/api/v1/dashboard/my-sales?${params}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Gagal memuat data.'); return }
      setMyData(json.data)
    } catch { setError('Koneksi gagal.') }
    finally  { setLoading(false) }
  }, [])

  const fetchData = useCallback((r: Range, from: string, to: string) => {
    if (isAdmin) fetchAdmin(from, to)
    else         fetchMySales(from, to)
  }, [isAdmin, fetchAdmin, fetchMySales])

  useEffect(() => {
    if (range === 'custom') return
    const { from, to } = getDateRange(range, customFrom, customTo)
    fetchData(range, from, to)
  }, [range, fetchData]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleRangeClick(r: 'today' | '7d' | 'month') {
    setShowCustom(false); setRange(r)
  }

  function handleCustomSubmit() {
    if (!customFrom || !customTo) return
    setRange('custom')
    fetchData('custom', customFrom, customTo)
  }

  const rangeProps = {
    range, showCustom, customFrom, customTo,
    onRangeClick: handleRangeClick,
    onCustomToggle: () => setShowCustom(v => !v),
    onCustomFrom: setCustomFrom,
    onCustomTo:   setCustomTo,
    onCustomSubmit: handleCustomSubmit,
    staffName,
  }

  // ── Non-admin view ───────────────────────────────────────────────────────

  if (!isAdmin) {
    const summary = myData?.summary
    const orders  = myData?.orders ?? []

    return (
      <div className="bg-sand-50 min-h-screen">
        <div className="max-w-screen-md mx-auto px-4 md:px-6 py-8 space-y-6">
          <RangeHeader {...rangeProps} />

          {error && (
            <div className="bg-danger-bg border border-danger-bd text-danger text-sm rounded-lg px-4 py-3">{error}</div>
          )}

          {/* Summary cards */}
          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              <SkeletonCard className="col-span-2" />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {/* Total Revenue */}
              <div className="bg-pine rounded-xl p-5 shadow-md col-span-2">
                <p className="font-sans text-[11px] font-medium uppercase tracking-[.22em] text-pine-200">
                  Total Penjualanmu
                </p>
                <p className="font-sans text-[36px] font-semibold tabular-nums leading-none text-white mt-2">
                  {fmtRp(summary?.total_revenue ?? 0)}
                </p>
                <p className="font-sans text-xs text-pine-200 mt-1">
                  {periodLabel(range)} · {summary?.total_orders ?? 0} order
                </p>
              </div>

              {/* Total Order */}
              <div className="bg-white border border-line rounded-xl p-5 shadow-sm">
                <p className="font-sans text-[11px] font-medium uppercase tracking-[.22em] text-ink-400">Total Order</p>
                <p className="font-sans text-3xl font-semibold tabular-nums text-ink-900 mt-2 leading-none">
                  {summary?.total_orders ?? 0}
                </p>
                <p className="font-sans text-xs text-ink-400 mt-1">transaksi</p>
              </div>

              {/* Avg */}
              <div className="bg-white border border-line rounded-xl p-5 shadow-sm">
                <p className="font-sans text-[11px] font-medium uppercase tracking-[.22em] text-ink-400">Rata-rata</p>
                <p className="font-sans text-3xl font-semibold tabular-nums text-ink-900 mt-2 leading-none">
                  {fmtRp(summary?.avg_order_value ?? 0)}
                </p>
                <p className="font-sans text-xs text-ink-400 mt-1">per transaksi</p>
              </div>
            </div>
          )}

          {/* Order list */}
          {!loading && (
            <div className="bg-white border border-line rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3.5 border-b border-line flex items-center justify-between">
                <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[.22em] text-ink-400">
                  List Penjualan
                </h2>
                <span className="font-sans text-xs text-ink-400">{orders.length} transaksi</span>
              </div>

              {orders.length === 0 ? (
                <div className="py-14 flex flex-col items-center gap-2 text-center px-6">
                  <div className="w-9 h-9 rounded-full bg-sand-100 flex items-center justify-center text-ink-300">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                      <rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 8h6M5 5.5h4M5 10.5h3"/>
                    </svg>
                  </div>
                  <p className="font-sans text-sm font-medium text-ink-700">Belum ada penjualan</p>
                  <p className="font-sans text-xs text-ink-400">Transaksi yang kamu proses akan muncul di sini.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-sand-50 border-b border-line">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-400">Order</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-400">Pelanggan</th>
                      <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-400">Item</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-ink-400">Total</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {orders.map(order => (
                      <OrderRow key={order.id} order={order} />
                    ))}
                  </tbody>
                  <tfoot className="bg-sand-50 border-t border-line">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 font-sans text-sm font-semibold text-ink-700">
                        Total {periodLabel(range)}
                      </td>
                      <td className="px-4 py-3 text-right font-sans text-sm font-bold tabular-nums text-ink-900">
                        {fmtRpFull(summary?.total_revenue ?? 0)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Admin view ───────────────────────────────────────────────────────────

  const totalLowStock = (adminData?.low_stock_products?.length ?? 0) + (adminData?.low_stock_materials?.length ?? 0)

  return (
    <div className="bg-sand-50 min-h-screen">
      <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">
        <RangeHeader {...rangeProps} />

        {error && (
          <div className="bg-danger-bg border border-danger-bd text-danger text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-1 md:grid-cols-2">
          {loading ? (
            <>
              <SkeletonCard className="md:col-span-2 sm:col-span-1" />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : adminData ? (
            <>
              <div className="bg-pine rounded-lg p-6 shadow-md md:col-span-2 sm:col-span-1">
                <p className="font-sans text-[11px] font-medium uppercase tracking-[.22em] text-pine-200">Total Revenue</p>
                <p className="font-sans text-[36px] font-semibold tabular-nums leading-none text-white mt-2">
                  {fmtRp(adminData.summary.total_revenue)}
                </p>
                <p className="font-sans text-xs text-pine-200 mt-1">
                  {periodLabel(range)} · {adminData.summary.total_orders} order
                </p>
              </div>
              <div className="bg-white border border-line rounded-lg p-6 shadow-sm">
                <p className="font-sans text-[11px] font-medium uppercase tracking-[.22em] text-ink-400">Total Order</p>
                <p className="font-sans text-[36px] font-semibold tabular-nums leading-none text-ink-900 mt-2">{adminData.summary.total_orders}</p>
                <p className="font-sans text-xs text-ink-500 mt-1">transaksi</p>
              </div>
              <div className="bg-white border border-line rounded-lg p-6 shadow-sm">
                <p className="font-sans text-[11px] font-medium uppercase tracking-[.22em] text-ink-400">Rata-rata Order</p>
                <p className="font-sans text-[36px] font-semibold tabular-nums leading-none text-ink-900 mt-2">
                  {fmtRp(adminData.summary.avg_order_value)}
                </p>
                <p className="font-sans text-xs text-ink-500 mt-1">per transaksi</p>
              </div>
            </>
          ) : null}
        </div>

        {/* Rankings */}
        {!loading && adminData && (
          <div className="grid grid-cols-2 gap-6">
            {/* Top Sales */}
            <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-line">
                <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[.22em] text-ink-400">Top Sales</h2>
              </div>
              {adminData.top_sales.length === 0 ? <EmptyRanking letter="S" /> : (
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
                    {adminData.top_sales.map((row, i) => (
                      <tr key={row.staff_id} className="border-b border-line last:border-0 hover:bg-sand-50 transition-colors">
                        <td className="px-4 py-3">
                          {i === 0
                            ? <span className="w-6 h-6 rounded-full bg-pine text-white text-[11px] font-semibold flex items-center justify-center">1</span>
                            : <span className="w-6 h-6 rounded-full bg-sand-100 text-ink-500 text-[11px] font-medium flex items-center justify-center">{i + 1}</span>}
                        </td>
                        <td className="px-4 py-3 font-sans text-sm font-medium text-ink-900">{row.staff_name}</td>
                        <td className="px-4 py-3 font-sans text-sm tabular-nums text-ink-500 text-right">{row.order_count}</td>
                        <td className="px-4 py-3 font-sans text-sm tabular-nums font-medium text-ink-900 text-right">{fmtRp(row.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Top Drivers */}
            <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-line">
                <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[.22em] text-ink-400">Top Driver</h2>
              </div>
              {adminData.top_drivers.length === 0 ? <EmptyRanking letter="D" /> : (
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
                    {adminData.top_drivers.map((row, i) => (
                      <tr key={row.driver_id} className="border-b border-line last:border-0 hover:bg-sand-50 transition-colors">
                        <td className="px-4 py-3">
                          {i === 0
                            ? <span className="w-6 h-6 rounded-full bg-pine text-white text-[11px] font-semibold flex items-center justify-center">1</span>
                            : <span className="w-6 h-6 rounded-full bg-sand-100 text-ink-500 text-[11px] font-medium flex items-center justify-center">{i + 1}</span>}
                        </td>
                        <td className="px-4 py-3 font-sans text-sm font-medium text-ink-900">{row.driver_name}</td>
                        <td className="px-4 py-3 font-sans text-sm tabular-nums text-ink-500 text-right">{row.order_count}</td>
                        <td className="px-4 py-3 font-sans text-sm tabular-nums font-medium text-ink-900 text-right">{fmtRp(row.revenue)}</td>
                        <td className="px-4 py-3 font-sans text-sm tabular-nums font-semibold text-rust text-right">{fmtRp(row.fee_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Low Stock */}
        {!loading && adminData && (
          <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-line flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-warning flex-shrink-0" />
              <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[.22em] text-ink-400">Stok Perlu Perhatian</h2>
              <span className="ml-auto font-sans text-xs text-ink-400">{totalLowStock} item</span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-line sm:grid-cols-1 sm:divide-x-0 sm:divide-y sm:divide-line">
              <div className="p-6">
                <p className="font-sans text-[11px] font-medium uppercase tracking-[.22em] text-ink-400 mb-4">Produk Siap Jual</p>
                {adminData.low_stock_products.length === 0 ? (
                  <p className="font-sans text-xs text-ink-400">Semua stok produk aman.</p>
                ) : adminData.low_stock_products.map(item => (
                  <div key={item.product_id} className="flex items-center justify-between py-2.5 border-b border-line last:border-0">
                    <div>
                      <p className="font-sans text-sm font-medium text-ink-900">{item.product_name}</p>
                      <p className="font-sans text-xs text-ink-400">{item.sku} · Min. {item.reorder_level}</p>
                    </div>
                    <span className={`text-xs font-semibold tabular-nums px-2.5 py-0.5 rounded-full ${
                      item.stock === 0 ? 'bg-danger-bg text-danger border border-danger-bd' : 'bg-warning-bg text-warning border border-warning-bd'
                    }`}>{item.stock}</span>
                  </div>
                ))}
              </div>
              <div className="p-6">
                <p className="font-sans text-[11px] font-medium uppercase tracking-[.22em] text-ink-400 mb-4">Bahan Baku</p>
                {adminData.low_stock_materials.length === 0 ? (
                  <p className="font-sans text-xs text-ink-400">Semua stok bahan baku aman.</p>
                ) : adminData.low_stock_materials.map(item => (
                  <div key={item.raw_material_id} className="flex items-center justify-between py-2.5 border-b border-line last:border-0">
                    <div>
                      <p className="font-sans text-sm font-medium text-ink-900">{item.name}</p>
                      <p className="font-sans text-xs text-ink-400">Min. {item.reorder_level} {item.unit}</p>
                    </div>
                    <span className={`text-xs font-semibold tabular-nums px-2.5 py-0.5 rounded-full ${
                      item.qty_remaining === 0 ? 'bg-danger-bg text-danger border border-danger-bd' : 'bg-warning-bg text-warning border border-warning-bd'
                    }`}>{item.qty_remaining} {item.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
