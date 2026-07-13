'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Item {
  name:       string
  qty:        string
  unit_price: string
  note:       string
}

const emptyItem = (): Item => ({ name: '', qty: '1', unit_price: '', note: '' })

function formatRp(val: string) {
  const n = parseFloat(val.replace(/\D/g, ''))
  if (isNaN(n)) return ''
  return n.toLocaleString('id-ID')
}

export function ExpenditureFormClient() {
  const router = useRouter()

  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [items,       setItems]       = useState<Item[]>([emptyItem()])
  const [saving,      setSaving]      = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const inputCls = 'w-full h-10 rounded-lg border border-line-strong px-3 text-sm text-ink-900 bg-white focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100'

  function updateItem(idx: number, field: keyof Item, val: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it))
  }

  function addItem() { setItems(prev => [...prev, emptyItem()]) }
  function removeItem(idx: number) {
    if (items.length === 1) return
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const total = items.reduce((sum, it) => {
    const q = parseFloat(it.qty) || 0
    const p = parseFloat(it.unit_price.replace(/\D/g, '')) || 0
    return sum + q * p
  }, 0)

  function buildPayload() {
    return {
      title:       title.trim(),
      description: description.trim() || null,
      items: items.map(it => ({
        name:       it.name.trim(),
        qty:        parseFloat(it.qty) || 1,
        unit_price: parseFloat(it.unit_price.replace(/\D/g, '')) || 0,
        note:       it.note.trim() || undefined,
      })),
    }
  }

  function validate() {
    if (!title.trim()) return 'Judul wajib diisi.'
    for (const it of items) {
      if (!it.name.trim()) return 'Nama item wajib diisi.'
      if (!it.qty || parseFloat(it.qty) <= 0) return 'Qty harus lebih dari 0.'
      if (!it.unit_price || parseFloat(it.unit_price.replace(/\D/g, '')) < 0) return 'Harga tidak valid.'
    }
    return null
  }

  async function handleSaveDraft() {
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true); setError(null)
    try {
      const res  = await fetch('/api/v1/expenditure-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error?.message ?? 'Gagal menyimpan.'); return }
      router.push('/expenditure-requests')
    } catch { setError('Koneksi gagal.') }
    finally { setSaving(false) }
  }

  async function handleSubmit() {
    const err = validate()
    if (err) { setError(err); return }
    setSubmitting(true); setError(null)
    try {
      // Buat dulu sebagai draft
      const res  = await fetch('/api/v1/expenditure-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error?.message ?? 'Gagal menyimpan.'); return }

      // Langsung submit
      const subRes  = await fetch(`/api/v1/expenditure-requests/${json.data.id}/submit`, { method: 'POST' })
      const subJson = await subRes.json()
      if (!subRes.ok) { setError(subJson.error?.message ?? 'Gagal mengajukan.'); return }

      router.push('/expenditure-requests')
    } catch { setError('Koneksi gagal.') }
    finally { setSubmitting(false) }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-ink-400 hover:text-ink-900 transition-colors"
        >
          ← Kembali
        </button>
        <h1 className="font-display text-xl text-ink-900">Buat Pengajuan</h1>
      </div>

      {error && (
        <div className="text-sm text-danger bg-danger-bg border border-danger-bd rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Info umum */}
      <div className="bg-white border border-line rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-ink-700">Informasi Pengajuan</h2>

        <div>
          <label className="text-xs font-medium text-ink-600 block mb-1.5">Judul *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Pembuatan Kaos Seragam Tim"
            className={inputCls}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-ink-600 block mb-1.5">Deskripsi / Keterangan</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Jelaskan kebutuhan dan tujuan pengajuan ini..."
            rows={3}
            className="w-full rounded-lg border border-line-strong px-3 py-2.5 text-sm text-ink-900 bg-white resize-none focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100"
          />
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white border border-line rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-700">Rincian Item</h2>
          <button
            onClick={addItem}
            className="text-xs text-pine hover:underline font-medium"
          >
            + Tambah Item
          </button>
        </div>

        <div className="space-y-4">
          {items.map((it, idx) => (
            <div key={idx} className="border border-line rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-500">Item {idx + 1}</span>
                {items.length > 1 && (
                  <button
                    onClick={() => removeItem(idx)}
                    className="text-xs text-danger hover:underline"
                  >
                    Hapus
                  </button>
                )}
              </div>

              <div>
                <label className="text-xs text-ink-500 block mb-1">Nama Item *</label>
                <input
                  type="text"
                  value={it.name}
                  onChange={e => updateItem(idx, 'name', e.target.value)}
                  placeholder="e.g. Kaos Polo Putih"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-500 block mb-1">Qty *</label>
                  <input
                    type="number"
                    value={it.qty}
                    onChange={e => updateItem(idx, 'qty', e.target.value)}
                    min="1"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs text-ink-500 block mb-1">Harga Satuan (Rp) *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={it.unit_price}
                    onChange={e => updateItem(idx, 'unit_price', e.target.value.replace(/\D/g, ''))}
                    onBlur={e => updateItem(idx, 'unit_price', formatRp(e.target.value))}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>
              </div>

              {(parseFloat(it.qty) > 0 && parseFloat(it.unit_price.replace(/\D/g, '')) > 0) && (
                <p className="text-xs text-ink-400 text-right">
                  Subtotal: <span className="font-semibold text-ink-700">
                    Rp {(parseFloat(it.qty) * parseFloat(it.unit_price.replace(/\D/g, ''))).toLocaleString('id-ID')}
                  </span>
                </p>
              )}

              <div>
                <label className="text-xs text-ink-500 block mb-1">Catatan</label>
                <input
                  type="text"
                  value={it.note}
                  onChange={e => updateItem(idx, 'note', e.target.value)}
                  placeholder="Spesifikasi tambahan (opsional)"
                  className={inputCls}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex justify-end pt-2 border-t border-line">
          <div className="text-right">
            <p className="text-xs text-ink-400">Total Estimasi</p>
            <p className="text-lg font-bold text-ink-900">Rp {total.toLocaleString('id-ID')}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSaveDraft}
          disabled={saving || submitting}
          className="flex-1 h-11 rounded-xl border border-line text-sm font-medium text-ink-700 hover:bg-sand-50 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Menyimpan...' : 'Simpan Draft'}
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || submitting}
          className="flex-1 h-11 rounded-xl bg-pine text-white text-sm font-semibold hover:bg-pine-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Mengajukan...' : 'Ajukan ke Owner'}
        </button>
      </div>
      <p className="text-xs text-ink-400 text-center">
        Draft bisa diedit sebelum diajukan. Setelah diajukan, request tidak bisa diubah.
      </p>
    </div>
  )
}
