'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/Modal'
import type { Tables } from '@/types/database'

type Supplier = Tables<'suppliers'>
const EMPTY: Omit<Supplier, 'id' | 'created_at'> = { name: '', phone: null, address: null }

export function SuppliersClient({ initialData }: { initialData: Supplier[] }) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<Supplier | null>(null)
  const [form, setForm]           = useState(EMPTY)
  const [error, setError]         = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)

  function openCreate() { setEditing(null); setForm(EMPTY); setError(null); setModalOpen(true) }
  function openEdit(s: Supplier) {
    setEditing(s)
    setForm({ name: s.name, phone: s.phone, address: s.address })
    setError(null); setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Nama supplier wajib diisi.'); return }
    setSaving(true); setError(null)
    const supabase = createClient()
    const payload = { name: form.name, phone: form.phone || null, address: form.address || null }
    const { error: err } = editing
      ? await supabase.from('suppliers').update(payload).eq('id', editing.id)
      : await supabase.from('suppliers').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    setModalOpen(false); router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus supplier ini?')) return
    const supabase = createClient()
    const { error: err } = await supabase.from('suppliers').delete().eq('id', id)
    if (err) alert(err.message)
    else router.refresh()
  }

  const inputCls = "h-10 rounded-md border border-line-strong px-3 text-sm text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100"

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={openCreate}
          className="h-10 px-4 rounded-md bg-pine text-white text-sm font-medium hover:bg-pine-700 transition-colors">
          + Tambah Supplier
        </button>
      </div>

      <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-sand-100 text-xs uppercase tracking-wider text-ink-500 text-left">
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">Telepon</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Alamat</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {initialData.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-ink-400">Belum ada supplier.</td></tr>
            )}
            {initialData.map(s => (
              <tr key={s.id} className="hover:bg-sand-50 transition-colors">
                <td className="px-4 py-3 font-medium text-ink-900">{s.name}</td>
                <td className="px-4 py-3 text-ink-500 hidden sm:table-cell">{s.phone ?? '—'}</td>
                <td className="px-4 py-3 text-ink-500 hidden md:table-cell">{s.address ?? '—'}</td>
                <td className="px-4 py-3 text-right flex gap-3 justify-end">
                  <button onClick={() => openEdit(s)} className="text-xs text-ink-400 hover:text-pine font-medium">Edit</button>
                  <button onClick={() => handleDelete(s.id)} className="text-xs text-ink-400 hover:text-danger font-medium">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Supplier' : 'Tambah Supplier'}>
        <div className="flex flex-col gap-4">
          {[
            { label: 'Nama *', key: 'name' as const, placeholder: 'PT Bahan Wangi...' },
            { label: 'Telepon', key: 'phone' as const, placeholder: '08xx...' },
            { label: 'Alamat', key: 'address' as const, placeholder: 'Jl. ...' },
          ].map(({ label, key, placeholder }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-700">{label}</label>
              <input className={inputCls} placeholder={placeholder}
                value={form[key] ?? ''}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value || null }))} />
            </div>
          ))}
          {error && <p className="text-sm text-danger bg-danger-bg border border-danger-bd rounded-md px-3 py-2">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setModalOpen(false)} className="flex-1 h-10 rounded-md border border-line-strong text-sm font-medium text-ink-700 hover:bg-sand-50">Batal</button>
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
