'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

type OrderStatus = 'draft' | 'awaiting_payment' | 'paid' | 'in_production' | 'ready' | 'completed' | 'cancelled'

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

const STATUS_LABEL: Record<OrderStatus, string> = {
  draft:           'Draft',
  awaiting_payment:'Menunggu Bayar',
  paid:            'Lunas',
  in_production:   'Produksi',
  ready:           'Siap',
  completed:       'Selesai',
  cancelled:       'Dibatalkan',
}

const STATUS_STYLE: Record<OrderStatus, string> = {
  draft:           'bg-sand-100 text-ink-500 border-line',
  awaiting_payment:'bg-warning-bg text-warning border-warning-bd',
  paid:            'bg-success-bg text-success border-success-bd',
  in_production:   'bg-pine-50 text-pine border-pine-100',
  ready:           'bg-info-bg text-info border-info-bd',
  completed:       'bg-success-bg text-success border-success-bd',
  cancelled:       'bg-danger-bg text-danger border-danger-bd',
}

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
}

export function OrderHistoryClient({
  staffRole, branchId, branches, orders, selectedDate, statusFilter, summary,
}: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [resending,  setResending]  = useState<string | null>(null)
  const [msg,        setMsg]        = useState<{ id: string; text: string; ok: boolean } | null>(null)

  const inputCls = 'h-9 rounded-md border border-line-strong px-3 text-sm text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100'

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

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
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

      {/* Table */}
      <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sand-100 text-xs uppercase tracking-wider text-ink-500 text-left">
                <th className="px-4 py-3 font-medium">No.</th>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Pelanggan</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-center">Status</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Waktu</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-ink-400">
                    Tidak ada transaksi pada tanggal ini.
                  </td>
                </tr>
              )}
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-sand-50 transition-colors">
                  <td className="px-4 py-3 tabular-nums font-mono text-xs text-ink-500">
                    #{order.queue_number}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink-900 font-mono text-xs">{order.order_number}</p>
                    {order.discount > 0 && (
                      <p className="text-xs text-success mt-0.5">Diskon {formatRp(order.discount)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-ink-700">
                    {order.customer?.name ?? <span className="text-ink-300">—</span>}
                    {order.customer?.phone && (
                      <p className="text-xs text-ink-400">{order.customer.phone}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-ink-900">
                    {formatRp(order.total)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_STYLE[order.status]}`}>
                      {STATUS_LABEL[order.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-ink-400 tabular-nums">
                    {formatTime(order.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      {msg?.id === order.id && (
                        <span className={`text-xs ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</span>
                      )}
                      {/* Cetak struk */}
                      {['paid', 'completed'].includes(order.status) && (
                        <a
                          href={`/print/receipt/${order.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-ink-400 hover:text-pine"
                          title="Cetak struk"
                        >
                          Cetak
                        </a>
                      )}
                      {/* Resend WA invoice (admin/owner + order paid + ada customer) */}
                      {['owner', 'admin'].includes(staffRole) && ['paid', 'completed'].includes(order.status) && order.customer && (
                        <button
                          onClick={() => handleResendInvoice(order.id)}
                          disabled={resending === order.id}
                          className="text-xs text-ink-400 hover:text-pine disabled:opacity-40"
                          title="Kirim ulang invoice WA"
                        >
                          {resending === order.id ? '…' : 'Resend WA'}
                        </button>
                      )}
                      {/* Cancel (draft/awaiting_payment = semua; paid = owner/admin saja) */}
                      {order.status !== 'cancelled' && order.status !== 'completed' && (
                        (['draft', 'awaiting_payment'].includes(order.status) ||
                          ['owner', 'admin'].includes(staffRole)) && (
                          <button
                            onClick={() => handleCancel(order.id)}
                            disabled={cancelling === order.id}
                            className="text-xs text-ink-400 hover:text-danger disabled:opacity-40"
                          >
                            {cancelling === order.id ? '…' : 'Batal'}
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {orders.length > 0 && (
          <div className="px-4 py-2.5 border-t border-line bg-sand-50 flex justify-between text-sm">
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
