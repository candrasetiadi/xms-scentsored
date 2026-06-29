'use client'

import { useCallback, useEffect, useState } from 'react'

interface Branch { id: string; name: string }

interface Slot {
  id: string; branch_id: string; branch_name: string
  date: string; start_time: string; end_time: string
  max_bookings: number; filled: number; available: number
  notes: string | null
}

interface Booking {
  id: string; customer_name: string; customer_phone: string
  customer_email: string | null; status: 'confirmed' | 'cancelled'
  notes: string | null; queue_number: number; created_at: string
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })

export function SlotsClient({ branches, defaultBranchId }: { branches: Branch[]; defaultBranchId: string | null }) {
  const [branchId,  setBranchId]  = useState(defaultBranchId ?? '')
  const [slots,     setSlots]     = useState<Slot[]>([])
  const [loading,   setLoading]   = useState(true)
  const [selSlot,   setSelSlot]   = useState<Slot | null>(null)
  const [bookings,  setBookings]  = useState<Booking[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(false)

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ date: '', start_time: '10:00', end_time: '11:00', max_bookings: 5, notes: '' })
  const [creating, setCreating] = useState(false)
  const [createErr, setCreateErr] = useState('')

  const loadSlots = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    const from = new Date().toISOString().slice(0, 10)
    const to   = new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10)
    const res  = await fetch(`/api/v1/consultation-slots?branch_id=${branchId}&from=${from}&to=${to}`)
    const json = await res.json()
    setSlots(json.data ?? [])
    setLoading(false)
  }, [branchId])

  useEffect(() => { loadSlots() }, [loadSlots])

  const loadBookings = useCallback(async (slotId: string) => {
    setBookingsLoading(true)
    const res  = await fetch(`/api/v1/bookings?slot_id=${slotId}`)
    const json = await res.json()
    setBookings(json.data ?? [])
    setBookingsLoading(false)
  }, [])

  const selectSlot = (slot: Slot) => {
    setSelSlot(slot)
    loadBookings(slot.id)
  }

  const createSlot = async () => {
    setCreating(true)
    setCreateErr('')
    const res = await fetch('/api/v1/consultation-slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, branch_id: branchId }),
    })
    const json = await res.json()
    setCreating(false)
    if (!res.ok) { setCreateErr(json.error?.message ?? 'Gagal.'); return }
    setShowCreate(false)
    setForm({ date: '', start_time: '10:00', end_time: '11:00', max_bookings: 5, notes: '' })
    loadSlots()
  }

  const deactivateSlot = async (slotId: string) => {
    await fetch(`/api/v1/consultation-slots/${slotId}`, { method: 'DELETE' })
    setSelSlot(null)
    loadSlots()
  }

  const cancelBooking = async (bookingId: string) => {
    await fetch(`/api/v1/bookings/${bookingId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    if (selSlot) loadBookings(selSlot.id)
    loadSlots()
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Slot Booking Konsultasi</h1>
          <div className="flex items-center gap-2">
            {branches.length > 1 && (
              <select value={branchId} onChange={e => setBranchId(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-sm border"
                style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            <button onClick={() => { setShowCreate(true); setCreateErr('') }}
              className="rounded-lg px-3 py-1.5 text-sm font-medium"
              style={{ background: 'var(--color-primary)', color: '#fff' }}>
              + Buat Slot
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Slot list */}
          <div className="space-y-2">
            {loading ? (
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Memuat...</p>
            ) : slots.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Belum ada slot.</p>
            ) : slots.map(slot => (
              <button key={slot.id} onClick={() => selectSlot(slot)}
                className="w-full text-left rounded-xl p-3 border transition-all"
                style={{
                  background:   selSlot?.id === slot.id ? 'var(--color-primary)' : 'var(--color-surface-raised)',
                  borderColor:  selSlot?.id === slot.id ? 'var(--color-primary)' : 'var(--color-border)',
                  color:        selSlot?.id === slot.id ? '#fff' : 'var(--color-text-primary)',
                }}>
                <p className="font-medium text-sm">{fmtDate(slot.date)}</p>
                <p className="text-xs opacity-70">{slot.start_time.slice(0,5)} – {slot.end_time.slice(0,5)}</p>
                <p className="text-xs mt-1 opacity-80">{slot.filled}/{slot.max_bookings} booking</p>
              </button>
            ))}
          </div>

          {/* Booking detail */}
          <div className="md:col-span-2">
            {!selSlot ? (
              <div className="rounded-xl border p-8 text-center"
                style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                <p className="text-sm">Pilih slot untuk melihat booking</p>
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden"
                style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
                <div className="flex items-start justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      {fmtDate(selSlot.date)} · {selSlot.start_time.slice(0,5)}–{selSlot.end_time.slice(0,5)}
                    </p>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                      {selSlot.filled}/{selSlot.max_bookings} booking
                    </p>
                  </div>
                  <button onClick={() => deactivateSlot(selSlot.id)}
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{ color: 'var(--color-error)', background: 'var(--color-error-bg)' }}>
                    Nonaktifkan
                  </button>
                </div>

                {bookingsLoading ? (
                  <p className="p-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Memuat...</p>
                ) : bookings.length === 0 ? (
                  <p className="p-4 text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>Belum ada booking.</p>
                ) : (
                  <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                    {bookings.map(b => (
                      <div key={b.id} className="flex items-center justify-between gap-2 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: b.status === 'cancelled' ? 'var(--color-border)' : 'var(--color-primary)', color: '#fff' }}>
                            {b.queue_number}
                          </span>
                          <div>
                            <p className="text-sm font-medium" style={{ color: b.status === 'cancelled' ? 'var(--color-text-secondary)' : 'var(--color-text-primary)', textDecoration: b.status === 'cancelled' ? 'line-through' : 'none' }}>
                              {b.customer_name}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{b.customer_phone}</p>
                          </div>
                        </div>
                        {b.status === 'confirmed' && (
                          <button onClick={() => cancelBooking(b.id)}
                            className="text-xs px-2 py-1 rounded-lg"
                            style={{ color: 'var(--color-error)', background: 'var(--color-error-bg)' }}>
                            Batalkan
                          </button>
                        )}
                        {b.status === 'cancelled' && (
                          <span className="text-xs px-2 py-1 rounded-full"
                            style={{ background: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                            Dibatalkan
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal buat slot */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: 'var(--color-surface-raised)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Buat Slot Baru</h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Tanggal</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm border"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Mulai</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full rounded-lg px-3 py-2 text-sm border"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Selesai</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full rounded-lg px-3 py-2 text-sm border"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Max Booking</label>
                <input type="number" min={1} max={20} value={form.max_bookings}
                  onChange={e => setForm(f => ({ ...f, max_bookings: parseInt(e.target.value) || 5 }))}
                  className="w-full rounded-lg px-3 py-2 text-sm border"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Catatan (opsional)</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Sesi 2 jam termasuk uji aroma"
                  className="w-full rounded-lg px-3 py-2 text-sm border"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
              </div>
            </div>

            {createErr && (
              <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>{createErr}</p>
            )}

            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} disabled={creating}
                className="flex-1 rounded-lg py-2 text-sm font-medium border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', background: 'var(--color-surface)' }}>
                Batal
              </button>
              <button onClick={createSlot} disabled={creating}
                className="flex-1 rounded-lg py-2 text-sm font-medium"
                style={{ background: 'var(--color-primary)', color: '#fff', opacity: creating ? 0.6 : 1 }}>
                {creating ? 'Menyimpan...' : 'Buat Slot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
