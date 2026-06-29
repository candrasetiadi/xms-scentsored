'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/Modal'

interface Product       { id: string; name: string; type: string }
interface RawMaterial   { id: string; name: string; unit: string }
interface Recipe        { id: string; product_id: string; raw_material_id: string; qty_per_unit: number }

interface Props {
  products: Product[]
  rawMaterials: RawMaterial[]
  recipes: Recipe[]
}

export function RecipesClient({ products, rawMaterials, recipes }: Props) {
  const router = useRouter()
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id ?? '')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm]           = useState({ raw_material_id: '', qty_per_unit: '' })
  const [error, setError]         = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)

  const productRecipes = recipes.filter(r => r.product_id === selectedProductId)

  function getRawMaterial(id: string) { return rawMaterials.find(m => m.id === id) }

  function openAdd() {
    setForm({ raw_material_id: rawMaterials[0]?.id ?? '', qty_per_unit: '' })
    setError(null); setModalOpen(true)
  }

  async function handleAdd() {
    if (!form.raw_material_id || !form.qty_per_unit || Number(form.qty_per_unit) <= 0) {
      setError('Pilih bahan baku dan masukkan qty > 0.'); return
    }
    const duplicate = productRecipes.find(r => r.raw_material_id === form.raw_material_id)
    if (duplicate) { setError('Bahan baku ini sudah ada di resep.'); return }

    setSaving(true); setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.from('product_recipes').insert({
      product_id: selectedProductId,
      raw_material_id: form.raw_material_id,
      qty_per_unit: Number(form.qty_per_unit),
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setModalOpen(false); router.refresh()
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    await supabase.from('product_recipes').delete().eq('id', id)
    router.refresh()
  }

  const inputCls = "h-10 rounded-md border border-line-strong px-3 text-sm text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100"

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Pilih produk */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink-700">Produk (Custom Racik)</label>
          {products.length === 0
            ? <p className="text-sm text-ink-400">Belum ada produk custom racik. Tambahkan di halaman Produk terlebih dahulu.</p>
            : <select className={inputCls} value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
          }
        </div>

        {/* BOM untuk produk yang dipilih */}
        {selectedProductId && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-ink-700">
                Bahan Baku ({productRecipes.length} item)
              </h2>
              <button onClick={openAdd}
                className="h-8 px-3 rounded-md bg-pine text-white text-xs font-medium hover:bg-pine-700 transition-colors">
                + Tambah Bahan
              </button>
            </div>

            <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-sand-100 text-xs uppercase tracking-wider text-ink-500 text-left">
                    <th className="px-4 py-3 font-medium">Bahan Baku</th>
                    <th className="px-4 py-3 font-medium text-right tabular-nums">Qty / Unit</th>
                    <th className="px-4 py-3 font-medium">Satuan</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {productRecipes.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-ink-400 text-sm">
                      Belum ada bahan baku untuk produk ini.
                    </td></tr>
                  )}
                  {productRecipes.map(r => {
                    const mat = getRawMaterial(r.raw_material_id)
                    return (
                      <tr key={r.id} className="hover:bg-sand-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-ink-900">{mat?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-ink-700">{r.qty_per_unit}</td>
                        <td className="px-4 py-3 text-ink-500">{mat?.unit ?? '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleDelete(r.id)}
                            className="text-xs text-ink-400 hover:text-danger transition-colors font-medium">
                            Hapus
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Tambah Bahan Baku ke Resep">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-700">Bahan Baku *</label>
            <select className={inputCls} value={form.raw_material_id}
              onChange={e => setForm(f => ({ ...f, raw_material_id: e.target.value }))}>
              {rawMaterials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-700">Qty per Unit *</label>
            <input className={inputCls} type="number" min={0} step="0.001"
              placeholder="mis. 30 (ml per botol)" value={form.qty_per_unit}
              onChange={e => setForm(f => ({ ...f, qty_per_unit: e.target.value }))} />
          </div>
          {error && <p className="text-sm text-danger bg-danger-bg border border-danger-bd rounded-md px-3 py-2">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setModalOpen(false)}
              className="flex-1 h-10 rounded-md border border-line-strong text-sm font-medium text-ink-700 hover:bg-sand-50">Batal</button>
            <button onClick={handleAdd} disabled={saving}
              className="flex-1 h-10 rounded-md bg-pine text-white text-sm font-medium hover:bg-pine-700 disabled:opacity-45 transition-colors">
              {saving ? 'Menyimpan…' : 'Tambah'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
