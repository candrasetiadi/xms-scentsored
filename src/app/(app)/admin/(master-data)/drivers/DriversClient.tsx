'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/Modal'
import type { Tables } from '@/types/database'

type Driver = Tables<'drivers'>
const EMPTY: Omit<Driver, 'id' | 'created_at'> = {
  name: '', phone: null, type: 'travel_driver',
  fee_type: 'percentage', fee_value: 0,
  referral_code: null, qr_token: null, active: true,
}

const TYPE_LABEL = { travel_driver: 'Travel Driver', tour_guide: 'Tour Guide' }

export function DriversClient({ initialData }: { initialData: Driver[] }) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<Driver | null>(null)
  const [form, setForm]           = useState(EMPTY)
  const [error, setError]         = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)

  function openCreate() { setEditing(null); setForm(EMPTY); setError(null); setModalOpen(true) }
  function openEdit(d: Driver) {
    setEditing(d)
    setForm({ name: d.name, phone: d.phone, type: d.type, fee_type: d.fee_type,
      fee_value: d.fee_value, referral_code: d.referral_code, qr_token: d.qr_token, active: d.active })
    setError(null); setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Nama driver wajib diisi.'); return }
    if (form.fee_value < 0 || form.fee_value > 100) { setError('Fee harus antara 0–100%.'); return }
    setSaving(true); setError(null)
    const supabase = createClient()
    const payload = { ...form, phone: form.phone || null, referral_code: form.referral_code || null,
      qr_token: form.qr_token || null, fee_value: Number(form.fee_value) }
    const { error: err } = editing
      ? await supabase.from('drivers').update(payload).eq('id', editing.id)
      : await supabase.from('drivers').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    setModalOpen(false); router.refresh()
  }

  async function toggleActive(d: Driver) {
    const supabase = createClient()
    await supabase.from('drivers').update({ active: !d.active }).eq('id', d.id)
    router.refresh()
  }

  const inputCls = "h-10 rounded-md border border-line-strong px-3 text-sm text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100"

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={openCreate}
          className="h-10 px-4 rounded-md bg-pine text-white text-sm font-medium hover:bg-pine-700 transition-colors">
          + Tambah Driver
        </button>
      </div>

      <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-sand-100 text-xs uppercase tracking-wider text-ink-500 text-left">
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">Tipe</th>
              <th className="px-4 py-3 font-medium text-right tabular-nums">Fee</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Kode Referral</th>
              <th className="px-4 py-3 font-medium text-center">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {initialData.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-400">Belum ada driver.</td></tr>
            )}
            {initialData.map(d => (
              <tr key={d.id} className="hover:bg-sand-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink-900">{d.name}</p>
                  {d.phone && <p className="text-xs text-ink-400 mt-0.5">{d.phone}</p>}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-sand-100 text-ink-600 border border-line">
                    {TYPE_LABEL[d.type]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-ink-900">
                  {d.fee_value}%
                </td>
                <td className="px-4 py-3 text-ink-500 font-mono text-xs hidden md:table-cell">
                  {d.referral_code ?? '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleActive(d)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium border transition-colors ${
                      d.active ? 'bg-success-bg text-success border-success-bd' : 'bg-sand-100 text-ink-400 border-line'
                    }`}>
                    {d.active ? 'Aktif' : 'Nonaktif'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(d)} className="text-xs text-ink-400 hover:text-pine font-medium">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Driver' : 'Tambah Driver'}>
        <div className="flex flex-col gap-4">
          {field('Nama *', <input className={inputCls} value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Budi Santoso" />)}
          {field('Telepon', <input className={inputCls} value={form.phone ?? ''}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value || null }))} placeholder="08xx..." />)}
          <div className="grid grid-cols-2 gap-3">
            {field('Tipe',
              <select className={inputCls} value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as Driver['type'] }))}>
                <option value="travel_driver">Travel Driver</option>
                <option value="tour_guide">Tour Guide</option>
              </select>
            )}
            {field('Fee (%)',
              <input className={inputCls} type="number" min={0} max={100} step={0.5}
                value={form.fee_value}
                onChange={e => setForm(f => ({ ...f, fee_value: Number(e.target.value) }))} />
            )}
          </div>
          {field('Kode Referral', <input className={inputCls} value={form.referral_code ?? ''}
            onChange={e => setForm(f => ({ ...f, referral_code: e.target.value || null }))}
            placeholder="Opsional, mis. BUDI10" />)}
          {editing && (
            <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
              <input type="checkbox" checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
              Driver aktif
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
