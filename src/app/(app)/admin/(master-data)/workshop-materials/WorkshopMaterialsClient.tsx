'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ScentCategory {
  id: string
  name: string
  color_hex: string
  sort_order: number
}

interface WorkshopMaterial {
  id: string
  name: string
  dilution_percentage: number | null
  category_id: string | null
  stock_gram: number
  active: boolean
  scent_categories: ScentCategory | null
}

const EMPTY_FORM = { name: '', dilution_percentage: '', category_id: '' }

function CategoryBadge({ cat }: { cat: ScentCategory | null }) {
  if (!cat) return <span className="text-xs text-ink-400">—</span>
  return (
    <span
      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: cat.color_hex + '22', color: cat.color_hex }}
    >
      {cat.name}
    </span>
  )
}

export function WorkshopMaterialsClient({
  initialData,
  categories,
}: {
  initialData: WorkshopMaterial[]
  categories: ScentCategory[]
}) {
  const router  = useRouter()
  const [data,  setData]    = useState<WorkshopMaterial[]>(initialData)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const [modal,   setModal]   = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<WorkshopMaterial | null>(null)
  const [form,    setForm]    = useState(EMPTY_FORM)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const filtered = data.filter(m => {
    if (!showInactive && !m.active) return false
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError('')
    setModal('create')
  }

  function openEdit(m: WorkshopMaterial) {
    setEditing(m)
    setForm({
      name:                 m.name,
      dilution_percentage:  m.dilution_percentage?.toString() ?? '',
      category_id:          m.category_id ?? '',
    })
    setError('')
    setModal('edit')
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Nama wajib diisi.'); return }
    setSaving(true); setError('')

    const payload = {
      name:                form.name.trim(),
      dilution_percentage: form.dilution_percentage ? parseFloat(form.dilution_percentage) : null,
      category_id:         form.category_id || null,
    }

    const res = editing
      ? await fetch(`/api/v1/workshop/materials/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/v1/workshop/materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

    const json = await res.json()
    setSaving(false)

    if (!res.ok) { setError(json.error ?? 'Gagal menyimpan.'); return }

    const updated: WorkshopMaterial = {
      ...json.data,
      scent_categories: json.data.scent_categories ?? null,
    }

    if (editing) {
      setData(prev => prev.map(m => m.id === updated.id ? updated : m))
    } else {
      setData(prev => [...prev, updated].sort((a, b) => a.name.localeCompare(b.name)))
    }
    setModal(null)
  }

  async function toggleActive(m: WorkshopMaterial) {
    const res = await fetch(`/api/v1/workshop/materials/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !m.active }),
    })
    if (res.ok) {
      setData(prev => prev.map(x => x.id === m.id ? { ...x, active: !m.active } : x))
    }
  }

  const inputCls = 'w-full h-10 rounded-lg border border-line-strong px-3 text-sm text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100'

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          placeholder="Cari bahan workshop…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`${inputCls} flex-1 min-w-0`}
        />
        <label className="flex items-center gap-1.5 text-sm text-ink-600 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="accent-pine"
          />
          Tampilkan nonaktif
        </label>
        <button
          onClick={openCreate}
          className="h-10 px-4 rounded-lg bg-pine text-white text-sm font-medium hover:bg-pine-600 transition-colors shrink-0"
        >
          + Tambah Bahan
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-line rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-sand-100 text-xs uppercase tracking-wider text-ink-500 text-left">
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Kategori</th>
              <th className="px-4 py-3 font-medium text-right tabular-nums">Dilusi</th>
              <th className="px-4 py-3 font-medium text-right tabular-nums">Stok (g)</th>
              <th className="px-4 py-3 font-medium text-center">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-400 text-sm">
                  {search ? 'Tidak ada bahan yang cocok.' : 'Belum ada bahan workshop.'}
                </td>
              </tr>
            )}
            {filtered.map(m => (
              <tr key={m.id} className={`hover:bg-sand-50 transition-colors ${!m.active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium text-ink-900">{m.name}</td>
                <td className="px-4 py-3">
                  <CategoryBadge cat={m.scent_categories} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-600">
                  {m.dilution_percentage != null ? `${m.dilution_percentage}%` : '—'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-700 font-medium">
                  {m.stock_gram}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleActive(m)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium border transition-colors ${
                      m.active
                        ? 'bg-success-bg text-success border-success-bd'
                        : 'bg-sand-100 text-ink-400 border-line'
                    }`}
                  >
                    {m.active ? 'Aktif' : 'Nonaktif'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openEdit(m)}
                    className="text-xs text-ink-400 hover:text-pine transition-colors font-medium"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-line">
              <h2 className="font-semibold text-ink-900">
                {modal === 'create' ? 'Tambah Bahan Workshop' : 'Edit Bahan Workshop'}
              </h2>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Nama */}
              <div>
                <label className="text-xs font-medium text-ink-600 block mb-1">Nama *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Bibit Oud, Rose Absolute..."
                  className={inputCls}
                />
              </div>

              {/* Kategori */}
              <div>
                <label className="text-xs font-medium text-ink-600 block mb-1">Kategori Aroma</label>
                <select
                  value={form.category_id}
                  onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">— Tidak ada —</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Dilusi */}
              <div>
                <label className="text-xs font-medium text-ink-600 block mb-1">Dilusi (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={form.dilution_percentage}
                  onChange={e => setForm(f => ({ ...f, dilution_percentage: e.target.value }))}
                  placeholder="Contoh: 10 untuk 10%"
                  className={inputCls}
                />
              </div>

              {error && (
                <p className="text-sm text-danger bg-danger-bg border border-danger-bd rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            <div className="px-6 pb-5 flex gap-2">
              <button
                onClick={() => setModal(null)}
                disabled={saving}
                className="flex-1 h-10 rounded-lg border border-line text-sm font-medium text-ink-700 hover:bg-sand-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 h-10 rounded-lg bg-pine text-white text-sm font-medium hover:bg-pine-600 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
