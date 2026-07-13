'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface RequestItem {
  id:         string
  name:       string
  qty:        number
  unit_price: number
  subtotal:   number
  note:       string | null
}

interface ExpenditureRequest {
  id:              string
  title:           string
  description:     string | null
  total_estimated: number
  status:          'draft' | 'pending' | 'approved' | 'rejected' | 'hold'
  reviewer_note:   string | null
  submitted_at:    string | null
  reviewed_at:     string | null
  created_at:      string
  requester:       { id: string; name: string; role: string } | null
  reviewer:        { id: string; name: string } | null
  expenditure_request_items: RequestItem[]
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft:    { label: 'Draft',           cls: 'bg-sand-100 text-ink-500' },
  pending:  { label: 'Menunggu Review', cls: 'bg-warning-bg text-warning border border-warning-bd' },
  approved: { label: 'Disetujui',       cls: 'bg-pine-50 text-pine border border-pine-100' },
  hold:     { label: 'TBC',            cls: 'bg-blue-50 text-blue-600 border border-blue-200' },
  rejected: { label: 'Ditolak',        cls: 'bg-danger-bg text-danger border border-danger-bd' },
}

function formatRp(n: number) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

interface Props {
  requestId: string
  staffRole: string
  staffId:   string
}

export function ExpenditureDetailClient({ requestId, staffRole, staffId }: Props) {
  const router = useRouter()
  const [data,    setData]    = useState<ExpenditureRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  // Review state
  const [action,     setAction]     = useState<'approved' | 'rejected' | 'hold' | null>(null)
  const [note,       setNote]       = useState('')
  const [reviewing,  setReviewing]  = useState(false)
  const [reviewErr,  setReviewErr]  = useState<string | null>(null)

  // Submit state (for requester)
  const [submitting, setSubmitting] = useState(false)

  const isManager   = ['owner', 'admin'].includes(staffRole)
  const isRequester = data?.requester?.id === staffId

  const fetchData = useCallback(async () => {
    try {
      const res  = await fetch(`/api/v1/expenditure-requests/${requestId}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error?.message ?? 'Tidak ditemukan.'); return }
      setData(json.data)
    } catch { setError('Koneksi gagal.') }
    finally { setLoading(false) }
  }, [requestId])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res  = await fetch(`/api/v1/expenditure-requests/${requestId}/submit`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setError(json.error?.message ?? 'Gagal mengajukan.'); return }
      fetchData()
    } catch { setError('Koneksi gagal.') }
    finally { setSubmitting(false) }
  }

  async function handleReview() {
    if (!action) return
    if ((action === 'rejected' || action === 'hold') && !note.trim()) {
      setReviewErr('Catatan wajib diisi untuk aksi ini.'); return
    }
    setReviewing(true); setReviewErr(null)
    try {
      const res  = await fetch(`/api/v1/expenditure-requests/${requestId}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: note.trim() || null }),
      })
      const json = await res.json()
      if (!res.ok) { setReviewErr(json.error?.message ?? 'Gagal mereview.'); return }
      setAction(null); setNote('')
      fetchData()
    } catch { setReviewErr('Koneksi gagal.') }
    finally { setReviewing(false) }
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 animate-pulse">
      <div className="h-6 w-1/3 bg-sand-200 rounded" />
      <div className="h-40 bg-sand-100 rounded-xl" />
    </div>
  )

  if (error || !data) return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <p className="text-danger text-sm">{error ?? 'Request tidak ditemukan.'}</p>
      <button onClick={() => router.back()} className="mt-4 text-sm text-pine hover:underline">← Kembali</button>
    </div>
  )

  const badge = STATUS_BADGE[data.status] ?? STATUS_BADGE.draft
  const items = data.expenditure_request_items ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-ink-400 hover:text-ink-900 transition-colors">
          ← Kembali
        </button>
        <h1 className="font-display text-xl text-ink-900 flex-1 truncate">{data.title}</h1>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {/* Info card */}
      <div className="bg-white border border-line rounded-xl p-5 space-y-3">
        {data.description && (
          <p className="text-sm text-ink-700 leading-relaxed">{data.description}</p>
        )}

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <p className="text-xs text-ink-400">Pengaju</p>
            <p className="font-medium text-ink-900">{data.requester?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Tanggal Buat</p>
            <p className="font-medium text-ink-900">{formatDate(data.created_at)}</p>
          </div>
          {data.submitted_at && (
            <div>
              <p className="text-xs text-ink-400">Tanggal Ajukan</p>
              <p className="font-medium text-ink-900">{formatDate(data.submitted_at)}</p>
            </div>
          )}
          {data.reviewed_at && (
            <div>
              <p className="text-xs text-ink-400">Direview oleh</p>
              <p className="font-medium text-ink-900">{data.reviewer?.name ?? '—'}</p>
            </div>
          )}
        </div>

        {data.reviewer_note && (
          <div className="bg-sand-50 rounded-lg px-3 py-2.5 border border-line">
            <p className="text-xs text-ink-400 mb-0.5">Catatan Reviewer</p>
            <p className="text-sm text-ink-700">{data.reviewer_note}</p>
          </div>
        )}
      </div>

      {/* Items table */}
      <div className="bg-white border border-line rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-line">
          <h2 className="text-sm font-semibold text-ink-700">Rincian Item</h2>
        </div>
        <div className="divide-y divide-line">
          {items.map(it => (
            <div key={it.id} className="px-5 py-3 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-900">{it.name}</p>
                {it.note && <p className="text-xs text-ink-400 mt-0.5">{it.note}</p>}
                <p className="text-xs text-ink-400 mt-0.5">
                  {it.qty} × {formatRp(it.unit_price)}
                </p>
              </div>
              <p className="text-sm font-semibold text-ink-900 tabular-nums shrink-0">
                {formatRp(it.subtotal)}
              </p>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-line bg-sand-50 flex justify-between items-center">
          <p className="text-sm font-medium text-ink-600">Total Estimasi</p>
          <p className="text-lg font-bold text-ink-900">{formatRp(data.total_estimated)}</p>
        </div>
      </div>

      {/* Requester: submit draft */}
      {isRequester && data.status === 'draft' && (
        <div className="bg-white border border-line rounded-xl p-5 space-y-3">
          <p className="text-sm text-ink-600">Request masih berstatus <strong>Draft</strong>. Ajukan ke owner untuk direview.</p>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full h-11 rounded-xl bg-pine text-white text-sm font-semibold hover:bg-pine-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Mengajukan...' : 'Ajukan ke Owner'}
          </button>
        </div>
      )}

      {/* Manager: review panel */}
      {isManager && data.status === 'pending' && (
        <div className="bg-white border border-line rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-ink-700">Review Pengajuan</h2>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'approved', label: 'Setujui',  cls: 'border-pine-300 bg-pine-50 text-pine' },
              { key: 'hold',     label: 'TBC',       cls: 'border-blue-200 bg-blue-50 text-blue-600' },
              { key: 'rejected', label: 'Tolak',     cls: 'border-danger-bd bg-danger-bg text-danger' },
            ] as const).map(opt => (
              <button
                key={opt.key}
                onClick={() => setAction(prev => prev === opt.key ? null : opt.key)}
                className={[
                  'h-10 rounded-lg border-2 text-sm font-semibold transition-all',
                  action === opt.key ? opt.cls + ' ring-2 ring-offset-1' : 'border-line text-ink-500 hover:border-line-strong',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {action && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-ink-600 block mb-1.5">
                  Catatan {action === 'approved' ? '(opsional)' : '*'}
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder={
                    action === 'approved' ? 'Tambahkan catatan jika perlu...' :
                    action === 'hold'     ? 'Informasi tambahan yang dibutuhkan...' :
                    'Alasan penolakan...'
                  }
                  rows={3}
                  className="w-full rounded-lg border border-line-strong px-3 py-2.5 text-sm text-ink-900 bg-white resize-none focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100"
                />
              </div>

              {reviewErr && (
                <p className="text-sm text-danger bg-danger-bg border border-danger-bd rounded-lg px-3 py-2">
                  {reviewErr}
                </p>
              )}

              <button
                onClick={handleReview}
                disabled={reviewing}
                className={[
                  'w-full h-11 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-colors',
                  action === 'approved' ? 'bg-pine hover:bg-pine-700' :
                  action === 'hold'     ? 'bg-blue-600 hover:bg-blue-700' :
                  'bg-danger hover:bg-red-700',
                ].join(' ')}
              >
                {reviewing ? 'Memproses...' :
                  action === 'approved' ? 'Konfirmasi Setujui' :
                  action === 'hold'     ? 'Konfirmasi TBC' :
                  'Konfirmasi Tolak'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
