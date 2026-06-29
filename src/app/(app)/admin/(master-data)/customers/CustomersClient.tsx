'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/Modal'
import type { Tables } from '@/types/database'

type Customer = Tables<'customers'>
const EMPTY: Omit<Customer, 'id' | 'created_at'> = { name: null, phone: null, email: null }

export function CustomersClient({ initialData }: { initialData: Customer[] }) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<Customer | null>(null)
  const [form, setForm]           = useState(EMPTY)
  const [error, setError]         = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [search, setSearch]       = useState('')

  const filtered = initialData.filter(c =>
    (c.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? '').includes(search)
  )

  function openCreate() { setEditing(null); setForm(EMPTY); setError(null); setModalOpen(true) }
  function openEdit(c: Customer) {
    setEditing(c); setForm({ name: c.name, phone: c.phone, email: c.email })
    setError(null); setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name?.trim() && !form.phone?.trim()) { setError('Nama atau nomor telepon wajib diisi.'); return }
    setSaving(true); setError(null)
    const supabase = createClient()
    const payload = { name: form.name || null, phone: form.phone || null, email: form.email || null }
    const { error: err } = editing
      ? await supabase.from('customers').update(payload).eq('id', editing.id)
      : await supabase.from('customers').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    setModalOpen(false); router.refresh()
  }

  const inputCls = "h-10 rounded-md border border-line-strong px-3 text-sm text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100"

  return (
    <>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input placeholder="Cari nama atau telepon…" value={search}
          onChange={e => setSearch(e.target.value)} className={`${inputCls} flex-1 min-w-0`} />
        <button onClick={openCreate}
          className="h-10 px-4 rounded-md bg-pine text-white text-sm font-medium hover:bg-pine-700 transition-colors shrink-0">
          + Tambah Pelanggan
        </button>
      </div>

      <p className="text-xs text-ink-400 mb-3">Menampilkan 100 pelanggan terbaru. Pelanggan baru juga dibuat otomatis di POS.</p>

      <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-sand-100 text-xs uppercase tracking-wider text-ink-500 text-left">
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Telepon</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Email</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-ink-400">Belum ada pelanggan.</td></tr>
            )}
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-sand-50 transition-colors">
                <td className="px-4 py-3 font-medium text-ink-900">{c.name ?? '—'}</td>
                <td className="px-4 py-3 text-ink-500">{c.phone ?? '—'}</td>
                <td className="px-4 py-3 text-ink-500 hidden md:table-cell">{c.email ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(c)} className="text-xs text-ink-400 hover:text-pine font-medium">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Pelanggan' : 'Tambah Pelanggan'}>
        <div className="flex flex-col gap-4">
          {[
            { label: 'Nama', key: 'name' as const, placeholder: 'Aulia Rahma', type: 'text' },
            { label: 'Telepon', key: 'phone' as const, placeholder: '08xx...', type: 'tel' },
            { label: 'Email', key: 'email' as const, placeholder: 'aulia@email.com', type: 'email' },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-700">{label}</label>
              <input className={inputCls} type={type} placeholder={placeholder}
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
