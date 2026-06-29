'use client'

import { useCallback, useEffect, useState } from 'react'

interface Driver {
  id: string
  name: string
  phone: string | null
  type: 'travel_driver' | 'tour_guide'
  fee_type: 'percentage'
  fee_value: number
  referral_code: string | null
  active: boolean
  total_accrued: number
}

interface Payout {
  id: string
  driver_id: string
  period_start: string | null
  period_end: string | null
  total: number
  status: 'pending' | 'paid'
  paid_at: string | null
  created_at: string
}

interface Fee {
  id: string
  order_id: string
  base_amount: number
  fee_amount: number
  fee_scheme_snapshot: Record<string, unknown> | null
  status: 'accrued' | 'paid'
  payout_id: string | null
  accrued_at: string
}

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
const today = () => new Date().toISOString().slice(0, 10)
const monthStart = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }

export function DriversClient({ staffRole }: { staffRole: string }) {
  const isOwner = staffRole === 'owner'

  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)

  // Payout modal state
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [periodStart, setPeriodStart] = useState(monthStart())
  const [periodEnd, setPeriodEnd] = useState(today())
  const [payoutErr, setPayoutErr] = useState('')
  const [payoutLoading, setPayoutLoading] = useState(false)

  // Detail panel: fees + payouts
  const [fees, setFees] = useState<Fee[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'fees' | 'payouts'>('payouts')

  const loadDrivers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/v1/drivers')
    const json = await res.json()
    setDrivers(json.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadDrivers() }, [loadDrivers])

  const loadDetail = useCallback(async (driverId: string) => {
    setDetailLoading(true)
    const [feesRes, payoutsRes] = await Promise.all([
      fetch(`/api/v1/drivers/${driverId}/fees?limit=50`),
      fetch(`/api/v1/driver-payouts?driver_id=${driverId}`),
    ])
    const [feesJson, payoutsJson] = await Promise.all([feesRes.json(), payoutsRes.json()])
    setFees(feesJson.data ?? [])
    setPayouts(payoutsJson.data ?? [])
    setDetailLoading(false)
  }, [])

  const selectDriver = (d: Driver) => {
    setSelectedDriver(d)
    setActiveTab('payouts')
    loadDetail(d.id)
  }

  const createPayout = async () => {
    if (!selectedDriver) return
    setPayoutLoading(true)
    setPayoutErr('')
    const res = await fetch('/api/v1/driver-payouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driver_id: selectedDriver.id, period_start: periodStart, period_end: periodEnd }),
    })
    const json = await res.json()
    setPayoutLoading(false)
    if (!res.ok) { setPayoutErr(json.error?.message ?? 'Gagal membuat payout.'); return }
    setShowPayoutModal(false)
    await Promise.all([loadDrivers(), loadDetail(selectedDriver.id)])
    // Update accrued di selected driver
    setSelectedDriver(prev => prev ? { ...prev, total_accrued: 0 } : null)
  }

  const markPaid = async (payoutId: string) => {
    if (!selectedDriver) return
    const res = await fetch(`/api/v1/driver-payouts/${payoutId}`, { method: 'PATCH' })
    if (!res.ok) return
    await Promise.all([loadDrivers(), loadDetail(selectedDriver.id)])
  }

  const DRIVER_TYPE: Record<string, string> = {
    travel_driver: 'Driver',
    tour_guide:    'Tour Guide',
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Driver & Fee</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Kiri: list driver */}
          <div className="md:col-span-1 space-y-2">
            {loading ? (
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Memuat...</p>
            ) : drivers.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Belum ada driver.</p>
            ) : drivers.map(d => (
              <button
                key={d.id}
                onClick={() => selectDriver(d)}
                className="w-full text-left rounded-xl p-3 border transition-all"
                style={{
                  background: selectedDriver?.id === d.id ? 'var(--color-primary)' : 'var(--color-surface-raised)',
                  borderColor: selectedDriver?.id === d.id ? 'var(--color-primary)' : 'var(--color-border)',
                  color: selectedDriver?.id === d.id ? '#fff' : 'var(--color-text-primary)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{d.name}</p>
                    <p className="text-xs opacity-70">{DRIVER_TYPE[d.type]} · {d.fee_value}%</p>
                  </div>
                  {d.total_accrued > 0 && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: selectedDriver?.id === d.id ? 'rgba(255,255,255,0.2)' : 'var(--color-warning-bg)',
                        color: selectedDriver?.id === d.id ? '#fff' : 'var(--color-warning)',
                      }}
                    >
                      {fmt(d.total_accrued)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Kanan: detail panel */}
          <div className="md:col-span-2">
            {!selectedDriver ? (
              <div className="rounded-xl border p-8 text-center"
                style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                <p className="text-sm">Pilih driver untuk melihat detail</p>
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden"
                style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
                {/* Header */}
                <div className="p-4 border-b flex items-start justify-between gap-3"
                  style={{ borderColor: 'var(--color-border)' }}>
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{selectedDriver.name}</p>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {DRIVER_TYPE[selectedDriver.type]} · {selectedDriver.fee_value}% fee
                      {selectedDriver.phone && ` · ${selectedDriver.phone}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Fee belum dibayar</p>
                    <p className="font-bold text-lg" style={{ color: selectedDriver.total_accrued > 0 ? 'var(--color-warning)' : 'var(--color-text-primary)' }}>
                      {fmt(selectedDriver.total_accrued)}
                    </p>
                    {isOwner && selectedDriver.total_accrued > 0 && (
                      <button
                        onClick={() => { setShowPayoutModal(true); setPayoutErr('') }}
                        className="text-xs px-3 py-1 rounded-lg font-medium"
                        style={{ background: 'var(--color-primary)', color: '#fff' }}
                      >
                        Buat Payout
                      </button>
                    )}
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
                  {(['payouts', 'fees'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className="flex-1 py-2 text-sm font-medium transition-colors"
                      style={{
                        color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                        borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
                      }}
                    >
                      {tab === 'payouts' ? 'Riwayat Payout' : 'Ledger Fee'}
                    </button>
                  ))}
                </div>

                {/* Content */}
                <div className="p-4">
                  {detailLoading ? (
                    <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-secondary)' }}>Memuat...</p>
                  ) : activeTab === 'payouts' ? (
                    payouts.length === 0 ? (
                      <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-secondary)' }}>Belum ada payout.</p>
                    ) : (
                      <div className="space-y-2">
                        {payouts.map(p => (
                          <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg p-3"
                            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                            <div>
                              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                {p.period_start && p.period_end ? `${fmtDate(p.period_start)} – ${fmtDate(p.period_end)}` : '—'}
                              </p>
                              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                Dibuat {fmtDate(p.created_at)}
                                {p.paid_at && ` · Lunas ${fmtDate(p.paid_at)}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                {fmt(p.total)}
                              </span>
                              {p.status === 'pending' && isOwner ? (
                                <button onClick={() => markPaid(p.id)}
                                  className="text-xs px-2 py-1 rounded-lg"
                                  style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                                  Tandai Lunas
                                </button>
                              ) : (
                                <span className="text-xs px-2 py-1 rounded-full"
                                  style={{
                                    background: p.status === 'paid' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                                    color:      p.status === 'paid' ? 'var(--color-success)' : 'var(--color-warning)',
                                  }}>
                                  {p.status === 'paid' ? 'Lunas' : 'Pending'}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    // Ledger fee
                    fees.length === 0 ? (
                      <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-secondary)' }}>Belum ada fee.</p>
                    ) : (
                      <div className="space-y-1">
                        {fees.map(f => (
                          <div key={f.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                            <div>
                              <p className="text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                                {f.order_id.slice(0, 8)}…
                              </p>
                              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{fmtDate(f.accrued_at)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                {fmt(f.fee_amount)}
                              </p>
                              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                dari {fmt(f.base_amount)}
                              </p>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                background: f.status === 'paid' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                                color:      f.status === 'paid' ? 'var(--color-success)' : 'var(--color-warning)',
                              }}>
                              {f.status === 'paid' ? 'Dibayar' : 'Accrued'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Buat Payout */}
      {showPayoutModal && selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: 'var(--color-surface-raised)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Buat Payout — {selectedDriver.name}
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Semua fee <strong>accrued</strong> dalam periode akan digabung jadi satu payout.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Dari</label>
                <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm border"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Sampai</label>
                <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm border"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
              </div>
            </div>

            {payoutErr && (
              <p className="text-sm rounded-lg px-3 py-2"
                style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>{payoutErr}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowPayoutModal(false)} disabled={payoutLoading}
                className="flex-1 rounded-lg py-2 text-sm font-medium"
                style={{ background: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                Batal
              </button>
              <button onClick={createPayout} disabled={payoutLoading}
                className="flex-1 rounded-lg py-2 text-sm font-medium"
                style={{ background: 'var(--color-primary)', color: '#fff', opacity: payoutLoading ? 0.6 : 1 }}>
                {payoutLoading ? 'Memproses...' : 'Buat Payout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
