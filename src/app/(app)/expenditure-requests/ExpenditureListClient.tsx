'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface ExpenditureRequest {
  id:              string
  title:           string
  total_estimated: number
  status:          'draft' | 'pending' | 'approved' | 'rejected' | 'hold'
  created_at:      string
  submitted_at:    string | null
  reviewed_at:     string | null
  requester:       { id: string; name: string; role: string } | null
  reviewer:        { id: string; name: string } | null
  reviewer_note:   string | null
}

const STATUS_OPTIONS = [
  { value: '',         label: 'Semua' },
  { value: 'draft',    label: 'Draft' },
  { value: 'pending',  label: 'Menunggu Review' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'hold',     label: 'TBC' },
  { value: 'rejected', label: 'Ditolak' },
]

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft:    { label: 'Draft',             cls: 'bg-sand-100 text-ink-500' },
  pending:  { label: 'Menunggu Review',   cls: 'bg-warning-bg text-warning border border-warning-bd' },
  approved: { label: 'Disetujui',         cls: 'bg-pine-50 text-pine border border-pine-100' },
  hold:     { label: 'TBC',              cls: 'bg-blue-50 text-blue-600 border border-blue-200' },
  rejected: { label: 'Ditolak',          cls: 'bg-danger-bg text-danger border border-danger-bd' },
}

function formatRp(n: number) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props {
  staffId:   string
  staffRole: string
}

export function ExpenditureListClient({ staffId: _staffId, staffRole }: Props) {
  const [items,   setItems]   = useState<ExpenditureRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [status,  setStatus]  = useState('')

  const isManager = ['owner', 'admin'].includes(staffRole)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const qs  = status ? `?status=${status}` : ''
      const res  = await fetch(`/api/v1/expenditure-requests${qs}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error?.message ?? 'Gagal memuat data.'); return }
      setItems(json.data ?? [])
      setError(null)
    } catch {
      setError('Koneksi gagal.')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { fetchItems() }, [fetchItems])

  const pendingCount = items.filter(i => i.status === 'pending').length

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-xl text-ink-900">Pengajuan Pengeluaran</h1>
          {isManager && pendingCount > 0 && (
            <p className="text-sm text-warning mt-0.5">{pendingCount} request menunggu review</p>
          )}
        </div>
        <Link
          href="/expenditure-requests/new"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-pine text-white text-sm font-medium hover:bg-pine-700 transition-colors"
        >
          + Buat Request
        </Link>
      </div>

      {/* Filter status */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setStatus(opt.value)}
            className={[
              'h-8 px-3 rounded-full text-xs font-medium transition-colors border',
              status === opt.value
                ? 'bg-pine text-white border-pine'
                : 'bg-white text-ink-500 border-line hover:border-pine-300 hover:text-pine',
            ].join(' ')}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-danger bg-danger-bg border border-danger-bd rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-line rounded-xl p-4 animate-pulse space-y-2">
              <div className="h-4 w-1/2 bg-sand-200 rounded" />
              <div className="h-3 w-1/4 bg-sand-100 rounded" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-ink-400 text-sm">
          {status ? 'Tidak ada request dengan status ini.' : 'Belum ada pengajuan.'}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.draft
            return (
              <Link
                key={item.id}
                href={`/expenditure-requests/${item.id}`}
                className="block bg-white border border-line rounded-xl p-4 hover:border-pine-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink-900 truncate">{item.title}</p>
                    <p className="text-sm text-ink-500 mt-0.5">
                      {formatRp(item.total_estimated)}
                      {isManager && item.requester && (
                        <span className="text-ink-400"> · {item.requester.name}</span>
                      )}
                    </p>
                    <p className="text-xs text-ink-400 mt-1">{formatDate(item.created_at)}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
                {item.reviewer_note && item.status !== 'pending' && (
                  <p className="mt-2 text-xs text-ink-400 italic border-t border-line pt-2">
                    Catatan: {item.reviewer_note}
                  </p>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
