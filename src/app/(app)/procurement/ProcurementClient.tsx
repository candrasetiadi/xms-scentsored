'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

type PoStatus = 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled'

interface PoItem {
  id: string
  qty_ordered: number
  qty_received: number
  unit_cost: number
  notes: string | null
  raw_materials: { id: string; name: string; unit: string }
}

interface PurchaseOrder {
  id: string
  po_number: string
  status: PoStatus
  total: number
  notes: string | null
  ordered_at: string | null
  received_at: string | null
  created_at: string
  suppliers: { id: string; name: string }
  purchase_order_items: PoItem[]
}

interface Props {
  staffId: string
  staffRole: string
  branchId: string
  branches: { id: string; name: string }[]
  suppliers: { id: string; name: string }[]
  rawMaterials: { id: string; name: string; unit: string }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<PoStatus, string> = {
  draft: 'Draft', ordered: 'Dipesan', partial: 'Sebagian Diterima',
  received: 'Diterima', cancelled: 'Dibatalkan',
}

const STATUS_CLS: Record<PoStatus, string> = {
  draft:    'bg-sand-100 text-ink-500',
  ordered:  'bg-pine-50 text-pine',
  partial:  'bg-warning-bg text-warning',
  received: 'bg-pine-100 text-pine-800',
  cancelled:'bg-danger-bg text-danger',
}

const _rp = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
function fmt(n: number) { return 'Rp ' + _rp.format(Math.round(n)) }

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Create PO Modal ───────────────────────────────────────────────────────────

interface CreatePoModalProps {
  suppliers: Props['suppliers']
  rawMaterials: Props['rawMaterials']
  onClose: () => void
  onCreated: () => void
  branchId: string
}

interface DraftItem { raw_material_id: string; qty_ordered: string; unit_cost: string; notes: string }

function CreatePoModal({ suppliers, rawMaterials, onClose, onCreated, branchId }: CreatePoModalProps) {
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes]           = useState('')
  const [items, setItems]           = useState<DraftItem[]>([
    { raw_material_id: '', qty_ordered: '', unit_cost: '', notes: '' },
  ])
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState<string | null>(null)

  function addItem() {
    setItems(prev => [...prev, { raw_material_id: '', qty_ordered: '', unit_cost: '', notes: '' }])
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function setItemField(idx: number, field: keyof DraftItem, val: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    const validItems = items.filter(i => i.raw_material_id && parseFloat(i.qty_ordered) > 0 && parseFloat(i.unit_cost) >= 0)
    if (!supplierId) { setErr('Pilih supplier.'); return }
    if (!validItems.length) { setErr('Tambahkan minimal satu item.'); return }

    setSaving(true)
    try {
      const res  = await fetch('/api/v1/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: branchId, supplier_id: supplierId, notes: notes || undefined,
          items: validItems.map(i => ({
            raw_material_id: i.raw_material_id,
            qty_ordered: parseFloat(i.qty_ordered),
            unit_cost: parseFloat(i.unit_cost),
            notes: i.notes || undefined,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) { setErr(json.error?.message ?? 'Gagal membuat PO.'); return }
      onCreated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink-900">Buat Purchase Order</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-900">✕</button>
        </div>

        <form id="create-po-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Supplier */}
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">Supplier *</label>
            <select
              value={supplierId}
              onChange={e => setSupplierId(e.target.value)}
              className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink-900 focus:outline-none focus:border-pine"
            >
              <option value="">Pilih supplier…</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">Catatan</label>
            <input
              type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Opsional"
              className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pine"
            />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-ink-700">Item Bahan Baku *</label>
              <button type="button" onClick={addItem} className="text-xs text-pine hover:underline">+ Tambah baris</button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => {
                const rm = rawMaterials.find(r => r.id === item.raw_material_id)
                return (
                  <div key={idx} className="grid grid-cols-[1fr_80px_100px_auto] gap-2 items-start">
                    <select
                      value={item.raw_material_id}
                      onChange={e => setItemField(idx, 'raw_material_id', e.target.value)}
                      className="border border-line rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-pine"
                    >
                      <option value="">Pilih bahan…</option>
                      {rawMaterials.map(r => <option key={r.id} value={r.id}>{r.name} ({r.unit})</option>)}
                    </select>
                    <input
                      type="number" min="0.01" step="0.01" placeholder={`Qty${rm ? ` (${rm.unit})` : ''}`}
                      value={item.qty_ordered}
                      onChange={e => setItemField(idx, 'qty_ordered', e.target.value)}
                      className="border border-line rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-pine"
                    />
                    <input
                      type="number" min="0" step="1" placeholder="Harga/unit"
                      value={item.unit_cost}
                      onChange={e => setItemField(idx, 'unit_cost', e.target.value)}
                      className="border border-line rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-pine"
                    />
                    <button
                      type="button" onClick={() => removeItem(idx)}
                      className="mt-1 text-ink-300 hover:text-danger text-lg leading-none"
                    >✕</button>
                  </div>
                )
              })}
            </div>
          </div>

          {err && <p className="text-sm text-danger bg-danger-bg border border-danger-bd rounded-lg px-3 py-2">{err}</p>}
        </form>

        <div className="px-6 py-4 border-t border-line flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-ink-600 border border-line rounded-lg hover:bg-sand-50">Batal</button>
          <button
            type="submit" form="create-po-form"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-pine text-white rounded-lg hover:bg-pine-700 disabled:opacity-50"
          >
            {saving ? 'Menyimpan…' : 'Buat PO'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Receive Modal ─────────────────────────────────────────────────────────────

interface ReceiveModalProps {
  po: PurchaseOrder
  onClose: () => void
  onReceived: () => void
}

function ReceiveModal({ po, onClose, onReceived }: ReceiveModalProps) {
  const pendingItems = po.purchase_order_items.filter(i => i.qty_received < i.qty_ordered)
  const [qtys, setQtys]       = useState<Record<string, string>>(
    Object.fromEntries(pendingItems.map(i => [i.id, String(i.qty_ordered - i.qty_received)]))
  )
  const [costs, setCosts]     = useState<Record<string, string>>(
    Object.fromEntries(pendingItems.map(i => [i.id, String(i.unit_cost)]))
  )
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    const items = pendingItems
      .filter(i => parseFloat(qtys[i.id] ?? '0') > 0)
      .map(i => ({ po_item_id: i.id, qty_received: parseFloat(qtys[i.id]), unit_cost: parseFloat(costs[i.id] ?? String(i.unit_cost)) }))

    if (!items.length) { setErr('Masukkan qty untuk minimal satu item.'); return }

    setSaving(true)
    try {
      const res  = await fetch(`/api/v1/purchase-orders/${po.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const json = await res.json()
      if (!res.ok) { setErr(json.error?.message ?? 'Gagal menerima barang.'); return }
      onReceived()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink-900">Terima Barang</h2>
            <p className="text-xs text-ink-400 mt-0.5">{po.po_number} · {po.suppliers.name}</p>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-900">✕</button>
        </div>

        <form id="receive-po-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4">
          {pendingItems.length === 0 ? (
            <p className="text-sm text-ink-500 text-center py-8">Semua item sudah diterima.</p>
          ) : (
            <div className="space-y-3">
              {pendingItems.map(item => (
                <div key={item.id} className="border border-line rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink-900">{item.raw_materials.name}</span>
                    <span className="text-xs text-ink-400">
                      Sisa: {item.qty_ordered - item.qty_received} {item.raw_materials.unit}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-ink-500 uppercase tracking-wide">Qty Diterima ({item.raw_materials.unit})</label>
                      <input
                        type="number" min="0" step="0.01"
                        max={item.qty_ordered - item.qty_received}
                        value={qtys[item.id] ?? ''}
                        onChange={e => setQtys(prev => ({ ...prev, [item.id]: e.target.value }))}
                        className="mt-0.5 w-full border border-line rounded px-2 py-1 text-sm focus:outline-none focus:border-pine"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-ink-500 uppercase tracking-wide">Harga/unit (Rp)</label>
                      <input
                        type="number" min="0" step="1"
                        value={costs[item.id] ?? ''}
                        onChange={e => setCosts(prev => ({ ...prev, [item.id]: e.target.value }))}
                        className="mt-0.5 w-full border border-line rounded px-2 py-1 text-sm focus:outline-none focus:border-pine"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {err && <p className="mt-3 text-sm text-danger bg-danger-bg border border-danger-bd rounded-lg px-3 py-2">{err}</p>}
        </form>

        <div className="px-6 py-4 border-t border-line flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-ink-600 border border-line rounded-lg hover:bg-sand-50">Batal</button>
          {pendingItems.length > 0 && (
            <button
              type="submit" form="receive-po-form" disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-pine text-white rounded-lg hover:bg-pine-700 disabled:opacity-50"
            >
              {saving ? 'Memproses…' : 'Konfirmasi Terima'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function ProcurementClient({ staffId: _staffId, staffRole, branchId: initBranchId, branches, suppliers, rawMaterials }: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [branchId, setBranchId]     = useState(initBranchId)
  const [orders, setOrders]         = useState<PurchaseOrder[]>([])
  const [loading, setLoading]       = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)
  const [receiving, setReceiving]   = useState<PurchaseOrder | null>(null)
  const [statusChanging, setStatusChanging] = useState<string | null>(null)

  const isManager = ['owner', 'admin'].includes(staffRole)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ branch_id: branchId, limit: '50' })
      if (statusFilter) params.set('status', statusFilter)
      const res  = await fetch(`/api/v1/purchase-orders?${params}`)
      const json = await res.json()
      setOrders(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [branchId, statusFilter])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  async function changeStatus(id: string, newStatus: string) {
    setStatusChanging(id)
    try {
      await fetch(`/api/v1/purchase-orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      fetchOrders()
    } finally {
      setStatusChanging(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[28px] text-pine">Procurement</h1>
          <p className="text-sm text-ink-400 mt-0.5">Purchase order bahan baku</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Branch selector */}
          {branches.length > 1 && (
            <select
              value={branchId}
              onChange={e => { setBranchId(e.target.value); router.replace(`/procurement?branch=${e.target.value}`) }}
              className="border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-pine"
            >
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-pine"
          >
            <option value="">Semua status</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {isManager && (
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-1.5 text-sm font-medium bg-pine text-white rounded-lg hover:bg-pine-700"
            >
              + Buat PO
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-line overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-ink-400 text-sm">Memuat…</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-ink-400 text-sm">Belum ada purchase order.</div>
        ) : (
          <div className="divide-y divide-line">
            {orders.map(po => {
              const totalOrdered  = po.purchase_order_items.reduce((s, i) => s + i.qty_ordered, 0)
              const totalReceived = po.purchase_order_items.reduce((s, i) => s + i.qty_received, 0)
              const canReceive    = ['ordered', 'partial'].includes(po.status)
              const canOrder      = po.status === 'draft' && isManager
              const canCancel     = ['draft', 'ordered'].includes(po.status) && isManager

              return (
                <div key={po.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    {/* Left */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-ink-900">{po.po_number}</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_CLS[po.status]}`}>
                          {STATUS_LABEL[po.status]}
                        </span>
                      </div>
                      <p className="text-sm text-ink-600">{po.suppliers.name}</p>
                      <p className="text-xs text-ink-400">
                        {po.purchase_order_items.length} item ·
                        Diterima {totalReceived}/{totalOrdered} unit ·
                        Total {fmt(po.total)}
                      </p>
                      <p className="text-[10px] text-ink-300">
                        Dibuat {fmtDate(po.created_at)}
                        {po.ordered_at ? ` · Dipesan ${fmtDate(po.ordered_at)}` : ''}
                        {po.received_at ? ` · Diterima ${fmtDate(po.received_at)}` : ''}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {canOrder && (
                        <button
                          onClick={() => changeStatus(po.id, 'ordered')}
                          disabled={statusChanging === po.id}
                          className="px-3 py-1.5 text-xs font-medium bg-pine text-white rounded-lg hover:bg-pine-700 disabled:opacity-50"
                        >
                          Konfirmasi Pesan
                        </button>
                      )}
                      {canReceive && (
                        <button
                          onClick={() => setReceiving(po)}
                          className="px-3 py-1.5 text-xs font-medium bg-pine-50 text-pine border border-pine-200 rounded-lg hover:bg-pine-100"
                        >
                          Terima Barang
                        </button>
                      )}
                      {canCancel && (
                        <button
                          onClick={() => changeStatus(po.id, 'cancelled')}
                          disabled={statusChanging === po.id}
                          className="px-3 py-1.5 text-xs text-ink-400 border border-line rounded-lg hover:text-danger hover:border-danger-bd"
                        >
                          Batalkan
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Item list (collapsed summary) */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {po.purchase_order_items.map(item => (
                      <div key={item.id} className="flex items-center gap-1.5 bg-sand-50 border border-line rounded-md px-2 py-1">
                        <span className="text-xs text-ink-700">{item.raw_materials.name}</span>
                        <span className="text-[10px] text-ink-400">
                          {item.qty_received}/{item.qty_ordered} {item.raw_materials.unit}
                        </span>
                        {item.qty_received >= item.qty_ordered && (
                          <span className="text-[10px] text-pine">✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreatePoModal
          suppliers={suppliers}
          rawMaterials={rawMaterials}
          branchId={branchId}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchOrders() }}
        />
      )}
      {receiving && (
        <ReceiveModal
          po={receiving}
          onClose={() => setReceiving(null)}
          onReceived={() => { setReceiving(null); fetchOrders() }}
        />
      )}
    </div>
  )
}
