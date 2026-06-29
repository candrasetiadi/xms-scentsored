'use client'

import { useState, useEffect } from 'react'

interface Branch { id: string; name: string }

interface Slot {
  id:           string
  branch_id:    string
  branch_name:  string
  date:         string
  start_time:   string
  end_time:     string
  max_bookings: number
  filled:       number
  available:    number
  notes:        string | null
}

type Step = 'branch' | 'slot' | 'form' | 'success'

interface BookingResult {
  booking_id:   string
  queue_number: number
  slot_date:    string
  start_time:   string
  end_time:     string
}

const DAYS_LONG   = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return `${DAYS_LONG[dt.getDay()]}, ${dt.getDate()} ${MONTHS_LONG[dt.getMonth()]} ${dt.getFullYear()}`
}

export function BookingClient({ branches }: { branches: Branch[] }) {
  const [step,           setStep]           = useState<Step>('branch')
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [slots,          setSlots]          = useState<Slot[]>([])
  const [slotsLoading,   setSlotsLoading]   = useState(false)
  const [selectedSlot,   setSelectedSlot]   = useState<Slot | null>(null)

  // Form state
  const [name,   setName]   = useState('')
  const [phone,  setPhone]  = useState('')
  const [email,  setEmail]  = useState('')
  const [notes,  setNotes]  = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formErr,    setFormErr]    = useState('')
  const [result,     setResult]     = useState<BookingResult | null>(null)

  useEffect(() => {
    if (!selectedBranch) return
    setSlotsLoading(true)
    const from = new Date().toISOString().slice(0, 10)
    const to   = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10)
    fetch(`/api/v1/consultation-slots?branch_id=${selectedBranch.id}&from=${from}&to=${to}`)
      .then(r => r.json())
      .then(j => { setSlots(j.data ?? []); setSlotsLoading(false) })
      .catch(() => setSlotsLoading(false))
  }, [selectedBranch])

  async function handleSubmit() {
    if (!selectedSlot || !name.trim() || !phone.trim()) {
      setFormErr('Nama dan nomor HP wajib diisi.')
      return
    }
    setSubmitting(true)
    setFormErr('')

    const res  = await fetch('/api/v1/bookings', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slot_id:        selectedSlot.id,
        customer_name:  name.trim(),
        customer_phone: phone.trim(),
        customer_email: email.trim() || undefined,
        notes:          notes.trim() || undefined,
      }),
    })
    const json = await res.json()
    setSubmitting(false)

    if (!res.ok) { setFormErr(json.error?.message ?? 'Gagal booking. Coba lagi.'); return }

    setResult(json.data)
    setStep('success')
  }

  function reset() {
    setStep('branch'); setSelectedBranch(null); setSelectedSlot(null)
    setSlots([]); setName(''); setPhone(''); setEmail(''); setNotes('')
    setResult(null); setFormErr('')
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const inputCls = 'w-full rounded-xl px-4 py-3 text-sm border outline-none focus:ring-2 focus:ring-pine-200 focus:border-pine'

  return (
    <div className="min-h-screen bg-sand-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-line px-4 py-4">
        <p className="font-display text-xl text-pine">Scentsored</p>
        <p className="text-xs text-ink-500 mt-0.5">Booking Konsultasi Racik Parfum</p>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">

          {/* Step: Branch */}
          {step === 'branch' && (
            <div className="space-y-4">
              <div>
                <h1 className="font-semibold text-lg text-ink-900">Pilih Cabang</h1>
                <p className="text-sm text-ink-500 mt-1">Di mana kamu ingin konsultasi?</p>
              </div>
              <div className="space-y-2">
                {branches.map(b => (
                  <button key={b.id}
                    onClick={() => { setSelectedBranch(b); setStep('slot') }}
                    className="w-full text-left rounded-xl border border-line bg-white px-4 py-4 hover:border-pine-200 hover:bg-pine-50 transition-all">
                    <p className="font-medium text-ink-900">{b.name}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step: Slot */}
          {step === 'slot' && selectedBranch && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setStep('branch')} className="text-ink-400 hover:text-ink-700">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h1 className="font-semibold text-lg text-ink-900">Pilih Jadwal</h1>
                  <p className="text-sm text-ink-500">{selectedBranch.name}</p>
                </div>
              </div>

              {slotsLoading ? (
                <p className="text-center text-sm text-ink-400 py-8">Memuat jadwal...</p>
              ) : slots.length === 0 ? (
                <div className="bg-white rounded-xl border border-line p-8 text-center">
                  <p className="text-ink-500 text-sm">Tidak ada jadwal tersedia dalam 30 hari ke depan.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {slots.map(slot => {
                    const full = slot.available <= 0
                    return (
                      <button key={slot.id}
                        disabled={full}
                        onClick={() => { setSelectedSlot(slot); setStep('form') }}
                        className={`w-full text-left rounded-xl border bg-white px-4 py-4 transition-all ${
                          full
                            ? 'opacity-50 cursor-not-allowed border-line'
                            : 'hover:border-pine-200 hover:bg-pine-50 border-line'
                        }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-ink-900 text-sm">{fmtDate(slot.date)}</p>
                            <p className="text-xs text-ink-500 mt-0.5">
                              {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                            </p>
                            {slot.notes && <p className="text-xs text-ink-400 mt-1">{slot.notes}</p>}
                          </div>
                          <span className={`flex-shrink-0 text-xs font-medium px-2 py-1 rounded-full ${
                            full
                              ? 'bg-danger-bg text-danger'
                              : slot.available <= 2
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-success-bg text-success'
                          }`}>
                            {full ? 'Penuh' : `${slot.available} kursi tersisa`}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step: Form */}
          {step === 'form' && selectedSlot && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setStep('slot')} className="text-ink-400 hover:text-ink-700">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h1 className="font-semibold text-lg text-ink-900">Isi Data Diri</h1>
                  <p className="text-sm text-ink-500">
                    {fmtDate(selectedSlot.date)} · {selectedSlot.start_time.slice(0, 5)} – {selectedSlot.end_time.slice(0, 5)}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-line p-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-ink-500 block mb-1">Nama Lengkap *</label>
                  <input
                    value={name} onChange={e => setName(e.target.value)}
                    placeholder="Nama kamu"
                    className={inputCls + ' border-line text-ink-900 bg-white'}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-500 block mb-1">Nomor HP *</label>
                  <input
                    value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    type="tel"
                    className={inputCls + ' border-line text-ink-900 bg-white'}
                  />
                  <p className="text-xs text-ink-400 mt-1">Konfirmasi dikirim via WhatsApp</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-500 block mb-1">Email (opsional)</label>
                  <input
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="email@kamu.com"
                    type="email"
                    className={inputCls + ' border-line text-ink-900 bg-white'}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-500 block mb-1">Catatan (opsional)</label>
                  <textarea
                    value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Ada preferensi aroma atau request khusus?"
                    rows={3}
                    className={inputCls + ' border-line text-ink-900 bg-white resize-none'}
                  />
                </div>

                {formErr && (
                  <p className="text-xs text-danger bg-danger-bg border border-danger-bd rounded-lg px-3 py-2">{formErr}</p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full h-12 rounded-xl bg-pine text-white font-semibold text-sm hover:bg-pine-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Memproses...' : 'Konfirmasi Booking'}
                </button>
              </div>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && result && selectedSlot && (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-success-bg border border-success-bd flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div>
                <h1 className="font-semibold text-xl text-ink-900">Booking Berhasil!</h1>
                <p className="text-sm text-ink-500 mt-1">Konfirmasi dikirim via WhatsApp ke nomor kamu.</p>
              </div>

              <div className="bg-white rounded-xl border border-line p-6 space-y-3 text-left">
                <div className="flex justify-between text-sm">
                  <span className="text-ink-500">No. Urut</span>
                  <span className="font-bold text-pine text-lg">#{result.queue_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-500">Tanggal</span>
                  <span className="font-medium text-ink-900">{fmtDate(result.slot_date)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-500">Waktu</span>
                  <span className="font-medium text-ink-900">
                    {result.start_time.slice(0, 5)} – {result.end_time.slice(0, 5)}
                  </span>
                </div>
                {selectedBranch && (
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-500">Cabang</span>
                    <span className="font-medium text-ink-900">{selectedBranch.name}</span>
                  </div>
                )}
              </div>

              <button onClick={reset}
                className="w-full h-11 rounded-xl border border-line text-ink-700 text-sm hover:bg-sand-100 transition-colors">
                Booking Lagi
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
