'use client'

import { useCallback, useEffect, useState } from 'react'

interface Branch { id: string; name: string }

interface Slot {
  id: string; branch_id: string; branch_name: string
  date: string; start_time: string; end_time: string
  max_bookings: number; price: number; price_100ml: number; price_kids: number
  filled: number; available: number; notes: string | null
}

interface Booking {
  id: string; customer_name: string; customer_phone: string
  customer_email: string | null; qty: number
  qty_50ml: number; qty_100ml: number; qty_kids: number
  status: 'pending_payment' | 'confirmed' | 'cancelled' | 'expired'
  amount: number; expires_at: string | null; paid_at: string | null
  notes: string | null; queue_number: number; created_at: string
}

const DAYS_ID   = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const _numFmt   = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return `${DAYS_ID[dt.getDay()]}, ${dt.getDate()} ${MONTHS_ID[dt.getMonth()]}`
}
function fmtRp(n: number) { return 'Rp ' + _numFmt.format(Math.round(n)) }

const DEFAULT_SESSIONS = [
  { start_time: '09:00', end_time: '11:00', label: 'Sesi 1' },
  { start_time: '12:00', end_time: '15:00', label: 'Sesi 2' },
  { start_time: '15:00', end_time: '18:00', label: 'Sesi 3' },
  { start_time: '18:00', end_time: '21:00', label: 'Sesi 4' },
]

function todayStr() { return new Date().toISOString().slice(0, 10) }
function weeksLater(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n * 7)
  return d.toISOString().slice(0, 10)
}

function StatusBadge({ status }: { status: Booking['status'] }) {
  const map: Record<Booking['status'], { label: string; cls: string }> = {
    confirmed:       { label: 'Terkonfirmasi', cls: 'bg-success-bg text-success' },
    pending_payment: { label: 'Menunggu Bayar', cls: 'bg-amber-50 text-amber-700' },
    expired:         { label: 'Kedaluwarsa',    cls: 'bg-sand-100 text-ink-400' },
    cancelled:       { label: 'Dibatalkan',     cls: 'bg-sand-100 text-ink-400' },
  }
  const { label, cls } = map[status]
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
}

export function SlotsClient({ branches, defaultBranchId }: { branches: Branch[]; defaultBranchId: string | null }) {
  const [branchId,  setBranchId]  = useState(defaultBranchId ?? '')
  const [slots,     setSlots]     = useState<Slot[]>([])
  const [loading,   setLoading]   = useState(true)
  const [selSlot,   setSelSlot]   = useState<Slot | null>(null)
  const [bookings,  setBookings]  = useState<Booking[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(false)

  // Modal: buat slot satuan
  const [showCreate,    setShowCreate]    = useState(false)
  const [form,          setForm]          = useState({ date: '', start_time: '09:00', end_time: '11:00', max_bookings: 16, notes: '' })
  const [formPrice50,   setFormPrice50]   = useState('285000')
  const [formPrice100,  setFormPrice100]  = useState('450000')
  const [formPriceKids, setFormPriceKids] = useState('200000')
  const [creating,      setCreating]      = useState(false)
  const [createErr,     setCreateErr]     = useState('')

  // Modal: generate jadwal bulk
  const [showGenerate,    setShowGenerate]    = useState(false)
  const [genFrom,         setGenFrom]         = useState(todayStr)
  const [genTo,           setGenTo]           = useState(() => weeksLater(4))
  const [genMaxBook,      setGenMaxBook]      = useState(16)
  const [genPrice50,      setGenPrice50]      = useState<string>('285000')
  const [genPrice100,     setGenPrice100]     = useState<string>('450000')
  const [genPriceKids,    setGenPriceKids]    = useState<string>('200000')
  const genSkipWeek = false
  const [generating,      setGenerating]      = useState(false)
  const [generateResult,  setGenerateResult]  = useState<{ created: number; skipped: number } | null>(null)
  const [generateErr,     setGenerateErr]     = useState('')

  const loadSlots = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    const from = todayStr()
    const to   = weeksLater(8)
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
    setCreating(true); setCreateErr('')
    const res = await fetch('/api/v1/consultation-slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        price:       parseInt(formPrice50)   || 0,
        price_100ml: parseInt(formPrice100)  || 0,
        price_kids:  parseInt(formPriceKids) || 0,
        branch_id:   branchId,
      }),
    })
    const json = await res.json()
    setCreating(false)
    if (!res.ok) { setCreateErr(json.error?.message ?? 'Gagal.'); return }
    setShowCreate(false)
    setForm({ date: '', start_time: '09:00', end_time: '11:00', max_bookings: 16, notes: '' })
    setFormPrice50('285000')
    setFormPrice100('450000')
    setFormPriceKids('200000')
    loadSlots()
  }

  const generateSlots = async () => {
    setGenerating(true); setGenerateErr(''); setGenerateResult(null)
    const res = await fetch('/api/v1/consultation-slots/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id:    branchId,
        from:         genFrom,
        to:           genTo,
        max_bookings: genMaxBook,
        price:        parseInt(genPrice50)    || 0,
        price_100ml:  parseInt(genPrice100)   || 0,
        price_kids:   parseInt(genPriceKids)  || 0,
        skip_weekends: genSkipWeek,
      }),
    })
    const json = await res.json()
    setGenerating(false)
    if (!res.ok) { setGenerateErr(json.error?.message ?? 'Gagal generate.'); return }
    setGenerateResult(json.data)
    loadSlots()
  }

  const deactivateSlot = async (slotId: string) => {
    await fetch(`/api/v1/consultation-slots/${slotId}`, { method: 'DELETE' })
    setSelSlot(null)
    loadSlots()
  }

  const confirmBooking = async (bookingId: string) => {
    await fetch(`/api/v1/bookings/${bookingId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm' }),
    })
    if (selSlot) loadBookings(selSlot.id)
    loadSlots()
  }

  const cancelBooking = async (bookingId: string) => {
    await fetch(`/api/v1/bookings/${bookingId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    if (selSlot) loadBookings(selSlot.id)
    loadSlots()
  }

  // Group slots by date
  const slotsByDate = slots.reduce<Record<string, Slot[]>>((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = []
    acc[slot.date].push(slot)
    return acc
  }, {})

  const inputCls = 'w-full h-9 rounded-lg border border-line-strong px-3 text-sm text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100'

  return (
    <div className="min-h-screen bg-sand-50">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-[28px] text-pine">Raw Mat Experience</h1>
            <p className="text-sm text-ink-400 mt-0.5">Kelola slot jadwal dan lihat booking per sesi</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {branches.length > 1 && (
              <select value={branchId} onChange={e => setBranchId(e.target.value)}
                className="h-9 rounded-lg px-3 text-sm border border-line text-ink-900 bg-white">
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            <button
              onClick={() => { setShowGenerate(true); setGenerateResult(null); setGenerateErr('') }}
              className="h-9 px-3 rounded-lg border border-pine text-pine text-sm font-medium hover:bg-pine-50 transition-colors">
              ⚡ Generate Jadwal
            </button>
            <button
              onClick={() => { setShowCreate(true); setCreateErr('') }}
              className="h-9 px-3 rounded-lg bg-pine text-white text-sm font-medium hover:bg-pine-600 transition-colors">
              + Slot Manual
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-5 items-start">

          {/* Slot list */}
          <div className="md:col-span-2 space-y-4">
            {loading ? (
              <p className="text-sm text-ink-400 py-4">Memuat jadwal...</p>
            ) : Object.keys(slotsByDate).length === 0 ? (
              <div className="bg-white border border-line rounded-xl p-6 text-center">
                <p className="text-sm text-ink-500 mb-1">Belum ada slot</p>
                <p className="text-xs text-ink-400">Gunakan "Generate Jadwal" untuk buat otomatis</p>
              </div>
            ) : (
              Object.entries(slotsByDate).map(([date, daySlots]) => (
                <div key={date}>
                  <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-1.5 px-1">
                    {fmtDate(date)}
                  </p>
                  <div className="space-y-1.5">
                    {daySlots.map(slot => {
                      const pct        = slot.max_bookings > 0 ? slot.filled / slot.max_bookings : 0
                      const full       = slot.filled >= slot.max_bookings
                      const isSelected = selSlot?.id === slot.id
                      return (
                        <button key={slot.id} onClick={() => selectSlot(slot)}
                          className={[
                            'w-full text-left rounded-xl p-3 border transition-all',
                            isSelected ? 'bg-pine border-pine text-white' : 'bg-white border-line hover:border-pine-200',
                          ].join(' ')}>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-ink-900'}`}>
                              {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                            </span>
                            {full ? (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-danger-bg text-danger'
                              }`}>PENUH</span>
                            ) : (
                              <span className={`text-xs ${isSelected ? 'text-white/70' : 'text-ink-400'}`}>
                                {slot.available} tersisa
                              </span>
                            )}
                          </div>
                          <div className={`mt-1.5 h-1 rounded-full overflow-hidden ${isSelected ? 'bg-white/20' : 'bg-sand-200'}`}>
                            <div
                              className={`h-full rounded-full transition-all ${full ? 'bg-danger' : isSelected ? 'bg-white' : 'bg-pine'}`}
                              style={{ width: `${Math.min(pct * 100, 100)}%` }}
                            />
                          </div>
                          <div className={`flex items-center justify-between mt-1 text-xs ${isSelected ? 'text-white/60' : 'text-ink-400'}`}>
                            <span>{slot.filled}/{slot.max_bookings} booking</span>
                            {(slot.price > 0 || slot.price_100ml > 0 || slot.price_kids > 0) && (
                              <span className="text-right leading-tight">
                                {slot.price > 0 && <span className="block">50ml {fmtRp(slot.price)}</span>}
                                {slot.price_100ml > 0 && <span className="block">100ml {fmtRp(slot.price_100ml)}</span>}
                                {slot.price_kids > 0 && <span className="block">Kids {fmtRp(slot.price_kids)}</span>}
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Booking detail */}
          <div className="md:col-span-3 md:sticky md:top-14 md:max-h-[calc(100vh-4rem)] md:overflow-y-auto md:rounded-xl">
            {!selSlot ? (
              <div className="bg-white border border-line rounded-xl p-10 text-center h-full flex flex-col items-center justify-center gap-2">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-300">
                  <rect x="4" y="6" width="24" height="22" rx="2"/>
                  <path d="M22 4v4M10 4v4M4 14h24"/>
                  <path d="M10 20h4M10 24h8" strokeLinecap="round"/>
                </svg>
                <p className="text-sm text-ink-500">Pilih slot untuk melihat detail booking</p>
              </div>
            ) : (
              <div className="bg-white border border-line rounded-xl overflow-hidden">
                {/* Slot header */}
                <div className="flex items-start justify-between p-4 border-b border-line bg-sand-50">
                  <div>
                    <p className="font-semibold text-ink-900">
                      {fmtDate(selSlot.date)} · {selSlot.start_time.slice(0,5)}–{selSlot.end_time.slice(0,5)}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-sm text-ink-500">{selSlot.filled}/{selSlot.max_bookings} peserta</span>
                      {selSlot.price > 0 && <span className="text-sm text-ink-400">· 50ml {fmtRp(selSlot.price)}</span>}
                      {selSlot.price_100ml > 0 && <span className="text-sm text-ink-400">· 100ml {fmtRp(selSlot.price_100ml)}</span>}
                      {selSlot.price_kids > 0 && <span className="text-sm text-ink-400">· Kids {fmtRp(selSlot.price_kids)}</span>}
                      {selSlot.filled >= selSlot.max_bookings && (
                        <span className="text-[11px] font-bold bg-danger-bg text-danger px-1.5 py-0.5 rounded-full">PENUH</span>
                      )}
                    </div>
                    {/* Ringkasan botol per ukuran dari booking aktif */}
                    {(() => {
                      const active = bookings.filter(b => b.status === 'confirmed' || b.status === 'pending_payment')
                      const total50   = active.reduce((s, b) => s + (b.qty_50ml  ?? 0), 0)
                      const total100  = active.reduce((s, b) => s + (b.qty_100ml ?? 0), 0)
                      const totalKids = active.reduce((s, b) => s + (b.qty_kids  ?? 0), 0)
                      if (total50 + total100 + totalKids === 0) return null
                      return (
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {total50 > 0 && (
                            <span className="text-[11px] font-medium bg-sand-100 text-ink-600 px-2 py-0.5 rounded-full">
                              {total50} botol 50ml
                            </span>
                          )}
                          {total100 > 0 && (
                            <span className="text-[11px] font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                              {total100} botol 100ml
                            </span>
                          )}
                          {totalKids > 0 && (
                            <span className="text-[11px] font-medium bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                              {totalKids} Kids 35ml
                            </span>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                  <button onClick={() => deactivateSlot(selSlot.id)}
                    className="text-xs px-2.5 py-1 rounded-lg border border-danger-bd text-danger hover:bg-danger-bg transition-colors">
                    Nonaktifkan
                  </button>
                </div>

                {/* Booking list */}
                {bookingsLoading ? (
                  <p className="p-6 text-sm text-ink-400 text-center">Memuat...</p>
                ) : bookings.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-ink-400">Belum ada booking untuk sesi ini</p>
                  </div>
                ) : (
                  <div className="divide-y divide-line">
                    {bookings.map(b => {
                      const isActive = b.status === 'confirmed' || b.status === 'pending_payment'
                      return (
                        <div key={b.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            {/* Left: info */}
                            <div className="flex items-start gap-3 min-w-0">
                              <span className={[
                                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5',
                                b.status === 'confirmed' ? 'bg-pine text-white' :
                                b.status === 'pending_payment' ? 'bg-amber-100 text-amber-700' :
                                'bg-sand-200 text-ink-400'
                              ].join(' ')}>
                                {b.queue_number}
                              </span>
                              <div className="min-w-0 space-y-0.5">
                                {/* Nama + breakdown per size */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className={`text-sm font-semibold ${!isActive ? 'text-ink-400 line-through' : 'text-ink-900'}`}>
                                    {b.customer_name}
                                  </p>
                                  {b.qty > 0 && (
                                    <span className="text-[10px] font-semibold bg-pine-50 text-pine px-1.5 py-0.5 rounded-full">
                                      {b.qty} orang
                                    </span>
                                  )}
                                </div>
                                {/* Breakdown size */}
                                {(b.qty_50ml > 0 || b.qty_100ml > 0 || b.qty_kids > 0) && (
                                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                    {b.qty_50ml > 0 && (
                                      <span className="text-[10px] font-medium bg-sand-100 text-ink-600 px-1.5 py-0.5 rounded-full">
                                        {b.qty_50ml}× 50ml
                                      </span>
                                    )}
                                    {b.qty_100ml > 0 && (
                                      <span className="text-[10px] font-medium bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">
                                        {b.qty_100ml}× 100ml
                                      </span>
                                    )}
                                    {b.qty_kids > 0 && (
                                      <span className="text-[10px] font-medium bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">
                                        {b.qty_kids}× Kids
                                      </span>
                                    )}
                                  </div>
                                )}
                                {/* Kontak */}
                                <p className="text-xs text-ink-600">{b.customer_phone}</p>
                                {b.customer_email && (
                                  <p className="text-xs text-ink-400">{b.customer_email}</p>
                                )}
                                {/* Nominal */}
                                {b.amount > 0 && (
                                  <p className={`text-xs font-medium ${b.status === 'confirmed' ? 'text-success' : 'text-ink-500'}`}>
                                    {fmtRp(b.amount)}
                                    {b.status === 'confirmed' && b.paid_at && (
                                      <span className="font-normal text-ink-400"> · Lunas {new Date(b.paid_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                                    )}
                                    {b.status === 'pending_payment' && b.expires_at && (
                                      <span className="font-normal text-amber-600"> · Exp {new Date(b.expires_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                                    )}
                                  </p>
                                )}
                                {/* Catatan */}
                                {b.notes && (
                                  <p className="text-xs text-ink-400 italic">"{b.notes}"</p>
                                )}
                                {/* Waktu booking */}
                                <p className="text-[10px] text-ink-300">
                                  Daftar {new Date(b.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                            {/* Right: status + aksi */}
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <StatusBadge status={b.status} />
                              <div className="flex gap-1.5">
                                {b.status === 'pending_payment' && (
                                  <button onClick={() => confirmBooking(b.id)}
                                    className="text-xs px-2 py-1 rounded-lg border border-success-bd text-success hover:bg-success-bg transition-colors">
                                    Konfirmasi
                                  </button>
                                )}
                                {(b.status === 'confirmed' || b.status === 'pending_payment') && (
                                  <button onClick={() => cancelBooking(b.id)}
                                    className="text-xs px-2 py-1 rounded-lg border border-danger-bd text-danger hover:bg-danger-bg transition-colors">
                                    Batalkan
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal: Generate Jadwal ────────────────────────────────────── */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-line">
              <h2 className="font-semibold text-ink-900">Generate Jadwal Otomatis</h2>
              <p className="text-xs text-ink-400 mt-0.5">Buat slot otomatis 4 sesi/hari (09–11, 12–15, 15–18, 18–21)</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-pine-50 border border-pine-100 rounded-xl p-3 space-y-1">
                <p className="text-xs font-semibold text-pine mb-2">Sesi yang akan dibuat per hari:</p>
                {DEFAULT_SESSIONS.map(s => (
                  <div key={s.start_time} className="flex items-center gap-2 text-xs text-pine">
                    <span className="w-14 font-medium">{s.label}</span>
                    <span>{s.start_time} – {s.end_time}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-ink-600 block mb-1">Dari tanggal</label>
                  <input type="date" value={genFrom} onChange={e => setGenFrom(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-600 block mb-1">Sampai tanggal</label>
                  <input type="date" value={genTo} onChange={e => setGenTo(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-ink-600 block mb-1">Kapasitas per sesi</label>
                <input type="number" min={1} max={50} value={genMaxBook}
                  onChange={e => setGenMaxBook(parseInt(e.target.value) || 16)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-600 block mb-1">Harga per orang</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] text-ink-400 mb-1">50ml (Rp)</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={genPrice50}
                      onChange={e => {
                        const v = e.target.value.replace(/[^0-9]/g, '')
                        setGenPrice50(v === '' ? '' : String(parseInt(v, 10)))
                      }}
                      className={inputCls}
                      placeholder="285000"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-ink-400 mb-1">100ml (Rp)</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={genPrice100}
                      onChange={e => {
                        const v = e.target.value.replace(/[^0-9]/g, '')
                        setGenPrice100(v === '' ? '' : String(parseInt(v, 10)))
                      }}
                      className={inputCls}
                      placeholder="450000"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-ink-400 mb-1">Kids 35ml (Rp)</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={genPriceKids}
                      onChange={e => {
                        const v = e.target.value.replace(/[^0-9]/g, '')
                        setGenPriceKids(v === '' ? '' : String(parseInt(v, 10)))
                      }}
                      className={inputCls}
                      placeholder="200000"
                    />
                  </div>
                </div>
              </div>
              {generateResult && (
                <div className="bg-success-bg border border-success-bd rounded-xl px-4 py-3 text-sm">
                  <p className="font-semibold text-success">{generateResult.created} slot berhasil dibuat</p>
                  {generateResult.skipped > 0 && (
                    <p className="text-xs text-ink-500 mt-0.5">{generateResult.skipped} slot sudah ada, dilewati</p>
                  )}
                </div>
              )}
              {generateErr && (
                <p className="text-sm text-danger bg-danger-bg border border-danger-bd rounded-xl px-4 py-3">{generateErr}</p>
              )}
            </div>
            <div className="px-6 pb-5 flex gap-2">
              <button onClick={() => { setShowGenerate(false); setGenerateResult(null) }} disabled={generating}
                className="flex-1 h-10 rounded-lg border border-line text-sm font-medium text-ink-700 hover:bg-sand-50 transition-colors">
                {generateResult ? 'Tutup' : 'Batal'}
              </button>
              {!generateResult && (
                <button onClick={generateSlots} disabled={generating}
                  className="flex-1 h-10 rounded-lg bg-pine text-white text-sm font-medium hover:bg-pine-600 disabled:opacity-50 transition-colors">
                  {generating ? 'Membuat...' : 'Generate'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Buat Slot Satuan ───────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-line">
              <h2 className="font-semibold text-ink-900">Buat Slot Satuan</h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-ink-600 block mb-1">Tanggal</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-ink-600 block mb-1">Mulai</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-600 block mb-1">Selesai</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-ink-600 block mb-1">Kapasitas</label>
                <input type="number" min={1} max={50} value={form.max_bookings}
                  onChange={e => setForm(f => ({ ...f, max_bookings: parseInt(e.target.value) || 16 }))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-600 block mb-1">Harga per orang</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] text-ink-400 mb-1">50ml (Rp)</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formPrice50}
                      onChange={e => {
                        const v = e.target.value.replace(/[^0-9]/g, '')
                        setFormPrice50(v === '' ? '' : String(parseInt(v, 10)))
                      }}
                      className={inputCls}
                      placeholder="285000"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-ink-400 mb-1">100ml (Rp)</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formPrice100}
                      onChange={e => {
                        const v = e.target.value.replace(/[^0-9]/g, '')
                        setFormPrice100(v === '' ? '' : String(parseInt(v, 10)))
                      }}
                      className={inputCls}
                      placeholder="450000"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-ink-400 mb-1">Kids 35ml (Rp)</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formPriceKids}
                      onChange={e => {
                        const v = e.target.value.replace(/[^0-9]/g, '')
                        setFormPriceKids(v === '' ? '' : String(parseInt(v, 10)))
                      }}
                      className={inputCls}
                      placeholder="200000"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-ink-600 block mb-1">Catatan (opsional)</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Sesi khusus kelompok" className={inputCls} />
              </div>
              {createErr && (
                <p className="text-sm text-danger bg-danger-bg border border-danger-bd rounded-lg px-3 py-2">{createErr}</p>
              )}
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button onClick={() => setShowCreate(false)} disabled={creating}
                className="flex-1 h-10 rounded-lg border border-line text-sm font-medium text-ink-700 hover:bg-sand-50 transition-colors">
                Batal
              </button>
              <button onClick={createSlot} disabled={creating}
                className="flex-1 h-10 rounded-lg bg-pine text-white text-sm font-medium hover:bg-pine-600 disabled:opacity-50 transition-colors">
                {creating ? 'Menyimpan...' : 'Buat Slot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
