'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useToast }    from '@/components/hr/Toast'
import { StatusBadge } from '@/components/hr/StatusBadge'
import { BottomSheet } from '@/components/hr/BottomSheet'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TodayData {
  shift_name:     string | null
  shift_start:    string | null
  shift_end:      string | null
  status:         string
  clock_in_at:    string | null
  clock_out_at:   string | null
  worked_minutes: number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(v: string | null): string {
  if (!v) return '–'
  if (v.includes('T') || v.includes(' '))
    return new Date(v).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  return v.slice(0, 5)
}

function formatWorked(minutes: number | null): string {
  if (!minutes || minutes <= 0) return '–'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} jam` : `${h}j ${m}m`
}

function getLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Perangkat ini tidak mendukung GPS.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      err => {
        if (err.code === err.PERMISSION_DENIED)
          reject(new Error('Izin lokasi ditolak. Aktifkan izin lokasi di browser.'))
        else if (err.code === err.POSITION_UNAVAILABLE)
          reject(new Error('Lokasi tidak tersedia. Pastikan GPS aktif.'))
        else
          reject(new Error('Gagal mendapatkan lokasi. Coba lagi.'))
      },
      { timeout: 10000, maximumAge: 0, enableHighAccuracy: true },
    )
  })
}

// ── Widget ────────────────────────────────────────────────────────────────────

export function AttendanceWidget() {
  const { showToast } = useToast()

  const [today,      setToday]      = useState<TodayData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const fetchToday = useCallback(async () => {
    try {
      const res  = await fetch('/api/v1/hr/attendance')
      const json = await res.json()
      if (res.ok) setToday(json.data?.today ?? null)
    } catch { /* silent — widget non-critical */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchToday() }, [fetchToday])

  async function handleClockIn() {
    setGeoLoading(true)
    let coords: { latitude: number; longitude: number }
    try {
      coords = await getLocation()
    } catch (e) {
      showToast((e as Error).message, 'error')
      setGeoLoading(false)
      return
    }
    setGeoLoading(false)
    setSubmitting(true)
    try {
      const res  = await fetch('/api/v1/hr/attendance/clock-in', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(coords),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal clock in.', 'error'); return }
      showToast(`Clock in berhasil pukul ${formatTime(json.data?.clock_in_at)}`)
      await fetchToday()
    } catch {
      showToast('Koneksi gagal. Coba lagi.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleClockOut() {
    setShowConfirm(false)
    setGeoLoading(true)
    let coords: { latitude: number; longitude: number }
    try {
      coords = await getLocation()
    } catch (e) {
      showToast((e as Error).message, 'error')
      setGeoLoading(false)
      return
    }
    setGeoLoading(false)
    setSubmitting(true)
    try {
      const res  = await fetch('/api/v1/hr/attendance/clock-out', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(coords),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal clock out.', 'error'); return }
      showToast(`Clock out berhasil pukul ${formatTime(json.data?.clock_out_at)}`)
      await fetchToday()
    } catch {
      showToast('Koneksi gagal. Coba lagi.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const clockedIn  = Boolean(today?.clock_in_at)
  const clockedOut = Boolean(today?.clock_out_at)
  const busy       = submitting || geoLoading

  // ── Skeleton ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-white border border-line rounded-xl p-4 shadow-sm animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="h-2.5 w-28 bg-sand-200 rounded" />
          <div className="h-5 w-16 bg-sand-200 rounded-full" />
        </div>
        <div className="h-2.5 w-40 bg-sand-100 rounded mb-3" />
        <div className="h-10 w-full bg-sand-100 rounded-xl" />
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="bg-white border border-line rounded-xl p-4 shadow-sm">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[.18em] text-ink-400">
            Absensi Hari Ini
          </p>
          <div className="flex items-center gap-2">
            <StatusBadge status={today?.status ?? 'absent'} />
            <Link
              href="/hr/attendance"
              className="font-sans text-[11px] text-pine hover:underline underline-offset-2"
            >
              Detail →
            </Link>
          </div>
        </div>

        {/* Shift info */}
        <p className="font-sans text-xs text-ink-500 mb-3">
          {today?.shift_name
            ? `${today.shift_name} · ${formatTime(today.shift_start)}–${formatTime(today.shift_end)}`
            : 'Tidak ada shift hari ini'}
        </p>

        {/* Clock times */}
        {clockedIn && (
          <div className="flex gap-5 mb-3">
            <div>
              <p className="font-sans text-[10px] text-ink-400 mb-0.5">Masuk</p>
              <p className="font-sans text-sm font-semibold tabular-nums text-ink-900">
                {formatTime(today?.clock_in_at ?? null)}
              </p>
            </div>
            <div>
              <p className="font-sans text-[10px] text-ink-400 mb-0.5">Keluar</p>
              <p className="font-sans text-sm font-semibold tabular-nums text-ink-900">
                {formatTime(today?.clock_out_at ?? null)}
              </p>
            </div>
            {clockedOut && (
              <div>
                <p className="font-sans text-[10px] text-ink-400 mb-0.5">Durasi</p>
                <p className="font-sans text-sm font-semibold tabular-nums text-ink-900">
                  {formatWorked(today?.worked_minutes ?? null)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        {clockedOut ? (
          <div className="w-full bg-sand-100 rounded-xl py-3 text-center font-sans text-sm text-ink-500">
            Selesai untuk hari ini ✓
          </div>
        ) : clockedIn ? (
          <button
            onClick={() => setShowConfirm(true)}
            disabled={busy}
            className="w-full bg-rust text-white rounded-xl py-3 font-sans text-sm font-semibold hover:bg-rust-600 active:scale-[.98] transition-all disabled:opacity-45 flex items-center justify-center gap-2"
          >
            {busy && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {geoLoading ? 'Mengambil lokasi…' : 'Clock Out'}
          </button>
        ) : (
          <button
            onClick={handleClockIn}
            disabled={busy}
            className="w-full bg-pine text-white rounded-xl py-3 font-sans text-sm font-semibold hover:bg-pine-700 active:scale-[.98] transition-all disabled:opacity-45 flex items-center justify-center gap-2"
          >
            {busy && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {geoLoading ? 'Mengambil lokasi…' : 'Clock In'}
          </button>
        )}
      </div>

      <BottomSheet
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Konfirmasi Clock Out"
      >
        <p className="font-sans text-sm text-ink-500 mb-4">
          Yakin ingin clock out sekarang? Pukul{' '}
          {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowConfirm(false)}
            className="flex-1 border border-line-strong text-ink-700 rounded-xl py-3 font-sans text-sm font-medium hover:bg-sand-50 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleClockOut}
            className="flex-1 bg-pine text-white rounded-xl py-3 font-sans text-sm font-semibold hover:bg-pine-700 transition-colors"
          >
            Ya, Clock Out
          </button>
        </div>
      </BottomSheet>
    </>
  )
}
