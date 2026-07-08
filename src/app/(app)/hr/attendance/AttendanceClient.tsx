'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { SectionHeader }  from '@/components/hr/SectionHeader'
import { StatusBadge }    from '@/components/hr/StatusBadge'
import { EmptyState }     from '@/components/hr/EmptyState'
import { BottomSheet }    from '@/components/hr/BottomSheet'
import { useToast }       from '@/components/hr/Toast'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AttendanceRecord {
  id:            string
  date:          string
  clock_in_at:   string | null
  clock_out_at:  string | null
  status:        string
  shift_name:    string | null
  shift_start:   string | null
  shift_end:     string | null
  worked_minutes: number | null
}

interface TodayData {
  shift_name:  string | null
  shift_start: string | null
  shift_end:   string | null
  status:      string
  clock_in_at: string | null
  clock_out_at: string | null
  attendance_id: string | null
  worked_minutes: number | null
}

interface Props {
  staffId:   string
  staffName: string
  staffRole: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(isoOrTime: string | null): string {
  if (!isoOrTime) return '–'
  // If ISO datetime
  if (isoOrTime.includes('T') || isoOrTime.includes(' ')) {
    return new Date(isoOrTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }
  return isoOrTime.slice(0, 5)
}

function formatWorked(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return '–'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `${h} jam`
  return `${h}j ${m}m`
}

function formatDate(isoDate: string): { day: string; num: string; full: string } {
  const d = new Date(isoDate)
  return {
    day:  d.toLocaleDateString('id-ID', { weekday: 'short' }),
    num:  d.getDate().toString(),
    full: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
  }
}

// ── Clock ─────────────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState('')

  useEffect(() => {
    function tick() {
      setTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <p className="text-3xl font-sans font-semibold tabular-nums text-ink-900 mb-1">{time}</p>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function StatusCardSkeleton() {
  return (
    <div className="bg-white border border-line rounded-2xl p-6 shadow-sm mb-6 motion-safe:animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1.5">
          <div className="h-3 w-20 bg-sand-100 rounded" />
          <div className="h-4 w-40 bg-sand-100 rounded" />
        </div>
        <div className="h-5 w-16 bg-sand-100 rounded-full" />
      </div>
      <div className="h-12 w-full bg-sand-100 rounded-xl" />
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function AttendanceClient({ staffId }: Props) {
  const { showToast } = useToast()

  const [today,     setToday]     = useState<TodayData | null>(null)
  const [history,   setHistory]   = useState<AttendanceRecord[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [submitting,  setSubmitting]  = useState(false)
  const [geoLoading,  setGeoLoading]  = useState(false)
  const [showClockOutConfirm, setShowClockOutConfirm] = useState(false)

  const fetchData = useCallback(async () => {
    setError(null)
    try {
      const res  = await fetch('/api/v1/hr/attendance')
      const json = await res.json()
      if (!res.ok) { setError(json.error?.message ?? 'Gagal memuat data absensi.'); return }
      setToday(json.data?.today ?? null)
      setHistory(json.data?.history ?? [])
    } catch {
      setError('Koneksi gagal. Periksa jaringan Anda.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

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
            reject(new Error('Izin lokasi ditolak. Aktifkan izin lokasi di browser untuk absen.'))
          else if (err.code === err.POSITION_UNAVAILABLE)
            reject(new Error('Lokasi tidak tersedia. Pastikan GPS aktif.'))
          else
            reject(new Error('Gagal mendapatkan lokasi. Coba lagi.'))
        },
        { timeout: 10000, maximumAge: 0, enableHighAccuracy: true },
      )
    })
  }

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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coords),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal clock in.', 'error'); return }
      showToast(`Clock in berhasil pukul ${formatTime(json.data?.clock_in_at)}`)
      await fetchData()
    } catch {
      showToast('Koneksi gagal. Coba lagi.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleClockOut() {
    setShowClockOutConfirm(false)
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coords),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal clock out.', 'error'); return }
      showToast(`Clock out berhasil pukul ${formatTime(json.data?.clock_out_at)}`)
      await fetchData()
    } catch {
      showToast('Koneksi gagal. Coba lagi.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const clockedIn  = Boolean(today?.clock_in_at)
  const clockedOut = Boolean(today?.clock_out_at)

  return (
    <div className="bg-sand-50 min-h-full p-4 md:p-6">
      <div className="max-w-xl mx-auto">

        <SectionHeader title="Kehadiran" />

        {/* Live clock */}
        <div className="text-center mb-4">
          <LiveClock />
          <p className="text-xs text-ink-500">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-danger-bg border border-danger-bd text-danger rounded-lg p-3 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Status card */}
        {loading ? <StatusCardSkeleton /> : (
          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm mb-6">

            {/* Shift info */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-sans text-ink-500 uppercase tracking-wide mb-1">Shift Hari Ini</p>
                <p className="text-sm font-sans font-semibold text-ink-900">
                  {today?.shift_name
                    ? `${today.shift_name} · ${formatTime(today.shift_start)}–${formatTime(today.shift_end)}`
                    : 'Tidak ada shift'}
                </p>
              </div>
              <StatusBadge status={today?.status ?? 'absent'} />
            </div>

            {/* Times */}
            {clockedIn && (
              <div className="flex gap-6 mb-6">
                <div>
                  <p className="text-xs text-ink-500 mb-0.5">Masuk</p>
                  <p className="text-lg font-sans font-semibold tabular-nums text-ink-900">
                    {formatTime(today?.clock_in_at ?? null)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-500 mb-0.5">Keluar</p>
                  <p className="text-lg font-sans font-semibold tabular-nums text-ink-900">
                    {formatTime(today?.clock_out_at ?? null)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-500 mb-0.5">Total</p>
                  <p className="text-lg font-sans font-semibold tabular-nums text-ink-900">
                    {clockedOut ? formatWorked(today?.worked_minutes ?? null) : '–'}
                  </p>
                </div>
              </div>
            )}

            {/* CTA Button */}
            {clockedOut ? (
              <div className="w-full bg-sand-100 rounded-xl py-4 text-center text-sm text-ink-500 font-sans">
                Selesai untuk hari ini
              </div>
            ) : clockedIn ? (
              <button
                onClick={() => setShowClockOutConfirm(true)}
                disabled={submitting || geoLoading}
                className="w-full bg-rust text-white rounded-xl py-4 text-base font-sans font-semibold hover:bg-rust-600 active:scale-[.98] motion-safe:transition-all focus-visible:outline-2 focus-visible:outline-rust focus-visible:outline-offset-2 disabled:opacity-45 min-h-[56px] flex items-center justify-center gap-2"
              >
                {(submitting || geoLoading) && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {geoLoading ? 'Mengambil lokasi…' : 'Clock Out'}
              </button>
            ) : (
              <button
                onClick={handleClockIn}
                disabled={submitting || geoLoading}
                className="w-full bg-pine text-white rounded-xl py-4 text-base font-sans font-semibold hover:bg-pine-700 active:scale-[.98] motion-safe:transition-all focus-visible:outline-2 focus-visible:outline-pine focus-visible:outline-offset-2 disabled:opacity-45 min-h-[56px] flex items-center justify-center gap-2"
              >
                {(submitting || geoLoading) && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {geoLoading ? 'Mengambil lokasi…' : 'Clock In'}
              </button>
            )}
          </div>
        )}

        {/* History */}
        <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <p className="text-sm font-sans font-semibold text-ink-900">7 Hari Terakhir</p>
          </div>

          {loading ? (
            <div className="divide-y divide-line">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between motion-safe:animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 space-y-1">
                      <div className="h-3 bg-sand-100 rounded" />
                      <div className="h-4 bg-sand-100 rounded" />
                    </div>
                    <div className="space-y-1">
                      <div className="h-4 w-32 bg-sand-100 rounded" />
                      <div className="h-3 w-20 bg-sand-100 rounded" />
                    </div>
                  </div>
                  <div className="h-5 w-16 bg-sand-100 rounded-full" />
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <EmptyState heading="Belum ada riwayat absensi" subtext="Riwayat 7 hari terakhir akan muncul di sini." />
          ) : (
            <div className="divide-y divide-line">
              {history.map(rec => {
                const dateInfo = formatDate(rec.date)
                const isPast   = new Date(rec.date) < new Date(new Date().toDateString())
                return (
                  <div key={rec.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-center w-10">
                        <p className="text-xs text-ink-500">{dateInfo.day}</p>
                        <p className="text-sm font-semibold tabular-nums text-ink-900">{dateInfo.num}</p>
                      </div>
                      <div>
                        <p className="text-sm text-ink-900 tabular-nums">
                          {formatTime(rec.clock_in_at)} – {formatTime(rec.clock_out_at)}
                        </p>
                        <p className="text-xs text-ink-500 tabular-nums">{formatWorked(rec.worked_minutes)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={rec.status} />
                      {isPast && (
                        <Link
                          href="/hr/attendance/corrections"
                          className="text-xs text-pine underline underline-offset-2 hover:no-underline"
                        >
                          Koreksi
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Clock out confirmation */}
      <BottomSheet
        open={showClockOutConfirm}
        onClose={() => setShowClockOutConfirm(false)}
        title="Konfirmasi Clock Out"
      >
        <p className="text-sm text-ink-500 mb-4">
          Yakin ingin clock out sekarang? Pukul {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowClockOutConfirm(false)}
            className="flex-1 border border-line-strong text-ink-700 rounded-xl py-3 text-sm font-sans font-medium hover:bg-sand-50 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleClockOut}
            className="flex-1 bg-pine text-white rounded-xl py-3 text-sm font-sans font-semibold hover:bg-pine-700 transition-colors"
          >
            Ya, Clock Out
          </button>
        </div>
      </BottomSheet>

      {staffId && null /* staffId used for future features */}
    </div>
  )
}
