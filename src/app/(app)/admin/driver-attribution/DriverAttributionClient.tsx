'use client'

import { useState, useEffect, useRef } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface OrderItem {
  product_name: string
  qty:          number
  line_total:   number
}

interface Order {
  id:            string
  order_number:  string
  created_at:    string
  total:         number
  customer_name: string | null
  branch_name:   string
  driver_id:     string | null
  driver_name:   string | null
  driver_fee:    number | null
  company_name:  string | null
  company_fee:   number | null
  items:         OrderItem[]
}

interface Driver {
  id:        string
  name:      string
  fee_value: number
}

interface Props {
  drivers: Driver[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtRp(n: number) {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(n)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  })
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function DriverAttributionClient({ drivers }: Props) {
  const [query,          setQuery]          = useState('')
  const [orders,         setOrders]         = useState<Order[]>([])
  const [loading,        setLoading]        = useState(false)
  const [searched,       setSearched]       = useState(false)

  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set())
  const [selectedDriver, setSelectedDriver] = useState('')

  const [assigning,      setAssigning]      = useState(false)
  const [toast,          setToast]          = useState<string | null>(null)
  const [toastError,     setToastError]     = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.length < 2) {
      setOrders([])
      setSearched(false)
      setSelectedIds(new Set())
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setSearched(true)
      try {
        const res  = await fetch(`/api/v1/orders/search?q=${encodeURIComponent(query)}&limit=30`)
        const json = await res.json()
        setOrders(json.data ?? [])
      } catch {
        setOrders([])
      } finally {
        setLoading(false)
      }
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // Auto-dismiss toast
  function showToast(msg: string, isError = false) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    if (isError) {
      setToastError(msg)
      setToast(null)
    } else {
      setToast(msg)
      setToastError(null)
    }
    toastTimer.current = setTimeout(() => {
      setToast(null)
      setToastError(null)
    }, 4500)
  }

  // Selection
  function toggleOrder(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(orders.map(o => o.id)))
    }
  }

  // Assign
  async function handleAssign() {
    if (!selectedDriver || selectedIds.size === 0) return
    setAssigning(true)
    try {
      const res  = await fetch('/api/v1/orders/assign-driver', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ order_ids: Array.from(selectedIds), driver_id: selectedDriver }),
      })
      const json = await res.json()
      if (!res.ok) {
        showToast(json.error?.message ?? 'Terjadi kesalahan saat assign driver.', true)
        return
      }

      const { updated_count, total_driver_fee, total_company_fee } = json.data as {
        updated_count:     number
        total_driver_fee:  number
        total_company_fee: number
      }

      const driver = drivers.find(d => d.id === selectedDriver)
      const driverLabel = driver?.name ?? 'Driver'

      // Inline update rows
      setOrders(prev =>
        prev.map(o => {
          if (!selectedIds.has(o.id)) return o
          return {
            ...o,
            driver_id:   selectedDriver,
            driver_name: driverLabel,
            driver_fee:  Math.round(o.total * (driver?.fee_value ?? 0) / 100),
          }
        })
      )

      showToast(
        `${updated_count} order di-assign ke ${driverLabel} · Fee driver: ${fmtRp(total_driver_fee)} · Fee perusahaan: ${fmtRp(total_company_fee)}`
      )
      setSelectedIds(new Set())
      setSelectedDriver('')
    } catch {
      showToast('Koneksi gagal. Coba lagi.', true)
    } finally {
      setAssigning(false)
    }
  }

  const allSelected = orders.length > 0 && selectedIds.size === orders.length
  const someSelected = selectedIds.size > 0

  const selectCls = 'h-9 rounded-md border border-line-strong px-3 text-sm text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100 bg-white'

  return (
    <div className="space-y-6 pb-32">

      {/* Header */}
      <div>
        <h1 className="font-display text-3xl text-ink-900">Atribusi Driver</h1>
        <p className="text-sm text-ink-500 mt-1">Cari order dan assign driver untuk kalkulasi fee</p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none"
          fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={2}
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="6"/><path d="M15 15l3 3" strokeLinecap="round"/>
        </svg>
        <input
          type="text"
          className="w-full bg-white border border-line-strong rounded-xl pl-9 pr-10 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100"
          placeholder="Cari nomor order..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoComplete="off"
        />
        {/* Loading spinner */}
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-pine animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          </span>
        )}
      </div>

      {/* Empty state — before search */}
      {!searched && !loading && (
        <div className="py-20 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-sand-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="text-sm text-ink-500">Cari nomor order untuk mulai assign driver</p>
          <p className="text-xs text-ink-400">Minimal 2 karakter</p>
        </div>
      )}

      {/* Empty state — no results */}
      {searched && !loading && orders.length === 0 && (
        <div className="py-20 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-sand-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <p className="text-sm text-ink-500">
            Tidak ada order ditemukan untuk <span className="font-mono text-ink-700">&apos;{query}&apos;</span>
          </p>
        </div>
      )}

      {/* Results */}
      {orders.length > 0 && (
        <div className="bg-white rounded-xl border border-line shadow-sm overflow-hidden">

          {/* Table header / select-all */}
          <div className="px-4 py-3 border-b border-line flex items-center gap-3 bg-sand-50">
            <input
              type="checkbox"
              id="select-all"
              checked={allSelected}
              onChange={toggleAll}
              className="w-4 h-4 rounded accent-pine cursor-pointer"
              aria-label="Pilih semua order"
            />
            <label htmlFor="select-all" className="text-xs font-medium text-ink-500 cursor-pointer select-none">
              {allSelected ? 'Batalkan semua' : `Pilih semua (${orders.length})`}
            </label>
          </div>

          {/* Order rows */}
          <div className="divide-y divide-line">
            {orders.map(order => {
              const isSelected  = selectedIds.has(order.id)
              const hasDriver   = order.driver_id !== null
              const itemsLabel  = order.items.slice(0, 2).map(i => `${i.product_name} ×${i.qty}`).join(', ')
              const extraItems  = order.items.length > 2 ? ` +${order.items.length - 2} lagi` : ''

              return (
                <label
                  key={order.id}
                  className={[
                    'flex items-start gap-3 px-4 py-4 cursor-pointer transition-colors',
                    isSelected ? 'bg-pine-50' : 'hover:bg-sand-50',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleOrder(order.id)}
                    className="mt-0.5 w-4 h-4 rounded accent-pine cursor-pointer flex-shrink-0"
                    aria-label={`Pilih order ${order.order_number}`}
                  />

                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Row 1: order number + date + total */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-ink-900">
                        #{order.order_number}
                      </span>
                      <span className="text-ink-400 text-xs">·</span>
                      <span className="text-xs text-ink-500">{fmtDate(order.created_at)}</span>
                      <span className="text-ink-400 text-xs">·</span>
                      <span className="text-sm font-semibold text-pine tabular-nums">{fmtRp(order.total)}</span>
                    </div>

                    {/* Row 2: customer + branch */}
                    <div className="flex items-center gap-2 text-xs text-ink-500 flex-wrap">
                      {order.customer_name && (
                        <>
                          <span>{order.customer_name}</span>
                          <span className="text-ink-300">·</span>
                        </>
                      )}
                      <span>{order.branch_name}</span>
                    </div>

                    {/* Row 3: items summary */}
                    <p className="text-xs text-ink-400 truncate">
                      {itemsLabel}{extraItems}
                    </p>

                    {/* Row 4: driver info */}
                    {hasDriver ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-pine-50 text-pine border border-pine-200 rounded-full px-2 py-0.5">
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
                            <circle cx="8" cy="6" r="3"/>
                            <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round"/>
                          </svg>
                          {order.driver_name}
                          {order.company_name && ` · ${order.company_name}`}
                        </span>
                        {order.driver_fee !== null && (
                          <span className="text-[11px] text-ink-400">
                            Fee driver: {fmtRp(order.driver_fee)}
                            {order.company_fee !== null && ` · Fee perusahaan: ${fmtRp(order.company_fee)}`}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-ink-400 italic">Driver: — (belum di-assign)</span>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* Toast success */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] max-w-sm w-[calc(100%-2rem)] bg-pine text-white text-sm rounded-xl px-4 py-3 shadow-lg flex items-start gap-2"
        >
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 8l4 4 6-6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>{toast}</span>
        </div>
      )}

      {/* Toast error */}
      {toastError && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] max-w-sm w-[calc(100%-2rem)] bg-danger text-white text-sm rounded-xl px-4 py-3 shadow-lg flex items-start gap-2"
        >
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2.5">
            <path d="M4 4l8 8M4 12l8-8" strokeLinecap="round"/>
          </svg>
          <span>{toastError}</span>
        </div>
      )}

      {/* Floating action bar */}
      {someSelected && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-line shadow-[0_-4px_24px_rgba(0,0,0,0.08)]"
          role="region"
          aria-label="Assign driver"
        >
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
            {/* Selection count */}
            <span className="text-sm font-medium text-ink-700 flex-shrink-0">
              {selectedIds.size} order dipilih
            </span>

            <span className="text-ink-300 select-none flex-shrink-0">·</span>

            {/* Driver dropdown */}
            <select
              value={selectedDriver}
              onChange={e => setSelectedDriver(e.target.value)}
              className={`${selectCls} flex-1 min-w-[160px]`}
              aria-label="Pilih driver"
            >
              <option value="">Pilih driver...</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.fee_value}%)
                </option>
              ))}
            </select>

            {/* Assign button */}
            <button
              onClick={handleAssign}
              disabled={!selectedDriver || assigning}
              className="h-9 px-5 rounded-md bg-pine text-white text-sm font-semibold hover:bg-pine-700 disabled:opacity-40 disabled:pointer-events-none transition-colors flex-shrink-0"
            >
              {assigning ? 'Mengassign...' : 'Assign'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
