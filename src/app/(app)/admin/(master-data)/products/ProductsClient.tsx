'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/Modal'
import type { Tables } from '@/types/database'

type Product = Tables<'products'>

const EMPTY: Omit<Product, 'id' | 'created_at'> = {
  sku: '', name: '', category: '', type: 'ready_stock', price: 0, image_url: null, active: true,
}

const _rp = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
function formatRupiah(n: number) { return 'Rp ' + _rp.format(Math.round(n)) }

export function ProductsClient({ initialData }: { initialData: Product[] }) {
  const router = useRouter()
  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState<Product | null>(null)
  const [form, setForm]             = useState(EMPTY)
  const [error, setError]           = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const [search, setSearch]         = useState('')

  const filtered = initialData.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  )

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setError(null)
    setModalOpen(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({ sku: p.sku, name: p.name, category: p.category ?? '', type: p.type, price: p.price, image_url: p.image_url ?? null, active: p.active })
    setError(null)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.sku.trim() || !form.name.trim()) { setError('SKU dan nama wajib diisi.'); return }
    setSaving(true); setError(null)
    const supabase = createClient()
    const payload = { ...form, category: form.category || null, price: Number(form.price) }

    const { error: err } = editing
      ? await supabase.from('products').update(payload).eq('id', editing.id)
      : await supabase.from('products').insert(payload)

    setSaving(false)
    if (err) { setError(err.message); return }
    setModalOpen(false)
    router.refresh()
  }

  async function toggleActive(p: Product) {
    const supabase = createClient()
    await supabase.from('products').update({ active: !p.active }).eq('id', p.id)
    router.refresh()
  }

  const field = (label: string, node: React.ReactNode) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink-700">{label}</label>
      {node}
    </div>
  )

  const inputCls = "h-10 rounded-md border border-line-strong px-3 text-sm text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100"

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          placeholder="Cari produk…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`${inputCls} flex-1 min-w-0`}
        />
        <button onClick={openCreate}
          className="h-10 px-4 rounded-md bg-pine text-white text-sm font-medium hover:bg-pine-700 transition-colors shrink-0">
          + Tambah Produk
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-sand-100 text-xs uppercase tracking-wider text-ink-500 text-left">
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">Kategori</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Tipe</th>
              <th className="px-4 py-3 font-medium text-right tabular-nums">Harga</th>
              <th className="px-4 py-3 font-medium text-center">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-400">Belum ada produk.</td></tr>
            )}
            {filtered.map(p => (
              <tr key={p.id} className="hover:bg-sand-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-ink-500">{p.sku}</td>
                <td className="px-4 py-3 font-medium text-ink-900">{p.name}</td>
                <td className="px-4 py-3 text-ink-500 hidden sm:table-cell">{p.category ?? '—'}</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.type === 'custom_racik'
                      ? 'bg-rust-50 text-rust border border-rust-100'
                      : 'bg-pine-50 text-pine border border-pine-100'
                  }`}>
                    {p.type === 'custom_racik' ? 'Racik' : 'Ready'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-900">{formatRupiah(p.price)}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleActive(p)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium border transition-colors ${
                      p.active
                        ? 'bg-success-bg text-success border-success-bd'
                        : 'bg-sand-100 text-ink-400 border-line'
                    }`}>
                    {p.active ? 'Aktif' : 'Nonaktif'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(p)}
                    className="text-xs text-ink-400 hover:text-pine transition-colors font-medium">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Produk' : 'Tambah Produk'}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            {field('SKU *',
              <input className={inputCls} value={form.sku}
                onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="SCN-001" />
            )}
            {field('Tipe *',
              <select className={inputCls} value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as Product['type'] }))}>
                <option value="ready_stock">Ready Stock</option>
                <option value="custom_racik">Racik</option>
              </select>
            )}
          </div>
          {field('Nama Produk *',
            <input className={inputCls} value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Parfum Oud..." />
          )}
          <div className="grid grid-cols-2 gap-3">
            {field('Kategori',
              <input className={inputCls} value={form.category ?? ''}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Parfum, Diffuser..." />
            )}
            {field('Harga (Rp) *',
              <input className={inputCls} type="number" min={0} value={form.price}
                onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} />
            )}
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
              <input type="checkbox" checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
              Produk aktif
            </label>
          )}
          {error && <p className="text-sm text-danger bg-danger-bg border border-danger-bd rounded-md px-3 py-2">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setModalOpen(false)}
              className="flex-1 h-10 rounded-md border border-line-strong text-sm font-medium text-ink-700 hover:bg-sand-50">
              Batal
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 h-10 rounded-md bg-pine text-white text-sm font-medium hover:bg-pine-700 disabled:opacity-45 transition-colors">
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
