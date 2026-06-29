'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProductionStatus = 'antri' | 'diracik' | 'packing' | 'selesai' | 'diambil'

export interface ProductionOrder {
  id: string
  order_id: string
  order_number: string
  queue_number: number
  product_name: string
  product_sku: string
  status: ProductionStatus
  notes: string | null
  assigned_to: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

interface Props {
  staffId: string
  staffRole: string
  initialBranchId: string
  branches: { id: string; name: string }[]
}

// ── Column config ─────────────────────────────────────────────────────────────

interface ColumnConfig {
  status: ProductionStatus
  label: string
  headerCls: string
  advanceLabel: string | null
  advanceCls: string | null
  nextStatus: ProductionStatus | null
}

const COLUMNS: ColumnConfig[] = [
  {
    status: 'antri',
    label: 'Antri',
    headerCls: 'bg-sand-100 text-ink-700 border-b border-sand-200',
    advanceLabel: 'Mulai Racik →',
    advanceCls: 'bg-rust text-white hover:bg-rust-600',
    nextStatus: 'diracik',
  },
  {
    status: 'diracik',
    label: 'Diracik',
    headerCls: 'bg-rust-50 text-rust border-b border-rust-100',
    advanceLabel: 'Selesai Racik, Ke Packing →',
    advanceCls: 'bg-warning text-ink-900 hover:opacity-90',
    nextStatus: 'packing',
  },
  {
    status: 'packing',
    label: 'Packing',
    headerCls: 'bg-warning-bg text-warning border-b border-warning-bd',
    advanceLabel: 'Selesai Packing ✓',
    advanceCls: 'bg-pine text-white hover:bg-pine-700',
    nextStatus: 'selesai',
  },
  {
    status: 'selesai',
    label: 'Selesai',
    headerCls: 'bg-pine-50 text-pine border-b border-pine-100',
    advanceLabel: 'Sudah Diambil ✓',
    advanceCls: 'bg-pine-100 text-pine-800 border border-pine-200 hover:bg-pine-200',
    nextStatus: 'diambil',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-white border border-line rounded-lg p-3 shadow-sm animate-pulse space-y-2">
      <div className="flex justify-between items-center">
        <div className="h-8 w-10 bg-sand-200 rounded" />
        <div className="h-3 w-20 bg-sand-200 rounded" />
      </div>
      <div className="h-3 w-3/4 bg-sand-200 rounded" />
      <div className="h-3 w-1/2 bg-sand-100 rounded" />
      <div className="h-8 w-full bg-sand-100 rounded mt-1" />
    </div>
  )
}

// ── Production Card ───────────────────────────────────────────────────────────

interface CardProps {
  order: ProductionOrder
  column: ColumnConfig
  onAdvance: (id: string, nextStatus: ProductionStatus) => Promise<void>
  advancing: string | null
  error: string | null
  warning: string | null
}

function ProductionCard({ order, column, onAdvance, advancing, error, warning }: CardProps) {
  const isAdvancing = advancing === order.id

  return (
    <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
      <div className="p-3 space-y-1.5">
        {/* Row 1: queue number + order number */}
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-2xl text-pine leading-none">
            #{order.queue_number}
          </span>
          <span className="font-mono text-[10px] text-ink-400 shrink-0">
            {order.order_number}
          </span>
        </div>

        {/* Row 2: product name */}
        <p className="text-sm font-semibold text-ink-900 leading-snug">
          {order.product_name}
        </p>

        {/* Row 3: notes */}
        {order.notes && (
          <p className="text-xs text-rust italic leading-snug">
            &#10022; {order.notes}
          </p>
        )}

        {/* Footer: time */}
        <p className="text-[10px] text-ink-400 pt-0.5">
          Masuk {formatTime(order.created_at)}
        </p>

        {/* Error inline */}
        {error && advancing === null && (
          <p className="text-[10px] text-danger bg-danger-bg border border-danger-bd rounded px-2 py-1">
            {error}
          </p>
        )}

        {/* Warning stok kurang (tidak memblokir) */}
        {warning && !error && (
          <p className="text-[10px] text-warning bg-warning-bg border border-warning-bd rounded px-2 py-1">
            ⚠ {warning}
          </p>
        )}
      </div>

      {/* Advance button */}
      {column.nextStatus && column.advanceLabel && column.advanceCls ? (
        <button
          onClick={() => onAdvance(order.id, column.nextStatus!)}
          disabled={isAdvancing}
          className={[
            'w-full px-3 py-2 text-xs font-medium transition-opacity border-t border-line',
            column.advanceCls,
            isAdvancing ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        >
          {isAdvancing ? 'Memproses…' : column.advanceLabel}
        </button>
      ) : (
        <div className="px-3 py-2 border-t border-line bg-pine-50">
          <span className="text-[10px] text-pine font-medium">Selesai ✓</span>
        </div>
      )}
    </div>
  )
}

// ── Main KanbanClient ─────────────────────────────────────────────────────────

export function KanbanClient({ staffId: _staffId, staffRole, initialBranchId, branches }: Props) {
  const [branchId, setBranchId]   = useState(initialBranchId)
  const [orders,   setOrders]     = useState<ProductionOrder[]>([])
  const [loading,  setLoading]    = useState(true)
  const [fetchErr, setFetchErr]   = useState<string | null>(null)
  const [advancing, setAdvancing] = useState<string | null>(null)
  const [advErr,   setAdvErr]     = useState<Record<string, string>>({})
  const [advWarn,  setAdvWarn]    = useState<Record<string, string>>({})

  // ── Fetch orders ────────────────────────────────────────────────────────────

  const fetchOrders = useCallback(async (bid: string) => {
    try {
      const res  = await fetch(`/api/v1/production-orders?branch_id=${bid}`)
      const json = await res.json()
      if (!res.ok) {
        setFetchErr(json.error?.message ?? 'Gagal memuat data produksi.')
        return
      }
      setOrders(json.data ?? [])
      setFetchErr(null)
    } catch {
      setFetchErr('Koneksi gagal. Coba muat ulang.')
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Initial load ────────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true)
    fetchOrders(branchId)
  }, [branchId, fetchOrders])

  // ── Realtime subscription ───────────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`kanban-production-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_orders',
          filter: `branch_id=eq.${branchId}`,
        },
        () => {
          fetchOrders(branchId)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [branchId, fetchOrders])

  // ── Advance order status ────────────────────────────────────────────────────

  async function handleAdvance(id: string, nextStatus: ProductionStatus) {
    setAdvancing(id)
    setAdvErr(prev =>  { const n = { ...prev }; delete n[id]; return n })
    setAdvWarn(prev => { const n = { ...prev }; delete n[id]; return n })

    try {
      const res  = await fetch(`/api/v1/production-orders/${id}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const json = await res.json()
      if (!res.ok) {
        setAdvErr(prev => ({ ...prev, [id]: json.error?.message ?? 'Gagal memperbarui status.' }))
        return
      }
      // Tampilkan warning stok kurang (tidak memblokir)
      const warnings: { raw_material_id: string; unfulfilled_qty: number }[] = json.data?.warnings ?? []
      if (warnings.length > 0) {
        setAdvWarn(prev => ({ ...prev, [id]: `Stok bahan baku kurang untuk ${warnings.length} bahan. Harap cek inventory.` }))
      }
      setOrders(prev =>
        prev.map(o => o.id === id ? { ...o, status: nextStatus, completed_at: json.data?.completed_at ?? o.completed_at } : o)
      )
    } catch {
      setAdvErr(prev => ({ ...prev, [id]: 'Koneksi gagal.' }))
    } finally {
      setAdvancing(null)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const canSwitchBranch = staffRole === 'owner' || staffRole === 'admin'

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Toolbar */}
      <div className="bg-white border-b border-line px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <h1 className="font-display text-lg text-pine leading-none">Produksi</h1>

        {canSwitchBranch && branches.length > 0 && (
          <select
            value={branchId}
            onChange={e => {
              setBranchId(e.target.value)
              setLoading(true)
            }}
            className="h-8 rounded-md border border-line-strong px-2.5 text-sm text-ink-900 bg-white focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { setLoading(true); fetchOrders(branchId) }}
            className="h-8 px-3 rounded-md border border-line text-xs text-ink-500 hover:bg-sand-100 transition-colors"
          >
            Muat Ulang
          </button>
        </div>
      </div>

      {/* Error banner */}
      {fetchErr && (
        <div className="mx-4 mt-3 text-sm text-danger bg-danger-bg border border-danger-bd rounded-md px-3 py-2">
          {fetchErr}
        </div>
      )}

      {/* Kanban columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 p-4 h-full min-w-max">
          {COLUMNS.map(col => {
            const colOrders = orders.filter(o => o.status === col.status)

            return (
              <div
                key={col.status}
                className="flex flex-col w-72 shrink-0 rounded-xl border border-line bg-sand-50 overflow-hidden h-full"
              >
                {/* Column header */}
                <div className={`px-3 py-2.5 flex items-center justify-between ${col.headerCls}`}>
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span className="text-xs font-medium tabular-nums opacity-70">
                    {loading ? '-' : colOrders.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {loading ? (
                    <>
                      <CardSkeleton />
                      <CardSkeleton />
                      <CardSkeleton />
                    </>
                  ) : colOrders.length === 0 ? (
                    <div className="py-10 text-center text-ink-400 text-xs">
                      Tidak ada item
                    </div>
                  ) : (
                    colOrders.map(order => (
                      <ProductionCard
                        key={order.id}
                        order={order}
                        column={col}
                        onAdvance={handleAdvance}
                        advancing={advancing}
                        error={advErr[order.id] ?? null}
                        warning={advWarn[order.id] ?? null}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
