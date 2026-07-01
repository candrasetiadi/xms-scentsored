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

interface OvertimeEntry {
  id:          string
  date:        string
  hours:       number
  reason:      string
  status:      string
  amount:      number | null
  staff_name?: string
  created_at:  string
}

interface Props {
  staffId:   string
  staffRole: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  'w-full border border-line-strong rounded-md px-3 py-2.5 text-sm font-sans text-ink-900 bg-white ' +
  'focus:border-pine-400 focus:ring-2 focus:ring-pine-100 outline-none placeholder:text-ink-400'

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

const isAdminOrOwner = (role: string) => ['owner', 'admin'].includes(role)

// ── Main ──────────────────────────────────────────────────────────────────────

export function OvertimeClient({ staffId, staffRole }: Props) {
  const { showToast } = useToast()
  const isAdmin = isAdminOrOwner(staffRole)

  const [tab,           setTab]           = useState('saya')
  const [myList,        setMyList]        = useState<OvertimeEntry[]>([])
  const [adminList,     setAdminList]     = useState<OvertimeEntry[]>([])
  const [loading,       setLoading]       = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Form
  const [date,       setDate]       = useState('')
  const [hours,      setHours]      = useState('')
  const [reason,     setReason]     = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchMy = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/v1/hr/overtime')
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
      const res  = await fetch('/api/v1/hr/overtime?all=1')
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal memuat data.', 'error'); return }
      setAdminList(json.data ?? [])
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setLoading(false)
    }
  }, [isAdmin, showToast])

  useEffect(() => {
    if (tab === 'saya') fetchMy()
    else fetchAdmin()
  }, [tab, fetchMy, fetchAdmin])

  async function handleSubmit() {
    if (!date || !hours || !reason.trim()) {
      showToast('Tanggal, jam lembur, dan alasan wajib diisi.', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res  = await fetch('/api/v1/hr/overtime', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ date, hours: parseFloat(hours), reason }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal mengajukan lembur.', 'error'); return }
      showToast('Pengajuan lembur berhasil dikirim.')
      setDate(''); setHours(''); setReason('')
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
      const res  = await fetch(`/api/v1/hr/overtime/${id}/approve`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal menyetujui.', 'error'); return }
      showToast('Lembur disetujui.')
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
      const res  = await fetch(`/api/v1/hr/overtime/${id}/reject`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal menolak.', 'error'); return }
      showToast('Lembur ditolak.')
      fetchAdmin()
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const tabs = [
    { key: 'saya',    label: 'Pengajuan Saya' },
    ...(isAdmin ? [{ key: 'approve', label: 'Semua Lembur' }] : []),
  ]

  return (
    <div className="bg-sand-50 min-h-full p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <SectionHeader title="Lembur" />

        <PageTabs tabs={tabs} active={tab} onChange={setTab} />

        {/* ── Tab Saya ──────────────────────────────────────────────────── */}
        {tab === 'saya' && (
          <div className="space-y-4">
            <FormCard>
              <p className="text-sm font-semibold text-ink-900 mb-4">Ajukan Lembur</p>
              <div className="grid gap-3">
                <label>
                  <span className="text-xs text-ink-500 mb-1 block">Tanggal</span>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className={inputCls}
                  />
                </label>
                <label>
                  <span className="text-xs text-ink-500 mb-1 block">Jumlah Jam Lembur</span>
                  <input
                    type="number"
                    value={hours}
                    onChange={e => setHours(e.target.value)}
                    step={0.5}
                    min={0.5}
                    className={inputCls}
                    placeholder="Contoh: 1.5"
                  />
                </label>
                <label>
                  <span className="text-xs text-ink-500 mb-1 block">Alasan <span className="text-danger">*</span></span>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={3}
                    className={`${inputCls} resize-none`}
                    placeholder="Jelaskan alasan lembur..."
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
                  Ajukan Lembur
                </button>
              </div>
            </FormCard>

            <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-line">
                <p className="text-sm font-semibold text-ink-900">Riwayat Pengajuan</p>
              </div>
              {loading ? (
                <div className="divide-y divide-line">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="px-4 py-3 animate-pulse flex items-center justify-between">
                      <div className="space-y-1.5">
                        <div className="h-4 w-28 bg-sand-100 rounded" />
                        <div className="h-3 w-40 bg-sand-100 rounded" />
                      </div>
                      <div className="h-5 w-20 bg-sand-100 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : myList.length === 0 ? (
                <EmptyState heading="Belum ada pengajuan" subtext="Pengajuan lembur akan muncul di sini." />
              ) : (
                <div className="divide-y divide-line">
                  {myList.map(item => (
                    <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-ink-900">{formatDate(item.date)}</p>
                        <p className="text-xs text-ink-500 mt-0.5 tabular-nums">
                          {item.hours} jam
                          {item.amount !== null && item.status === 'approved'
                            ? ` · ${formatRp(item.amount)}`
                            : ''}
                        </p>
                        <p className="text-xs text-ink-500 mt-0.5 line-clamp-1">{item.reason}</p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab Approve ────────────────────────────────────────────────── */}
        {tab === 'approve' && isAdmin && (
          <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="divide-y divide-line">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-4 py-4 animate-pulse">
                    <div className="h-4 w-36 bg-sand-100 rounded mb-2" />
                    <div className="h-3 w-52 bg-sand-100 rounded" />
                  </div>
                ))}
              </div>
            ) : adminList.length === 0 ? (
              <EmptyState heading="Tidak ada pengajuan" subtext="Tidak ada pengajuan lembur saat ini." />
            ) : (
              <div className="divide-y divide-line">
                {adminList.map(item => (
                  <div key={item.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm font-medium text-ink-900">{item.staff_name ?? '—'}</p>
                        <p className="text-xs text-ink-500 tabular-nums">
                          {formatDate(item.date)} · {item.hours} jam
                          {item.amount !== null && ` · ${formatRp(item.amount)}`}
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
