'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface Branch { id: string; name: string }

interface Slot {
  id:           string
  branch_id:    string
  branch_name:  string
  date:         string
  start_time:   string
  end_time:     string
  max_bookings: number
  price:        number
  filled:       number
  available:    number
  notes:        string | null
}

interface BookingResult {
  booking_id:   string
  queue_number: number
  slot_date:    string
  start_time:   string
  end_time:     string
  qty:          number
  price:        number
  amount:       number
  expires_at:   string | null
  qris:         { qr_string: string; expire_time: string } | null
}

type Step = 'branch' | 'slot' | 'form' | 'payment' | 'success' | 'expired'

const DAYS_LONG   = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const _numFmt     = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return `${DAYS_LONG[dt.getDay()]}, ${dt.getDate()} ${MONTHS_LONG[dt.getMonth()]} ${dt.getFullYear()}`
}
function fmtRp(n: number) { return 'Rp ' + _numFmt.format(Math.round(n)) }
function fmtTime(s: string) { return s.slice(0, 5) }

function useCountdown(expiresAt: string | null) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0)

  useEffect(() => {
    if (!expiresAt) return
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
      setSecondsLeft(diff)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')
  return { secondsLeft, display: `${mm}:${ss}` }
}

export function BookingClient({ branches }: { branches: Branch[] }) {
  const [step,           setStep]           = useState<Step>('branch')
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [slots,          setSlots]          = useState<Slot[]>([])
  const [slotsLoading,   setSlotsLoading]   = useState(false)
  const [selectedSlot,   setSelectedSlot]   = useState<Slot | null>(null)

  // Form state
  const [name,       setName]       = useState('')
  const [phone,      setPhone]      = useState('')
  const [email,      setEmail]      = useState('')
  const [notes,      setNotes]      = useState('')
  const [qty,        setQty]        = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [formErr,    setFormErr]    = useState('')
  const [result,     setResult]     = useState<BookingResult | null>(null)

  // Payment polling
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { secondsLeft, display: countdownDisplay } = useCountdown(result?.expires_at ?? null)

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

  // Reset qty jika slot berubah
  useEffect(() => { setQty(1) }, [selectedSlot])

  // Auto-expire UI jika countdown habis
  useEffect(() => {
    if (step === 'payment' && secondsLeft === 0 && result?.expires_at) {
      stopPolling()
      setStep('expired')
    }
  }, [secondsLeft, step, result])

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
  }, [])

  const startPolling = useCallback((bookingId: string) => {
    stopPolling()
    pollingRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/v1/bookings/${bookingId}/payment-status`)
        const json = await res.json()
        const s    = json.data?.status
        if (s === 'confirmed') { stopPolling(); setStep('success') }
        if (s === 'expired' || s === 'cancelled') { stopPolling(); setStep('expired') }
      } catch { /* silent */ }
    }, 3000)
  }, [stopPolling])

  useEffect(() => () => stopPolling(), [stopPolling])

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
        qty,
        notes:          notes.trim() || undefined,
      }),
    })
    const json = await res.json()
    setSubmitting(false)

    if (!res.ok) { setFormErr(json.error?.message ?? 'Gagal booking. Coba lagi.'); return }

    setResult(json.data)

    // Jika gratis (amount = 0 atau expires_at null) → langsung sukses
    if (!json.data.expires_at || json.data.amount === 0) {
      setStep('success')
    } else {
      setStep('payment')
      startPolling(json.data.booking_id)
    }
  }

  function reset() {
    stopPolling()
    setStep('branch'); setSelectedBranch(null); setSelectedSlot(null)
    setSlots([]); setName(''); setPhone(''); setEmail(''); setNotes(''); setQty(1)
    setResult(null); setFormErr('')
  }

  const inputCls = 'w-full rounded-xl px-4 py-3 text-sm border outline-none focus:ring-2 focus:ring-pine-200 focus:border-pine border-line text-ink-900 bg-white'

  const totalAmount = selectedSlot ? selectedSlot.price * qty : 0

  return (
    <div className="min-h-screen bg-sand-50 flex flex-col">
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
                              {fmtTime(slot.start_time)} – {fmtTime(slot.end_time)}
                            </p>
                            {slot.price > 0 && (
                              <p className="text-xs text-pine font-medium mt-1">{fmtRp(slot.price)} / orang</p>
                            )}
                            {slot.notes && <p className="text-xs text-ink-400 mt-1">{slot.notes}</p>}
                          </div>
                          <span className={`flex-shrink-0 text-xs font-medium px-2 py-1 rounded-full ${
                            full
                              ? 'bg-danger-bg text-danger'
                              : slot.available <= 3
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-success-bg text-success'
                          }`}>
                            {full ? 'Penuh' : `${slot.available} tersisa`}
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
                    {fmtDate(selectedSlot.date)} · {fmtTime(selectedSlot.start_time)} – {fmtTime(selectedSlot.end_time)}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-line p-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-ink-500 block mb-1">Nama Lengkap *</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama kamu" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-500 block mb-1">Nomor HP *</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" type="tel" className={inputCls} />
                  <p className="text-xs text-ink-400 mt-1">Konfirmasi dikirim via WhatsApp</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-500 block mb-1">Email (opsional)</label>
                  <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@kamu.com" type="email" className={inputCls} />
                </div>

                {/* Jumlah orang */}
                <div>
                  <label className="text-xs font-medium text-ink-500 block mb-1">Jumlah Orang *</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQty(q => Math.max(1, q - 1))}
                      className="w-10 h-10 rounded-xl border border-line bg-sand-50 flex items-center justify-center text-ink-700 hover:bg-sand-100 disabled:opacity-30 transition-colors"
                      disabled={qty <= 1}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                      </svg>
                    </button>
                    <span className="w-8 text-center font-semibold text-ink-900 text-lg">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(q => Math.min(selectedSlot.available, q + 1))}
                      className="w-10 h-10 rounded-xl border border-line bg-sand-50 flex items-center justify-center text-ink-700 hover:bg-sand-100 disabled:opacity-30 transition-colors"
                      disabled={qty >= selectedSlot.available}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    <span className="text-xs text-ink-400">(maks. {selectedSlot.available} orang)</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-ink-500 block mb-1">Catatan (opsional)</label>
                  <textarea
                    value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Ada preferensi aroma atau request khusus?"
                    rows={3}
                    className={inputCls + ' resize-none'}
                  />
                </div>

                {/* Ringkasan harga */}
                {selectedSlot.price > 0 && (
                  <div className="rounded-xl bg-sand-50 border border-line px-4 py-3 space-y-1">
                    <div className="flex justify-between text-sm text-ink-500">
                      <span>{fmtRp(selectedSlot.price)} × {qty} orang</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold text-ink-900">
                      <span>Total</span>
                      <span className="text-pine">{fmtRp(totalAmount)}</span>
                    </div>
                  </div>
                )}

                {formErr && (
                  <p className="text-xs text-danger bg-danger-bg border border-danger-bd rounded-lg px-3 py-2">{formErr}</p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full h-12 rounded-xl bg-pine text-white font-semibold text-sm hover:bg-pine-700 disabled:opacity-50 transition-colors">
                  {submitting ? 'Memproses...' : selectedSlot.price > 0 ? `Lanjut Bayar · ${fmtRp(totalAmount)}` : 'Konfirmasi Booking'}
                </button>
              </div>
            </div>
          )}

          {/* Step: Payment (QRIS) */}
          {step === 'payment' && result && (
            <div className="space-y-4">
              <div className="text-center">
                <h1 className="font-semibold text-lg text-ink-900">Selesaikan Pembayaran</h1>
                <p className="text-sm text-ink-500 mt-1">Scan QR code di bawah ini</p>
              </div>

              {/* Countdown */}
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" />
                </svg>
                <span className={`font-mono font-semibold text-lg ${secondsLeft <= 60 ? 'text-danger' : 'text-amber-600'}`}>
                  {countdownDisplay}
                </span>
                <span className="text-xs text-ink-400">tersisa</span>
              </div>

              {/* QR Code */}
              {result.qris ? (
                <div className="bg-white rounded-2xl border border-line p-6 flex flex-col items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(result.qris.qr_string)}`}
                    alt="QR Code pembayaran"
                    width={220}
                    height={220}
                    className="rounded-xl"
                  />
                  <p className="text-xs text-ink-400 text-center">Scan menggunakan GoPay, OVO, Dana, atau aplikasi bank apapun</p>
                  <div className="w-full rounded-xl bg-sand-50 border border-line px-4 py-3 flex justify-between text-sm">
                    <span className="text-ink-500">Total Bayar</span>
                    <span className="font-bold text-pine">{fmtRp(result.amount)}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-line p-8 text-center space-y-2">
                  <p className="text-sm text-ink-500">Pembayaran belum tersedia secara online.</p>
                  <p className="text-sm text-ink-500">Silakan hubungi kami untuk konfirmasi manual.</p>
                  <p className="font-semibold text-pine">{fmtRp(result.amount)}</p>
                </div>
              )}

              {/* Booking summary kecil */}
              <div className="bg-white rounded-xl border border-line px-4 py-3 space-y-1">
                <div className="flex justify-between text-xs text-ink-500">
                  <span>No. Antrian</span>
                  <span className="font-semibold text-ink-900">#{result.queue_number}</span>
                </div>
                <div className="flex justify-between text-xs text-ink-500">
                  <span>Jumlah</span>
                  <span className="font-semibold text-ink-900">{result.qty} orang</span>
                </div>
              </div>

              <p className="text-xs text-center text-ink-400">
                Status pembayaran diperbarui otomatis. Jangan tutup halaman ini.
              </p>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && result && (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-success-bg border border-success-bd flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div>
                <h1 className="font-semibold text-xl text-ink-900">
                  {result.amount > 0 ? 'Pembayaran Berhasil!' : 'Booking Berhasil!'}
                </h1>
                <p className="text-sm text-ink-500 mt-1">Konfirmasi dikirim via WhatsApp ke nomor kamu.</p>
              </div>

              <div className="bg-white rounded-xl border border-line p-6 space-y-3 text-left">
                <div className="flex justify-between text-sm">
                  <span className="text-ink-500">No. Antrian</span>
                  <span className="font-bold text-pine text-lg">#{result.queue_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-500">Tanggal</span>
                  <span className="font-medium text-ink-900">{fmtDate(result.slot_date)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-500">Waktu</span>
                  <span className="font-medium text-ink-900">{fmtTime(result.start_time)} – {fmtTime(result.end_time)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-500">Jumlah</span>
                  <span className="font-medium text-ink-900">{result.qty} orang</span>
                </div>
                {result.amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-500">Dibayar</span>
                    <span className="font-medium text-success">{fmtRp(result.amount)}</span>
                  </div>
                )}
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

          {/* Step: Expired */}
          {step === 'expired' && (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-danger-bg border border-danger-bd flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                </svg>
              </div>

              <div>
                <h1 className="font-semibold text-xl text-ink-900">Waktu Pembayaran Habis</h1>
                <p className="text-sm text-ink-500 mt-1">
                  Booking dibatalkan karena pembayaran tidak selesai tepat waktu. Slot kembali tersedia.
                </p>
              </div>

              <button onClick={reset}
                className="w-full h-12 rounded-xl bg-pine text-white font-semibold text-sm hover:bg-pine-700 transition-colors">
                Coba Lagi
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
