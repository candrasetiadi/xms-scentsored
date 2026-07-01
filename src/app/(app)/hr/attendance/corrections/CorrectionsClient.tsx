'use client'

import { useState, useEffect, useCallback } from 'react'
import { SectionHeader }        from '@/components/hr/SectionHeader'
import { StatusBadge }          from '@/components/hr/StatusBadge'
import { PageTabs }             from '@/components/hr/PageTabs'
import { ApproveRejectButtons } from '@/components/hr/ApproveRejectButtons'
import { FormCard }             from '@/components/hr/FormCard'
import { EmptyState }           from '@/components/hr/EmptyState'
import { useToast }             from '@/components/hr/Toast'

// ── Types ──────────────────────────────────────────────────────────────────────

interface CorrectionRequest {
  id:              string
  date:            string
  requested_in:    string | null
  requested_out:   string | null
  reason:          string
  status:          string
  staff_name?:     string
  created_at:      string
}

interface Props {
  staffId:   string
  staffRole: string
  branchId:  string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  'w-full border border-line-strong rounded-md px-3 py-2.5 text-sm font-sans text-ink-900 bg-white ' +
  'focus:border-pine-400 focus:ring-2 focus:ring-pine-100 outline-none placeholder:text-ink-400'

const isAdminOrOwner = (role: string) => ['owner', 'admin'].includes(role)

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function CorrectionsClient({ staffId, staffRole, branchId }: Props) {
  const { showToast } = useToast()
  const isAdmin = isAdminOrOwner(staffRole)

  const [tab,           setTab]           = useState('karyawan')
  const [myList,        setMyList]        = useState<CorrectionRequest[]>([])
  const [adminList,     setAdminList]     = useState<CorrectionRequest[]>([])
  const [loading,       setLoading]       = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Form state
  const [date,         setDate]         = useState('')
  const [clockIn,      setClockIn]      = useState('')
  const [clockOut,     setClockOut]     = useState('')
  const [reason,       setReason]       = useState('')
  const [submitting,   setSubmitting]   = useState(false)

  const fetchMy = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/v1/hr/attendance-corrections')
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal memuat data.', 'error'); return }
      setMyList(json.data ?? [])
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  const fetchAdmin = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ all: '1' })
      if (branchId) params.set('branch_id', branchId)
      const res  = await fetch(`/api/v1/hr/attendance-corrections?${params}`)
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal memuat data.', 'error'); return }
      setAdminList(json.data ?? [])
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setLoading(false)
    }
  }, [isAdmin, branchId, showToast])

  useEffect(() => {
    if (tab === 'karyawan') fetchMy()
    else fetchAdmin()
  }, [tab, fetchMy, fetchAdmin])

  async function handleSubmit() {
    if (!date || !clockIn || !reason.trim()) {
      showToast('Tanggal, jam masuk, dan alasan wajib diisi.', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res  = await fetch('/api/v1/hr/attendance-corrections', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          date,
          requested_in:  clockIn  || null,
          requested_out: clockOut || null,
          reason,
        }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal mengajukan koreksi.', 'error'); return }
      showToast('Permintaan koreksi berhasil diajukan.')
      setDate(''); setClockIn(''); setClockOut(''); setReason('')
      fetchMy()
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApprove(id: string) {
    setActionLoading(id)
    try {
      const res  = await fetch(`/api/v1/hr/attendance-corrections/${id}/approve`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal menyetujui.', 'error'); return }
      showToast('Koreksi disetujui.')
      fetchAdmin()
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject(id: string) {
    setActionLoading(id)
    try {
      const res  = await fetch(`/api/v1/hr/attendance-corrections/${id}/reject`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal menolak.', 'error'); return }
      showToast('Koreksi ditolak.')
      fetchAdmin()
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const tabs = [
    { key: 'karyawan', label: 'Pengajuan Saya' },
    ...(isAdmin ? [{ key: 'admin', label: 'Semua Pengajuan' }] : []),
  ]

  return (
    <div className="bg-sand-50 min-h-full p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <SectionHeader title="Koreksi Absensi" />

        <PageTabs tabs={tabs} active={tab} onChange={setTab} />

        {/* ── Tab Karyawan ─────────────────────────────────────────────── */}
        {tab === 'karyawan' && (
          <div className="space-y-4">
            {/* Form ajukan koreksi */}
            <FormCard>
              <p className="text-sm font-semibold text-ink-900 mb-4">Ajukan Koreksi</p>
              <div className="grid gap-3">
                <label>
                  <span className="text-xs text-ink-500 mb-1 block">Tanggal</span>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className={inputCls}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className="text-xs text-ink-500 mb-1 block">Jam Masuk Koreksi</span>
                    <input
                      type="time"
                      value={clockIn}
                      onChange={e => setClockIn(e.target.value)}
                      className={inputCls}
                    />
                  </label>
                  <label>
                    <span className="text-xs text-ink-500 mb-1 block">Jam Keluar Koreksi</span>
                    <input
                      type="time"
                      value={clockOut}
                      onChange={e => setClockOut(e.target.value)}
                      className={inputCls}
                    />
                  </label>
                </div>
                <label>
                  <span className="text-xs text-ink-500 mb-1 block">Alasan <span className="text-danger">*</span></span>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={3}
                    className={`${inputCls} resize-none`}
                    placeholder="Jelaskan alasan koreksi..."
                  />
                </label>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full bg-pine text-white rounded-xl py-3 text-sm font-sans font-semibold hover:bg-pine-700 disabled:opacity-45 transition-colors flex items-center justify-center gap-2"
                >
                  {submitting && (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  Ajukan Koreksi
                </button>
              </div>
            </FormCard>

            {/* Riwayat pengajuan */}
            <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-line">
                <p className="text-sm font-semibold text-ink-900">Riwayat Pengajuan</p>
              </div>
              {loading ? (
                <div className="divide-y divide-line">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between animate-pulse">
                      <div className="space-y-1.5">
                        <div className="h-4 w-28 bg-sand-100 rounded" />
                        <div className="h-3 w-40 bg-sand-100 rounded" />
                      </div>
                      <div className="h-5 w-20 bg-sand-100 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : myList.length === 0 ? (
                <EmptyState heading="Belum ada pengajuan" subtext="Pengajuan koreksi akan muncul di sini." />
              ) : (
                <div className="divide-y divide-line">
                  {myList.map(item => (
                    <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-ink-900">{formatDate(item.date)}</p>
                        <p className="text-xs text-ink-500 mt-0.5">
                          {item.requested_in ?? '–'} – {item.requested_out ?? '–'}
                        </p>
                        <p className="text-xs text-ink-500 mt-0.5 line-clamp-2">{item.reason}</p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab Admin ────────────────────────────────────────────────── */}
        {tab === 'admin' && isAdmin && (
          <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="divide-y divide-line">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-4 py-4 animate-pulse">
                    <div className="flex items-center justify-between mb-2">
                      <div className="h-4 w-36 bg-sand-100 rounded" />
                      <div className="h-5 w-20 bg-sand-100 rounded-full" />
                    </div>
                    <div className="h-3 w-52 bg-sand-100 rounded" />
                  </div>
                ))}
              </div>
            ) : adminList.length === 0 ? (
              <EmptyState heading="Tidak ada pengajuan" subtext="Tidak ada pengajuan koreksi saat ini." />
            ) : (
              <div className="divide-y divide-line">
                {adminList.map(item => (
                  <div key={item.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm font-medium text-ink-900">{item.staff_name ?? '—'}</p>
                        <p className="text-xs text-ink-500">
                          {formatDate(item.date)} · {item.requested_in ?? '–'} – {item.requested_out ?? '–'}
                        </p>
                        <p className="text-xs text-ink-500 mt-0.5 line-clamp-2">{item.reason}</p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                    {item.status === 'pending' && (
                      <ApproveRejectButtons
                        onApprove={() => handleApprove(item.id)}
                        onReject={() => handleReject(item.id)}
                        loading={actionLoading === item.id}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {staffId && null}
    </div>
  )
}
