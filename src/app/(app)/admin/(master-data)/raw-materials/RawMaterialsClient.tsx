'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/Modal'
import type { Tables } from '@/types/database'

type RawMaterial = Tables<'raw_materials'>
const EMPTY: Omit<RawMaterial, 'id' | 'created_at'> = { name: '', unit: '', reorder_level: 0, active: true }

export function RawMaterialsClient({ initialData }: { initialData: RawMaterial[] }) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<RawMaterial | null>(null)
  const [form, setForm]           = useState(EMPTY)
  const [error, setError]         = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [search, setSearch]       = useState('')

  const filtered = initialData.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))

  function openCreate() { setEditing(null); setForm(EMPTY); setError(null); setModalOpen(true) }
  function openEdit(m: RawMaterial) {
    setEditing(m)
    setForm({ name: m.name, unit: m.unit, reorder_level: m.reorder_level, active: m.active })
    setError(null); setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.unit.trim()) { setError('Nama dan satuan wajib diisi.'); return }
    setSaving(true); setError(null)
    const supabase = createClient()
    const payload = { ...form, reorder_level: Number(form.reorder_level) }
    const { error: err } = editing
      ? await supabase.from('raw_materials').update(payload).eq('id', editing.id)
      : await supabase.from('raw_materials').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    setModalOpen(false); router.refresh()
  }

  async function toggleActive(m: RawMaterial) {
    const supabase = createClient()
    await supabase.from('raw_materials').update({ active: !m.active }).eq('id', m.id)
    router.refresh()
  }

  const inputCls = "h-10 rounded-md border border-line-strong px-3 text-sm text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100"

  return (
    <>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input placeholder="Cari bahan baku…" value={search}
          onChange={e => setSearch(e.target.value)} className={`${inputCls} flex-1 min-w-0`} />
        <button onClick={openCreate}
          className="h-10 px-4 rounded-md bg-pine text-white text-sm font-medium hover:bg-pine-700 transition-colors shrink-0">
          + Tambah Bahan Baku
        </button>
      </div>

      <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-sand-100 text-xs uppercase tracking-wider text-ink-500 text-left">
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Satuan</th>
              <th className="px-4 py-3 font-medium text-right tabular-nums">Reorder Level</th>
              <th className="px-4 py-3 font-medium text-center">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-400">Belum ada bahan baku.</td></tr>
            )}
            {filtered.map(m => (
              <tr key={m.id} className="hover:bg-sand-50 transition-colors">
                <td className="px-4 py-3 font-medium text-ink-900">{m.name}</td>
                <td className="px-4 py-3 text-ink-500">{m.unit}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-700">{m.reorder_level}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleActive(m)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium border transition-colors ${
                      m.active ? 'bg-success-bg text-success border-success-bd' : 'bg-sand-100 text-ink-400 border-line'
                    }`}>
                    {m.active ? 'Aktif' : 'Nonaktif'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(m)}
                    className="text-xs text-ink-400 hover:text-pine transition-colors font-medium">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Bahan Baku' : 'Tambah Bahan Baku'}>
        <div className="flex flex-col gap-4">
          {[
            { label: 'Nama *', key: 'name' as const, placeholder: 'Bibit Oud, Alkohol...', type: 'text' },
            { label: 'Satuan *', key: 'unit' as const, placeholder: 'ml, gram, pcs...', type: 'text' },
            { label: 'Reorder Level', key: 'reorder_level' as const, placeholder: '0', type: 'number' },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-700">{label}</label>
              <input className={inputCls} type={type} placeholder={placeholder}
                value={form[key] as string | number}
                onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))} />
            </div>
          ))}
          {editing && (
            <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
              <input type="checkbox" checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
              Bahan baku aktif
            </label>
          )}
          {error && <p className="text-sm text-danger bg-danger-bg border border-danger-bd rounded-md px-3 py-2">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setModalOpen(false)}
              className="flex-1 h-10 rounded-md border border-line-strong text-sm font-medium text-ink-700 hover:bg-sand-50">Batal</button>
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
