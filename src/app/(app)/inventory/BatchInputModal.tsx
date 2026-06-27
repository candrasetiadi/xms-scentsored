'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'

interface Props {
  open:         boolean
  onClose:      () => void
  branchId:     string
  rawMaterials: { id: string; name: string; unit: string }[]
  onSuccess:    () => void
}

interface FormState {
  raw_material_id: string
  qty_received:    string
  unit_cost:       string
  received_at:     string
  notes:           string
}

export function BatchInputModal({ open, onClose, branchId, rawMaterials, onSuccess }: Props) {
  const [form, setForm]   = useState<FormState>({
    raw_material_id: rawMaterials[0]?.id ?? '',
    qty_received: '', unit_cost: '',
    received_at: new Date().toISOString().slice(0, 10),
    notes: '',
  })
  const [error, setError]   = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const selectedUnit = rawMaterials.find(m => m.id === form.raw_material_id)?.unit ?? ''

  async function handleSubmit() {
    if (!form.raw_material_id) { setError('Pilih bahan baku.'); return }
    const qty = parseFloat(form.qty_received)
    const cost = parseFloat(form.unit_cost)
    if (!qty || qty <= 0)        { setError('Qty harus > 0.'); return }
    if (isNaN(cost) || cost < 0) { setError('Harga satuan tidak valid.'); return }

    setSaving(true); setError(null)

    const res = await fetch('/api/v1/inventory/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id:       branchId,
        raw_material_id: form.raw_material_id,
        qty_received:    qty,
        unit_cost:       cost,
        received_at:     new Date(form.received_at).toISOString(),
        notes:           form.notes || 'Input manual',
      }),
    })

    const json = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(json.error?.message ?? 'Gagal menyimpan batch.')
      return
    }

    // Reset form
    setForm(f => ({ ...f, qty_received: '', unit_cost: '', notes: '' }))
    onSuccess()
  }

  const inputCls = "h-10 rounded-md border border-line-strong px-3 text-sm text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100"

  return (
    <Modal open={open} onClose={onClose} title="Input Batch Bahan Baku">
      <div className="flex flex-col gap-4">
        <p className="text-xs text-ink-400 -mt-1">
          Digunakan untuk memasukkan stok awal atau penerimaan bahan baku tanpa PO.
          Setiap batch dicatat terpisah untuk kalkulasi FIFO.
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink-700">Bahan Baku *</label>
          <select className={inputCls} value={form.raw_material_id}
            onChange={e => setForm(f => ({ ...f, raw_material_id: e.target.value }))}>
            {rawMaterials.map(m => (
              <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-700">
              Qty Diterima * {selectedUnit && <span className="text-ink-400 font-normal">({selectedUnit})</span>}
            </label>
            <input className={inputCls} type="number" min={0} step="0.001"
              placeholder="mis. 1000" value={form.qty_received}
              onChange={e => setForm(f => ({ ...f, qty_received: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-700">
              Harga Satuan (Rp) *
            </label>
            <input className={inputCls} type="number" min={0} step="1"
              placeholder="mis. 15000" value={form.unit_cost}
              onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink-700">Tanggal Terima</label>
          <input className={inputCls} type="date" value={form.received_at}
            onChange={e => setForm(f => ({ ...f, received_at: e.target.value }))} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink-700">Keterangan</label>
          <input className={inputCls} placeholder="Opsional, mis. Stok awal, supplier X..."
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>

        {/* Preview FIFO info */}
        {form.qty_received && form.unit_cost && (
          <div className="bg-info-bg border border-info-bd rounded-md px-3 py-2.5 text-sm">
            <p className="text-pine font-medium">Ringkasan batch</p>
            <p className="text-ink-700 text-xs mt-1">
              {parseFloat(form.qty_received).toLocaleString('id-ID', { maximumFractionDigits: 3 })} {selectedUnit}
              {' '}× Rp {parseFloat(form.unit_cost).toLocaleString('id-ID')}
              {' '}= <strong>Rp {(parseFloat(form.qty_received) * parseFloat(form.unit_cost)).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</strong>
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-danger bg-danger-bg border border-danger-bd rounded-md px-3 py-2">{error}</p>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 h-10 rounded-md border border-line-strong text-sm font-medium text-ink-700 hover:bg-sand-50">
            Batal
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 h-10 rounded-md bg-rust text-white text-sm font-medium hover:bg-rust-600 disabled:opacity-45 transition-colors">
            {saving ? 'Menyimpan…' : 'Simpan Batch'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
