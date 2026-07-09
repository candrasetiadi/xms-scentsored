'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useCallback } from 'react'

type OrderStatus = 'draft' | 'awaiting_payment' | 'paid' | 'in_production' | 'ready' | 'completed' | 'cancelled'

interface OrderItem {
  id:                  string
  product_id:          string
  qty:                 number
  unit_price:          number
  line_total:          number
  is_custom:           boolean
  customization_notes: string | null
  product:             { name: string; sku: string; type: string } | null
}

interface Order {
  id:           string
  order_number: string
  queue_number: number
  status:       OrderStatus
  subtotal:     number
  discount:     number
  total:        number
  paid_at:      string | null
  created_at:   string
  customer:     { id: string; name: string | null; phone: string | null } | null
  sales_staff:  { id: string; name: string; nickname: string | null } | null
}

interface Props {
  staffRole:    string
  branchId:     string
  branches:     { id: string; name: string }[]
  orders:       Order[]
  selectedDate: string
  statusFilter: string
  summary:      { totalOrders: number; revenue: number }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<OrderStatus, string> = {
  draft:            'Draft',
  awaiting_payment: 'Menunggu Bayar',
  paid:             'Lunas',
  in_production:    'Produksi',
  ready:            'Siap',
  completed:        'Selesai',
  cancelled:        'Dibatalkan',
}

const STATUS_STYLE: Record<OrderStatus, string> = {
  draft:            'bg-sand-100 text-ink-500 border-line',
  awaiting_payment: 'bg-warning-bg text-warning border-warning-bd',
  paid:             'bg-success-bg text-success border-success-bd',
  in_production:    'bg-pine-50 text-pine border-pine-100',
  ready:            'bg-info-bg text-info border-info-bd',
  completed:        'bg-success-bg text-success border-success-bd',
  cancelled:        'bg-danger-bg text-danger border-danger-bd',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const _rp = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
function formatRp(n: number) { return 'Rp ' + _rp.format(Math.round(n)) }

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      aria-hidden="true">
      <path d="M3 6l5 4 5-4" />
    </svg>
  )
}

// ── Item detail panel (shared between mobile + desktop) ───────────────────────

function ItemDetail({ items, discount, total, loading, showLabels }: {
  items:      OrderItem[] | null
  discount:   number
  total:      number
  loading:    boolean
  showLabels: boolean
}) {
  if (loading) return (
    <div className="py-5 text-center text-xs text-ink-400 animate-pulse">Memuat detail…</div>
  )
  if (!items?.length) return (
    <div className="py-4 text-center text-xs text-ink-400">Tidak ada item.</div>
  )
  return (
    <div className="divide-y divide-line">
      {items.map(item => (
        <div key={item.id} className="flex items-start justify-between gap-3 py-2.5 px-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-ink-900">{item.product?.name ?? '—'}</span>
              {item.is_custom && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  Custom
                </span>
              )}
            </div>
            {item.customization_notes && (
              <p className="text-[10px] text-ink-400 mt-0.5 leading-snug">{item.customization_notes}</p>
            )}
            <p className="text-[10px] text-ink-400 mt-0.5 font-mono">{item.product?.sku ?? ''}</p>
          </div>
          <div className="flex items-start gap-2 shrink-0">
            {showLabels && item.product?.type === 'custom_racik' && (
              <button
                onClick={e => {
                  e.stopPropagation()
                  e.preventDefault()
                  window.open(`/print/label/${item.id}?qty=${item.qty}`, '_blank', 'noopener,noreferrer')
                }}
                className="text-[10px] font-medium text-ink-400 hover:text-pine transition-colors px-2 py-1 rounded border border-line hover:border-pine-200 hover:bg-pine-50 leading-none shrink-0"
              >
                🏷 Label
              </button>
            )}
            <div className="text-right">
              <p className="text-xs tabular-nums text-ink-900 font-semibold">{formatRp(item.line_total)}</p>
              <p className="text-[10px] tabular-nums text-ink-400 mt-0.5">
                {item.qty} × {formatRp(item.unit_price)}
              </p>
            </div>
          </div>
        </div>
      ))}
      {discount > 0 && (
        <div className="flex justify-between px-3 py-2 bg-sand-50">
          <span className="text-xs text-ink-500">Diskon</span>
          <span className="text-xs tabular-nums text-success font-semibold">-{formatRp(discount)}</span>
        </div>
      )}
      <div className="flex justify-between px-3 py-2.5 bg-sand-50">
        <span className="text-xs font-semibold text-ink-900">Total</span>
        <span className="text-xs tabular-nums font-bold text-ink-900">{formatRp(total)}</span>
      </div>
    </div>
  )
}

// ── Action buttons (shared) ───────────────────────────────────────────────────

function OrderActions({ order, staffRole, cancelling, resending, msg, onCancel, onResend }: {
  order:       Order
  staffRole:   string
  cancelling:  string | null
  resending:   string | null
  msg:         { id: string; text: string; ok: boolean } | null
  onCancel:    (id: string) => void
  onResend:    (id: string) => void
}) {
  const showPrint   = ['paid', 'completed'].includes(order.status)
  const showResend  = ['owner', 'admin'].includes(staffRole) && showPrint && !!order.customer
  const showCancel  = ['draft', 'awaiting_payment', 'in_production', 'ready'].includes(order.status)

  if (!showPrint && !showResend && !showCancel && msg?.id !== order.id) return null

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {msg?.id === order.id && (
        <span className={`text-xs ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</span>
      )}
      {showPrint && (
        <a href={`/print/receipt/${order.id}`} target="_blank" rel="noreferrer"
          className="text-xs font-medium text-ink-500 hover:text-pine transition-colors px-2.5 py-1.5 rounded-md border border-line hover:border-pine-200 hover:bg-pine-50">
          Cetak Struk
        </a>
      )}
      {showResend && (
        <button onClick={() => onResend(order.id)} disabled={resending === order.id}
          className="text-xs font-medium text-ink-500 hover:text-pine transition-colors px-2.5 py-1.5 rounded-md border border-line hover:border-pine-200 hover:bg-pine-50 disabled:opacity-40">
          {resending === order.id ? '…' : 'Resend WA'}
        </button>
      )}
      {showCancel && (
        <button onClick={() => onCancel(order.id)} disabled={cancelling === order.id}
          className="text-xs font-medium text-ink-500 hover:text-danger transition-colors px-2.5 py-1.5 rounded-md border border-line hover:border-danger-bd hover:bg-danger-bg disabled:opacity-40">
          {cancelling === order.id ? '…' : 'Batalkan'}
        </button>
      )}
    </div>
  )
}

// ── Mobile card ───────────────────────────────────────────────────────────────

function MobileOrderCard({ order, staffRole, cancelling, resending, msg, onCancel, onResend }: {
  order:      Order
  staffRole:  string
  cancelling: string | null
  resending:  string | null
  msg:        { id: string; text: string; ok: boolean } | null
  onCancel:   (id: string) => void
  onResend:   (id: string) => void
}) {
  const [open,    setOpen]    = useState(false)
  const [items,   setItems]   = useState<OrderItem[] | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchItems = useCallback(async () => {
    if (items !== null) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/v1/orders/${order.id}`)
      const json = await res.json()
      setItems(json.data?.items ?? [])
    } catch { setItems([]) }
    finally  { setLoading(false) }
  }, [order.id, items])

  function toggle() {
    if (!open) fetchItems()
    setOpen(o => !o)
  }

  const salesLabel = order.sales_staff?.nickname ?? order.sales_staff?.name ?? null

  return (
    <div className="border-b border-line last:border-0">
      {/* Main tap area */}
      <button
        onClick={toggle}
        className="w-full text-left px-4 py-4 hover:bg-sand-50 active:bg-sand-100 transition-colors"
      >
        {/* Row 1: queue + order number + status */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-mono text-ink-400 shrink-0">#{order.queue_number}</span>
            <span className="text-xs font-mono font-semibold text-ink-900 truncate">{order.order_number}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${STATUS_STYLE[order.status]}`}>
              {STATUS_LABEL[order.status]}
            </span>
            <span className={`text-ink-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round">
                <path d="M2 5l5 4 5-4"/>
              </svg>
            </span>
          </div>
        </div>

        {/* Row 2: customer + time */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-sm text-ink-700 truncate">
            {order.customer?.name ?? <span className="text-ink-300 italic text-xs">Tanpa nama</span>}
          </span>
          <span className="text-xs tabular-nums text-ink-400 shrink-0">{formatTime(order.created_at)}</span>
        </div>

        {/* Row 3: sales + total */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {salesLabel ? (
              <>
                <span className="text-[10px] text-ink-400">Sales</span>
                <span className="text-xs font-bold text-pine">{salesLabel}</span>
              </>
            ) : (
              <span className="text-[10px] text-ink-300">Tanpa PIC</span>
            )}
            {order.discount > 0 && (
              <span className="text-[10px] text-success ml-1">· Diskon {formatRp(order.discount)}</span>
            )}
          </div>
          <span className="text-sm font-bold tabular-nums text-ink-900">{formatRp(order.total)}</span>
        </div>
      </button>

      {/* Expanded: items + actions */}
      {open && (
        <div className="border-t border-line bg-sand-50/50">
          <ItemDetail
            items={items} discount={order.discount} total={order.total} loading={loading}
            showLabels={['paid', 'completed'].includes(order.status)}
          />
          <div className="px-4 py-3 border-t border-line" onClick={e => e.stopPropagation()}>
            <OrderActions
              order={order} staffRole={staffRole}
              cancelling={cancelling} resending={resending} msg={msg}
              onCancel={onCancel} onResend={onResend}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Desktop expandable row ────────────────────────────────────────────────────

function DesktopOrderRow({ order, staffRole, cancelling, resending, msg, onCancel, onResend }: {
  order:      Order
  staffRole:  string
  cancelling: string | null
  resending:  string | null
  msg:        { id: string; text: string; ok: boolean } | null
  onCancel:   (id: string) => void
  onResend:   (id: string) => void
}) {
  const [open,    setOpen]    = useState(false)
  const [items,   setItems]   = useState<OrderItem[] | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchItems = useCallback(async () => {
    if (items !== null) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/v1/orders/${order.id}`)
      const json = await res.json()
      setItems(json.data?.items ?? [])
    } catch { setItems([]) }
    finally  { setLoading(false) }
  }, [order.id, items])

  function toggle() {
    if (!open) fetchItems()
    setOpen(o => !o)
  }

  return (
    <>
      <tr
        className={`group cursor-pointer transition-colors ${open ? 'bg-sand-50' : 'hover:bg-sand-50/70'}`}
        onClick={toggle}
      >
        <td className="pl-4 pr-2 py-4 tabular-nums font-mono text-xs text-ink-400 w-10">
          #{order.queue_number}
        </td>
        <td className="px-3 py-4">
          <p className="font-semibold text-ink-900 font-mono text-xs">{order.order_number}</p>
          <p className="text-[11px] text-ink-400 mt-0.5 tabular-nums">{formatTime(order.created_at)}</p>
        </td>
        <td className="px-3 py-4 text-sm text-ink-700">
          <p>{order.customer?.name ?? <span className="text-ink-300">—</span>}</p>
          {order.customer?.phone && <p className="text-xs text-ink-400 mt-0.5">{order.customer.phone}</p>}
        </td>
        <td className="px-3 py-4">
          {order.sales_staff ? (
            <div>
              <span className="text-xs font-bold text-pine">
                {order.sales_staff.nickname ?? order.sales_staff.name}
              </span>
              {order.sales_staff.nickname && (
                <p className="text-[10px] text-ink-400 mt-0.5 truncate max-w-[120px]">{order.sales_staff.name}</p>
              )}
            </div>
          ) : (
            <span className="text-ink-300 text-xs">—</span>
          )}
        </td>
        <td className="px-3 py-4 text-right">
          <p className="tabular-nums font-bold text-ink-900 text-sm">{formatRp(order.total)}</p>
          {order.discount > 0 && (
            <p className="text-[11px] tabular-nums text-success mt-0.5">-{formatRp(order.discount)}</p>
          )}
        </td>
        <td className="px-3 py-4 text-center">
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${STATUS_STYLE[order.status]}`}>
            {STATUS_LABEL[order.status]}
          </span>
        </td>
        {/* Expand indicator — klik ditangani oleh <tr> */}
        <td className="pr-4 pl-2 py-4 w-12 text-right">
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-line text-ink-400 group-hover:text-pine group-hover:border-pine-200 group-hover:bg-pine-50 transition-colors"
          >
            <ChevronIcon open={open} />
          </span>
        </td>
      </tr>

      {/* Expanded detail */}
      {open && (
        <tr className="bg-sand-50/60">
          <td colSpan={7} className="px-4 pb-4 pt-0">
            <div className="border border-line rounded-xl overflow-hidden mt-2 bg-white">
              <ItemDetail
                items={items} discount={order.discount} total={order.total} loading={loading}
                showLabels={['paid', 'completed'].includes(order.status)}
              />
            </div>
            <div className="mt-3 flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <OrderActions
                order={order} staffRole={staffRole}
                cancelling={cancelling} resending={resending} msg={msg}
                onCancel={onCancel} onResend={onResend}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function OrderHistoryClient({
  staffRole, branchId, branches, orders, selectedDate, statusFilter, summary,
}: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [resending,  setResending]  = useState<string | null>(null)
  const [msg,        setMsg]        = useState<{ id: string; text: string; ok: boolean } | null>(null)

  const inputCls = 'h-9 rounded-md border border-line-strong px-3 text-sm text-ink-900 bg-white focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100'

  function pushFilter(updates: Record<string, string>) {
    const sp = new URLSearchParams()
    sp.set('branch', branchId)
    sp.set('date', selectedDate)
    if (statusFilter) sp.set('status', statusFilter)
    Object.entries(updates).forEach(([k, v]) => v ? sp.set(k, v) : sp.delete(k))
    router.push(`${pathname}?${sp.toString()}`)
  }

  async function handleCancel(orderId: string) {
    if (!confirm('Batalkan order ini?')) return
    setCancelling(orderId)
    const res  = await fetch(`/api/v1/orders/${orderId}/cancel`, { method: 'POST' })
    const json = await res.json()
    setCancelling(null)
    setMsg({ id: orderId, text: res.ok ? 'Order dibatalkan.' : json.error?.message ?? 'Gagal.', ok: res.ok })
    if (res.ok) router.refresh()
  }

  async function handleResendInvoice(orderId: string) {
    setResending(orderId)
    const res  = await fetch(`/api/v1/orders/${orderId}/resend-invoice`, { method: 'POST' })
    const json = await res.json()
    setResending(null)
    setMsg({ id: orderId, text: res.ok ? 'Invoice WA diantrikan ulang.' : json.error?.message ?? 'Gagal.', ok: res.ok })
  }

  const sharedProps = { staffRole, cancelling, resending, msg, onCancel: handleCancel, onResend: handleResendInvoice }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-[28px] text-pine">Riwayat Transaksi</h1>
          <p className="text-sm text-ink-400 mt-0.5">
            {summary.totalOrders} order lunas · {formatRp(summary.revenue)} pendapatan
          </p>
        </div>
        <Link href="/pos"
          className="h-9 px-4 rounded-md bg-pine text-white text-sm font-medium flex items-center hover:bg-pine-700 transition-colors">
          + Transaksi Baru
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {branches.length > 0 && (
          <select className={inputCls} value={branchId} onChange={e => pushFilter({ branch: e.target.value })}>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <input type="date" className={inputCls} value={selectedDate}
          onChange={e => pushFilter({ date: e.target.value })} />
        <select className={inputCls} value={statusFilter} onChange={e => pushFilter({ status: e.target.value })}>
          <option value="">Semua status</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* ── Mobile: card list ────────────────────────────────────────────── */}
      <div className="md:hidden bg-white border border-line rounded-xl shadow-sm overflow-hidden">
        {orders.length === 0 ? (
          <div className="py-16 text-center text-sm text-ink-400">
            Tidak ada transaksi pada tanggal ini.
          </div>
        ) : (
          <>
            {orders.map(order => (
              <MobileOrderCard key={order.id} order={order} {...sharedProps} />
            ))}
            <div className="px-4 py-3 border-t border-line bg-sand-50 flex justify-between text-xs text-ink-500">
              <span>{orders.length} transaksi</span>
              <span className="font-semibold text-ink-900 tabular-nums">Lunas: {formatRp(summary.revenue)}</span>
            </div>
          </>
        )}
      </div>

      {/* ── Desktop: table ───────────────────────────────────────────────── */}
      <div className="hidden md:block bg-white border border-line rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-sand-50 border-b border-line text-xs uppercase tracking-wider text-ink-500 text-left">
              <th className="pl-4 pr-2 py-3 font-medium w-10">No.</th>
              <th className="px-3 py-3 font-medium">Order</th>
              <th className="px-3 py-3 font-medium">Pelanggan</th>
              <th className="px-3 py-3 font-medium">Sales/PIC</th>
              <th className="px-3 py-3 font-medium text-right">Total</th>
              <th className="px-3 py-3 font-medium text-center">Status</th>
              <th className="pr-4 pl-2 py-3 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-14 text-center text-sm text-ink-400">
                  Tidak ada transaksi pada tanggal ini.
                </td>
              </tr>
            )}
            {orders.map(order => (
              <DesktopOrderRow key={order.id} order={order} {...sharedProps} />
            ))}
          </tbody>
        </table>

        {orders.length > 0 && (
          <div className="px-4 py-3 border-t border-line bg-sand-50 flex justify-between text-sm">
            <span className="text-ink-500">{orders.length} transaksi ditampilkan</span>
            <span className="font-semibold text-ink-900 tabular-nums">
              Total lunas: {formatRp(summary.revenue)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
