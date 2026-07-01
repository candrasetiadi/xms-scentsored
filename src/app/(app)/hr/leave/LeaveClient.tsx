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

interface LeaveBalance {
  annual_remaining: number
  annual_quota:     number
  sick_used:        number
  personal_used:    number
}

interface LeaveRequest {
  id:          string
  leave_type:  string
  start_date:  string
  end_date:    string
  days:        number
  reason:      string
  status:      string
  staff_name?: string
  created_at:  string
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

const LEAVE_TYPES = [
  { value: 'annual',  label: 'Tahunan'    },
  { value: 'sick',    label: 'Sakit'      },
  { value: 'permit',  label: 'Izin'       }, // nilai DB: 'permit', bukan 'personal'
  { value: 'unpaid',  label: 'Tanpa Gaji' },
]

function formatDateRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const s = new Date(start).toLocaleDateString('id-ID', opts)
  const e = new Date(end).toLocaleDateString('id-ID', { ...opts, year: 'numeric' })
  return `${s} – ${e}`
}

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0
  const diff = new Date(end).getTime() - new Date(start).getTime()
  return Math.max(0, Math.floor(diff / 86_400_000) + 1)
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function LeaveClient({ staffId, staffRole, branchId }: Props) {
  const { showToast } = useToast()
  const isAdmin = isAdminOrOwner(staffRole)

  const [tab,           setTab]           = useState('saya')
  const [balance,       setBalance]       = useState<LeaveBalance | null>(null)
  const [myList,        setMyList]        = useState<LeaveRequest[]>([])
  const [adminList,     setAdminList]     = useState<LeaveRequest[]>([])
  const [loading,       setLoading]       = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Form
  const [leaveType,  setLeaveType]  = useState('annual')
  const [startDate,  setStartDate]  = useState('')
  const [endDate,    setEndDate]    = useState('')
  const [reason,     setReason]     = useState('')
  const [submitting, setSubmitting] = useState(false)

  const days = calcDays(startDate, endDate)

  const fetchMy = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, balRes] = await Promise.all([
        fetch('/api/v1/hr/leave'),
        fetch('/api/v1/hr/leave/balances'),
      ])
      const [listJson, balJson] = await Promise.all([listRes.json(), balRes.json()])
      if (!listRes.ok) { showToast(listJson.error ?? 'Gagal memuat data.', 'error'); return }
      setMyList(listJson.data ?? [])
      setBalance(balJson.data ?? null)
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
      const res  = await fetch(`/api/v1/hr/leave?${params}`)
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
    if (tab === 'saya') fetchMy()
    else fetchAdmin()
  }, [tab, fetchMy, fetchAdmin])

  async function handleSubmit() {
    if (!startDate || !endDate || !reason.trim()) {
      showToast('Tanggal dan alasan wajib diisi.', 'error')
      return
    }
    if (days <= 0) {
      showToast('Tanggal selesai harus setelah tanggal mulai.', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res  = await fetch('/api/v1/hr/leave', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ leave_type: leaveType, start_date: startDate, end_date: endDate, days, reason }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal mengajukan cuti.', 'error'); return }
      showToast('Pengajuan cuti berhasil dikirim.')
      setStartDate(''); setEndDate(''); setReason(''); setLeaveType('annual')
      fetchMy()
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel(id: string) {
    try {
      const res  = await fetch(`/api/v1/hr/leave/${id}/cancel`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal membatalkan.', 'error'); return }
      showToast('Pengajuan cuti dibatalkan.')
      fetchMy()
    } catch {
      showToast('Koneksi gagal.', 'error')
    }
  }

  async function handleApprove(id: string) {
    setActionLoading(id)
    try {
      const res  = await fetch(`/api/v1/hr/leave/${id}/approve`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal menyetujui.', 'error'); return }
      showToast('Cuti disetujui.')
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
      const res  = await fetch(`/api/v1/hr/leave/${id}/reject`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal menolak.', 'error'); return }
      showToast('Cuti ditolak.')
      fetchAdmin()
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const tabs = [
    { key: 'saya',    label: 'Cuti Saya'     },
    ...(isAdmin ? [{ key: 'approve', label: 'Semua Cuti' }] : []),
  ]

  return (
    <div className="bg-sand-50 min-h-full p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <SectionHeader title="Cuti" />

        <PageTabs tabs={tabs} active={tab} onChange={setTab} />

        {/* ── Tab Saya ──────────────────────────────────────────────────── */}
        {tab === 'saya' && (
          <div className="space-y-4">
            {/* Saldo card */}
            {balance && (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white border border-line rounded-xl p-3 text-center">
                  <p className="text-xl font-semibold tabular-nums text-pine">
                    {balance.annual_remaining}
                  </p>
                  <p className="text-xs text-ink-500 mt-0.5">Tahunan</p>
                  <p className="text-xs text-ink-400">dari {balance.annual_quota}</p>
                </div>
                <div className="bg-white border border-line rounded-xl p-3 text-center">
                  <p className="text-xl font-semibold tabular-nums text-ink-900">
                    {balance.sick_used}
                  </p>
                  <p className="text-xs text-ink-500 mt-0.5">Sakit (terpakai)</p>
                </div>
                <div className="bg-white border border-line rounded-xl p-3 text-center">
                  <p className="text-xl font-semibold tabular-nums text-ink-900">
                    {balance.personal_used}
                  </p>
                  <p className="text-xs text-ink-500 mt-0.5">Izin (terpakai)</p>
                </div>
              </div>
            )}

            {/* Form */}
            <FormCard>
              <p className="text-sm font-semibold text-ink-900 mb-4">Ajukan Cuti</p>
              <div className="grid gap-3">
                <label>
                  <span className="text-xs text-ink-500 mb-1 block">Jenis Cuti</span>
                  <select value={leaveType} onChange={e => setLeaveType(e.target.value)} className={inputCls}>
                    {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className="text-xs text-ink-500 mb-1 block">Mulai</span>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
                  </label>
                  <label>
                    <span className="text-xs text-ink-500 mb-1 block">Selesai</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} className={inputCls} />
                  </label>
                </div>
                {days > 0 && (
                  <p className="text-xs text-ink-500">
                    Jumlah: <span className="font-semibold text-ink-900 tabular-nums">{days} hari</span>
                  </p>
                )}
                <label>
                  <span className="text-xs text-ink-500 mb-1 block">Alasan <span className="text-danger">*</span></span>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={3}
                    className={`${inputCls} resize-none`}
                    placeholder="Jelaskan alasan cuti..."
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
                  Ajukan Cuti
                </button>
              </div>
            </FormCard>

            {/* Riwayat */}
            <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-line">
                <p className="text-sm font-semibold text-ink-900">Riwayat Pengajuan</p>
              </div>
              {loading ? (
                <div className="divide-y divide-line">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="px-4 py-3 animate-pulse flex items-center justify-between">
                      <div className="space-y-1.5">
                        <div className="h-4 w-32 bg-sand-100 rounded" />
                        <div className="h-3 w-48 bg-sand-100 rounded" />
                      </div>
                      <div className="h-5 w-20 bg-sand-100 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : myList.length === 0 ? (
                <EmptyState heading="Belum ada pengajuan" subtext="Pengajuan cuti akan muncul di sini." />
              ) : (
                <div className="divide-y divide-line">
                  {myList.map(item => (
                    <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-ink-900">
                          {LEAVE_TYPES.find(t => t.value === item.leave_type)?.label ?? item.leave_type}
                        </p>
                        <p className="text-xs text-ink-500 mt-0.5">
                          {formatDateRange(item.start_date, item.end_date)} · {item.days} hari
                        </p>
                        <p className="text-xs text-ink-500 mt-0.5 line-clamp-1">{item.reason}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <StatusBadge status={item.status} />
                        {item.status === 'pending' && (
                          <button
                            onClick={() => handleCancel(item.id)}
                            className="text-xs text-danger underline underline-offset-2 hover:no-underline"
                          >
                            Batalkan
                          </button>
                        )}
                      </div>
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
              <EmptyState heading="Tidak ada pengajuan" subtext="Tidak ada pengajuan cuti saat ini." />
            ) : (
              <div className="divide-y divide-line">
                {adminList.map(item => (
                  <div key={item.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm font-medium text-ink-900">{item.staff_name ?? '—'}</p>
                        <p className="text-xs text-ink-500">
                          {LEAVE_TYPES.find(t => t.value === item.leave_type)?.label ?? item.leave_type}
                          {' · '}{formatDateRange(item.start_date, item.end_date)} · {item.days} hari
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
