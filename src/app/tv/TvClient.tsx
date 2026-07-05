'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type TvStatus = 'antri' | 'diracik' | 'packing' | 'selesai'

interface TvOrder {
  id: string
  queue_number: number
  product_name: string
  status: TvStatus
  branch_id: string
}

interface RawProductionRow {
  id: string
  status: string
  branch_id: string
  orders: { queue_number: number } | null
  products: { name: string } | null
}

interface Props {
  branchId: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatClock(date: Date) {
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ── Queue Badge ───────────────────────────────────────────────────────────────

interface BadgeProps {
  queueNumber: number
  status: TvStatus
}

function QueueBadge({ queueNumber, status }: BadgeProps) {
  const isWaiting    = status === 'antri'
  const isProcessing = status === 'diracik' || status === 'packing'
  const isDone       = status === 'selesai'

  const outerRingCls = isWaiting
    ? 'border-[3px] border-sand-400 bg-transparent'
    : isProcessing
      ? 'border-[3px] border-rust bg-rust/10'
      : 'border-[3px] border-pine-400 bg-pine-400/15'

  const textCls = isWaiting
    ? 'text-sand-200'
    : isDone
      ? 'text-pine-300'
      : 'text-[#f4b99a]'

  return (
    <div
      className={[
        'w-20 h-20 rounded-full flex items-center justify-center relative',
        outerRingCls,
      ].join(' ')}
    >
      {/* Double ring inner line */}
      <div
        className={[
          'absolute inset-1.5 rounded-full border',
          isWaiting ? 'border-sand-400/40' : isDone ? 'border-pine-400/40' : 'border-rust/30',
        ].join(' ')}
      />
      <span className={`font-display text-3xl leading-none relative z-10 ${textCls}`}>
        {queueNumber}
      </span>
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

interface SectionProps {
  label: string
  labelCls: string
  orders: TvOrder[]
  status: TvStatus
}

function TvSection({ label, labelCls, orders, status }: SectionProps) {
  return (
    <div className="flex flex-col gap-6 flex-1 min-w-0">
      <h2 className={`text-sm uppercase tracking-widest font-medium text-center ${labelCls}`}>
        {label}
      </h2>

      {orders.length === 0 ? (
        <div className="flex-1 flex items-start justify-center pt-4">
          <span className="text-sand-400/40 text-sm tracking-wide">—</span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 justify-center">
          {orders.map(order => (
            <div key={order.id} className="flex flex-col items-center gap-2">
              <QueueBadge queueNumber={order.queue_number} status={status} />
              <span className="text-sand-400/70 text-[10px] text-center max-w-[80px] leading-tight">
                {order.product_name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main TvClient ─────────────────────────────────────────────────────────────

export function TvClient({ branchId }: Props) {
  const [orders,  setOrders]  = useState<TvOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [clock,   setClock]   = useState(() => formatClock(new Date()))
  const [branchName, setBranchName] = useState<string | null>(null)

  // ── Clock ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const id = setInterval(() => setClock(formatClock(new Date())), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Fetch orders from Supabase directly (anon, no auth) ──────────────────────

  const fetchOrders = useCallback(async () => {
    if (!branchId) return
    const supabase = createClient()

    const { data, error } = await supabase
      .from('production_orders')
      .select('id, status, branch_id, orders(queue_number), products(name)')
      .eq('branch_id', branchId)
      .in('status', ['antri', 'diracik', 'packing', 'selesai'])
      .order('created_at', { ascending: true })

    if (!error && data) {
      const mapped: TvOrder[] = (data as RawProductionRow[])
        .filter(r => r.orders !== null)
        .map(r => ({
          id:           r.id,
          status:       r.status as TvStatus,
          branch_id:    r.branch_id,
          queue_number: r.orders!.queue_number,
          product_name: r.products?.name ?? '—',
        }))
        .sort((a, b) => a.queue_number - b.queue_number)
      setOrders(mapped)
    }
    setLoading(false)
  }, [branchId])

  // ── Fetch branch name ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!branchId) return
    const supabase = createClient()
    supabase
      .from('branches')
      .select('name')
      .eq('id', branchId)
      .single()
      .then(({ data }) => {
        if (data) setBranchName(data.name)
      })
  }, [branchId])

  // ── Initial load + polling per menit ─────────────────────────────────────────

  useEffect(() => {
    fetchOrders()
    const id = setInterval(fetchOrders, 15_000)
    return () => clearInterval(id)
  }, [fetchOrders])

  // ── Realtime ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!branchId) return
    const supabase = createClient()
    const channel = supabase
      .channel('production-tv')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_orders',
          filter: `branch_id=eq.${branchId}`,
        },
        () => fetchOrders(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [branchId, fetchOrders])

  // ── Grouped orders ────────────────────────────────────────────────────────────

  const waiting    = orders.filter(o => o.status === 'antri')
  const processing = orders.filter(o => o.status === 'diracik' || o.status === 'packing')
  const done       = orders.filter(o => o.status === 'selesai')

  // ── No branch_id guard ────────────────────────────────────────────────────────

  if (!branchId) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: 'var(--color-pine-900, #021a12)' }}
      >
        <span className="font-display text-4xl text-sand-300 mb-4">Scentsored</span>
        <p className="text-sand-400 text-sm text-center px-8 leading-relaxed">
          Scan QR atau akses dengan{' '}
          <span className="font-mono bg-pine-800/50 px-1.5 py-0.5 rounded text-sand-300">
            ?branch_id=...
          </span>
        </p>
      </div>
    )
  }

  // ── TV Display ────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen flex flex-col select-none"
      style={{ background: 'var(--color-pine-900, #021a12)' }}
    >
      {/* Header */}
      <header className="flex flex-col items-center pt-10 pb-6 px-8 border-b border-pine-800/60">
        <span className="font-display text-5xl text-sand-100 leading-none tracking-wide">
          Scentsored
        </span>
        {branchName && (
          <span className="mt-2 text-sand-400 text-sm uppercase tracking-widest">
            {branchName}
          </span>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col sm:flex-row gap-0 sm:divide-x sm:divide-pine-800/60 px-0 py-8 overflow-hidden">

        {/* Menunggu */}
        <div className="flex-1 px-8 sm:px-10 py-2">
          <TvSection
            label="Menunggu"
            labelCls="text-sand-400"
            orders={waiting}
            status="antri"
          />
        </div>

        {/* Divider mobile */}
        <div className="sm:hidden mx-8 border-t border-pine-800/60 my-4" />

        {/* Sedang Diproses */}
        <div className="flex-1 px-8 sm:px-10 py-2">
          <TvSection
            label="Sedang Diproses"
            labelCls="text-[#f4b99a]"
            orders={processing}
            status="diracik"
          />
        </div>

        {/* Divider mobile */}
        <div className="sm:hidden mx-8 border-t border-pine-800/60 my-4" />

        {/* Siap Diambil */}
        <div className="flex-1 px-8 sm:px-10 py-2">
          <TvSection
            label="✦ Siap Diambil"
            labelCls="text-pine-300"
            orders={done}
            status="selesai"
          />
        </div>
      </main>

      {/* Footer clock */}
      <footer className="py-4 px-8 flex justify-end">
        <span className="font-mono text-sm text-sand-500 tabular-nums">
          {loading ? '--:--:--' : clock}
        </span>
      </footer>
    </div>
  )
}
