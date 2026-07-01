'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/Modal'
import type { Tables } from '@/types/database'

type Agency = Tables<'travel_agencies'>

const EMPTY: Omit<Agency, 'id' | 'created_at'> = {
  name: '', phone: null, fee_value: 5, active: true,
}

export function TravelAgenciesClient({ initialData }: { initialData: Agency[] }) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<Agency | null>(null)
  const [form, setForm]           = useState(EMPTY)
  const [error, setError]         = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)

  function openCreate() { setEditing(null); setForm(EMPTY); setError(null); setModalOpen(true) }
  function openEdit(a: Agency) {
    setEditing(a)
    setForm({ name: a.name, phone: a.phone, fee_value: a.fee_value, active: a.active })
    setError(null); setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Nama perusahaan wajib diisi.'); return }
    if (form.fee_value < 0 || form.fee_value > 100) { setError('Fee harus antara 0–100%.'); return }
    setSaving(true); setError(null)
    const supabase = createClient()
    const payload = { name: form.name.trim(), phone: form.phone || null, fee_value: Number(form.fee_value), active: form.active }
    const { error: err } = editing
      ? await supabase.from('travel_agencies').update(payload).eq('id', editing.id)
      : await supabase.from('travel_agencies').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    setModalOpen(false); router.refresh()
  }

  async function toggleActive(a: Agency) {
    const supabase = createClient()
    await supabase.from('travel_agencies').update({ active: !a.active }).eq('id', a.id)
    router.refresh()
  }

  const inputCls = "h-10 rounded-md border border-line-strong px-3 text-sm text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100"

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={openCreate}
          className="h-10 px-4 rounded-md bg-pine text-white text-sm font-medium hover:bg-pine-700 transition-colors">
          + Tambah Perusahaan
        </button>
      </div>

      <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-sand-100 text-xs uppercase tracking-wider text-ink-500 text-left">
              <th className="px-4 py-3 font-medium">Nama Perusahaan</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">Telepon</th>
              <th className="px-4 py-3 font-medium text-right tabular-nums">Fee Komisi</th>
              <th className="px-4 py-3 font-medium text-center">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {initialData.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-400">Belum ada perusahaan terdaftar.</td></tr>
            )}
            {initialData.map(a => (
              <tr key={a.id} className="hover:bg-sand-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink-900">{a.name}</p>
                </td>
                <td className="px-4 py-3 text-ink-500 text-sm hidden sm:table-cell">
                  {a.phone ?? '—'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-ink-900">
                  {a.fee_value}%
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleActive(a)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium border transition-colors ${
                      a.active ? 'bg-success-bg text-success border-success-bd' : 'bg-sand-100 text-ink-400 border-line'
                    }`}>
                    {a.active ? 'Aktif' : 'Nonaktif'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(a)} className="text-xs text-ink-400 hover:text-pine font-medium">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Perusahaan' : 'Tambah Perusahaan'}>
        <div className="flex flex-col gap-4">
          {field('Nama Perusahaan *', <input className={inputCls} value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Simply Tour" />)}
          {field('Telepon', <input className={inputCls} value={form.phone ?? ''}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value || null }))} placeholder="08xx..." />)}
          {field('Fee Komisi Perusahaan (%)',
            <div className="relative">
              <input className={inputCls + ' w-full pr-8'} type="number" min={0} max={100} step={0.5}
                value={form.fee_value}
                onChange={e => setForm(f => ({ ...f, fee_value: Number(e.target.value) }))} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">%</span>
            </div>
          )}
          {editing && (
            <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
              <input type="checkbox" checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
              Perusahaan aktif
            </label>
          )}
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

function field(label: string, node: React.ReactNode) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink-700">{label}</label>
      {node}
    </div>
  )
}
