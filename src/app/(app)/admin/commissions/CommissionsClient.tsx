'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────────────────────

type Summary = {
  total_sales:      number
  total_driver_fee: number
  total_agency_fee: number
  pending_driver:   number
  pending_agency:   number
  top_drivers:      { driver_id: string; driver_name: string; total_sales: number; total_fee: number }[]
  top_agencies:     { agency_id: string; agency_name: string; total_sales: number; total_fee: number }[]
  agencies_with_advance: {
    agency_id:      string
    agency_name:    string
    total_advance:  number
    total_paid_fee: number
    balance:        number
  }[]
}

type Tx = {
  id:                  string
  base_amount:         number
  fee_amount:          number
  status:              'accrued' | 'paid'
  agency_fee_amount:   number | null
  agency_status:       'accrued' | 'paid' | null
  accrued_at:          string
  drivers:             { id: string; name: string; phone: string | null }
  travel_agencies:     { id: string; name: string } | null
  orders:              { order_number: string; paid_at: string; branches: { name: string } | null }
}

type Driver = { id: string; name: string; travel_agency_id: string | null }
type Agency = { id: string; name: string; fee_value: number }

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtRp(n: number) {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(n)
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function today() { return new Date().toISOString().split('T')[0] }
function monthStart() { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] }

const PAGE_SIZE = 50

// ── Main Component ─────────────────────────────────────────────────────────────

export function CommissionsClient({
  drivers,
  agencies,
}: {
  drivers:  Driver[]
  agencies: Agency[]
}) {
  const router = useRouter()

  // Filters
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo,   setDateTo]   = useState(today())
  const [txTab,    setTxTab]    = useState<'all' | 'pending'>('all')
  const [page,     setPage]     = useState(0)

  // Export selects
  const [exportDriverId, setExportDriverId] = useState(drivers[0]?.id ?? '')
  const [exportAgencyId, setExportAgencyId] = useState(agencies[0]?.id ?? '')

  // Advance fee agency select (header)
  const [advSelectId, setAdvSelectId] = useState(agencies[0]?.id ?? '')

  // Data
  const [summary,  setSummary]  = useState<Summary | null>(null)
  const [txs,      setTxs]      = useState<Tx[]>([])
  const [txTotal,  setTxTotal]  = useState(0)
  const [loadingS, setLoadingS] = useState(false)
  const [loadingT, setLoadingT] = useState(false)

  // Payout modal
  const [payoutOpen,    setPayoutOpen]    = useState(false)
  const [payoutTarget,  setPayoutTarget]  = useState<{ id: string; name: string; type: 'driver' | 'agency' } | null>(null)
  const [payoutFrom,    setPayoutFrom]    = useState(monthStart())
  const [payoutTo,      setPayoutTo]      = useState(today())
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [payoutError,   setPayoutError]   = useState<string | null>(null)

  // Advance fee modal
  const [advOpen,    setAdvOpen]    = useState(false)
  const [advAgency,  setAdvAgency]  = useState<Agency | null>(null)
  const [advAmount,  setAdvAmount]  = useState('')
  const [advNote,    setAdvNote]    = useState('')
  const [advLoading, setAdvLoading] = useState(false)
  const [advError,   setAdvError]   = useState<string | null>(null)

  const fetchSummary = useCallback(async () => {
    setLoadingS(true)
    const res = await fetch(`/api/v1/commissions/summary?from=${dateFrom}&to=${dateTo}`)
    const json = await res.json()
    if (json.data) setSummary(json.data)
    setLoadingS(false)
  }, [dateFrom, dateTo])

  const fetchTxs = useCallback(async () => {
    setLoadingT(true)
    const status = txTab === 'pending' ? '&status=accrued' : ''
    const offset = page * PAGE_SIZE
    const res = await fetch(
      `/api/v1/commissions/transactions?from=${dateFrom}&to=${dateTo}${status}&limit=${PAGE_SIZE}&offset=${offset}`
    )
    const json = await res.json()
    setTxs(json.data ?? [])
    setTxTotal(json.meta?.total ?? 0)
    setLoadingT(false)
  }, [dateFrom, dateTo, txTab, page])

  useEffect(() => { fetchSummary() }, [fetchSummary])
  useEffect(() => { fetchTxs() }, [fetchTxs])
  useEffect(() => { setPage(0) }, [dateFrom, dateTo, txTab])

  async function openPayout(id: string, name: string, type: 'driver' | 'agency') {
    setPayoutTarget({ id, name, type })
    setPayoutFrom(dateFrom); setPayoutTo(dateTo)
    setPayoutError(null); setPayoutOpen(true)
  }

  async function submitPayout() {
    if (!payoutTarget) return
    setPayoutLoading(true); setPayoutError(null)
    const url  = payoutTarget.type === 'driver' ? '/api/v1/driver-payouts' : '/api/v1/agency-payouts'
    const body = payoutTarget.type === 'driver'
      ? { driver_id: payoutTarget.id, period_start: payoutFrom, period_end: payoutTo }
      : { travel_agency_id: payoutTarget.id, period_start: payoutFrom, period_end: payoutTo }
    const res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json()
    setPayoutLoading(false)
    if (!res.ok) { setPayoutError(json.error?.message ?? 'Gagal.'); return }
    setPayoutOpen(false)
    fetchSummary(); fetchTxs()
    router.refresh()
  }

  async function openAdvance(agency: Agency) {
    setAdvAgency(agency); setAdvAmount(''); setAdvNote(''); setAdvError(null); setAdvOpen(true)
  }

  async function submitAdvance() {
    if (!advAgency) return
    const amount = Number(advAmount)
    if (!amount || amount <= 0) { setAdvError('Jumlah harus lebih dari 0.'); return }
    setAdvLoading(true); setAdvError(null)
    const res = await fetch('/api/v1/agency-advance-fees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ travel_agency_id: advAgency.id, amount, note: advNote || undefined }),
    })
    const json = await res.json()
    setAdvLoading(false)
    if (!res.ok) { setAdvError(json.error?.message ?? 'Gagal.'); return }
    setAdvOpen(false); fetchSummary()
  }

  function exportCsv(type: 'driver' | 'agency', id: string) {
    const url = `/api/v1/commissions/export?type=${type}&id=${id}&from=${dateFrom}&to=${dateTo}`
    window.open(url, '_blank')
  }

  // Pending items for bulk view
  const pendingDriverMap = new Map<string, { name: string; total: number; count: number }>()
  const pendingAgencyMap = new Map<string, { name: string; total: number; count: number }>()
  for (const tx of txs as Tx[]) {
    if (tx.status === 'accrued') {
      const m = pendingDriverMap.get(tx.drivers.id) ?? { name: tx.drivers.name, total: 0, count: 0 }
      m.total += tx.fee_amount; m.count++
      pendingDriverMap.set(tx.drivers.id, m)
    }
    if (tx.agency_status === 'accrued' && tx.travel_agencies) {
      const m = pendingAgencyMap.get(tx.travel_agencies.id) ?? { name: tx.travel_agencies.name, total: 0, count: 0 }
      m.total += tx.agency_fee_amount ?? 0; m.count++
      pendingAgencyMap.set(tx.travel_agencies.id, m)
    }
  }

  const inputCls     = 'h-9 rounded-md border border-line-strong px-3 text-sm text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100'
  const selectCls    = 'h-9 rounded-md border border-line-strong px-3 text-sm text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100 bg-white'
  const hasPending   = pendingDriverMap.size > 0 || pendingAgencyMap.size > 0
  const totalPending = pendingDriverMap.size + pendingAgencyMap.size
  const totalPages   = Math.ceil(txTotal / PAGE_SIZE)

  return (
    <div className="space-y-8">

      {/* ── Section 1: Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink-900">Komisi</h1>
          <p className="text-sm text-ink-500 mt-1">Rekap komisi mitra &amp; perusahaan</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Date range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className={inputCls}
            />
            <span className="text-ink-400 text-sm select-none">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className={inputCls}
            />
          </div>
          {/* Export Mitra */}
          {drivers.length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                value={exportDriverId}
                onChange={e => setExportDriverId(e.target.value)}
                className={selectCls}
              >
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <button
                onClick={() => exportDriverId && exportCsv('driver', exportDriverId)}
                disabled={!exportDriverId}
                className="bg-white border border-line-strong text-pine rounded-md px-4 py-2 text-sm font-medium hover:bg-sand-50 shadow-sm disabled:opacity-40"
              >
                ↓ Mitra
              </button>
            </div>
          )}
          {/* Export Perusahaan */}
          {agencies.length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                value={exportAgencyId}
                onChange={e => setExportAgencyId(e.target.value)}
                className={selectCls}
              >
                {agencies.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <button
                onClick={() => exportAgencyId && exportCsv('agency', exportAgencyId)}
                disabled={!exportAgencyId}
                className="bg-white border border-line-strong text-pine rounded-md px-4 py-2 text-sm font-medium hover:bg-sand-50 shadow-sm disabled:opacity-40"
              >
                ↓ Perusahaan
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: Summary Cards ── */}
      {loadingS ? (
        <div className="grid grid-cols-5 md:grid-cols-3 gap-4 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-sand-200 rounded-lg h-24" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-5 md:grid-cols-3 gap-4">
          <div className="bg-white border border-line rounded-lg shadow-sm p-5">
            <p className="text-[11px] font-medium uppercase tracking-[.22em] text-ink-500 mb-1">Total Penjualan</p>
            <p className="text-2xl font-semibold tabular-nums text-ink-900 leading-tight">{fmtRp(summary.total_sales)}</p>
            <p className="text-xs text-ink-400 mt-1">via {txTotal} transaksi</p>
          </div>
          <div className="bg-white border border-line rounded-lg shadow-sm p-5">
            <p className="text-[11px] font-medium uppercase tracking-[.22em] text-ink-500 mb-1">Komisi Mitra</p>
            <p className="text-2xl font-semibold tabular-nums text-ink-900 leading-tight">{fmtRp(summary.total_driver_fee)}</p>
            <p className="text-xs text-ink-400 mt-1">akumulasi</p>
          </div>
          <div className="bg-white border border-line rounded-lg shadow-sm p-5">
            <p className="text-[11px] font-medium uppercase tracking-[.22em] text-ink-500 mb-1">Komisi Perusahaan</p>
            <p className="text-2xl font-semibold tabular-nums text-ink-900 leading-tight">{fmtRp(summary.total_agency_fee)}</p>
            <p className="text-xs text-ink-400 mt-1">akumulasi</p>
          </div>
          <div className="bg-warning-bg border border-warning-bd rounded-lg shadow-sm p-5">
            <p className="text-[11px] font-medium uppercase tracking-[.22em] text-ink-500 mb-1">Pending Mitra</p>
            <p className="text-2xl font-semibold tabular-nums text-warning leading-tight">{fmtRp(summary.pending_driver)}</p>
            <p className="text-xs text-ink-400 mt-1">belum ditransfer</p>
          </div>
          <div className="bg-warning-bg border border-warning-bd rounded-lg shadow-sm p-5">
            <p className="text-[11px] font-medium uppercase tracking-[.22em] text-ink-500 mb-1">Pending Perusahaan</p>
            <p className="text-2xl font-semibold tabular-nums text-warning leading-tight">{fmtRp(summary.pending_agency)}</p>
            <p className="text-xs text-ink-400 mt-1">belum ditransfer</p>
          </div>
        </div>
      ) : null}

      {/* ── Section 3: Bulk Pending Transfer (conditional) ── */}
      {hasPending && (
        <div className="bg-warning-bg border border-warning-bd rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-warning-bd flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-warning flex-shrink-0" />
            <span className="text-sm font-semibold text-warning">Transfer Komisi Pending</span>
            <span className="text-xs text-ink-500 ml-auto">{totalPending} penerima menunggu</span>
          </div>

          {pendingDriverMap.size > 0 && (
            <>
              <div className="text-xs font-medium text-ink-500 uppercase tracking-wider px-6 py-2 bg-sand-50">
                Mitra
              </div>
              <div className="divide-y divide-warning-bd">
                {[...pendingDriverMap.entries()].map(([id, m]) => (
                  <div key={id} className="px-6 py-3 flex items-center gap-4 bg-white hover:bg-sand-50">
                    <span className="text-sm font-medium text-ink-900 flex-1">{m.name}</span>
                    <span className="text-xs text-ink-400 tabular-nums">{m.count} transaksi</span>
                    <span className="text-sm font-semibold tabular-nums text-warning flex-shrink-0">{fmtRp(m.total)}</span>
                    <button
                      onClick={() => openPayout(id, m.name, 'driver')}
                      className="bg-pine text-white rounded-md px-4 py-1.5 text-sm font-medium hover:bg-pine-700 shadow-sm"
                    >
                      Buat Payout
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {pendingAgencyMap.size > 0 && (
            <>
              <div className="text-xs font-medium text-ink-500 uppercase tracking-wider px-6 py-2 bg-sand-50">
                Perusahaan
              </div>
              <div className="divide-y divide-warning-bd">
                {[...pendingAgencyMap.entries()].map(([id, m]) => (
                  <div key={id} className="px-6 py-3 flex items-center gap-4 bg-white hover:bg-sand-50">
                    <span className="text-sm font-medium text-ink-900 flex-1">{m.name}</span>
                    <span className="text-xs text-ink-400 tabular-nums">{m.count} transaksi</span>
                    <span className="text-sm font-semibold tabular-nums text-warning flex-shrink-0">{fmtRp(m.total)}</span>
                    <button
                      onClick={() => openPayout(id, m.name, 'agency')}
                      className="bg-pine text-white rounded-md px-4 py-1.5 text-sm font-medium hover:bg-pine-700 shadow-sm"
                    >
                      Buat Payout
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Section 4: Advance Fee Monitor ── */}
      <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-900">Advance Fee Perusahaan</p>
          <div className="flex items-center gap-2">
            {agencies.length > 1 && (
              <select
                value={advSelectId}
                onChange={e => setAdvSelectId(e.target.value)}
                className={selectCls}
              >
                {agencies.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => {
                const targetId = agencies.length === 1 ? agencies[0]?.id : advSelectId
                const agency = agencies.find(a => a.id === targetId)
                if (agency) openAdvance(agency)
              }}
              className="bg-pine text-white rounded-md px-4 py-1.5 text-sm font-medium hover:bg-pine-700 shadow-sm"
            >
              + Advance Fee
            </button>
          </div>
        </div>

        {!summary?.agencies_with_advance?.length ? (
          <p className="px-6 py-10 text-center text-sm text-ink-400">Belum ada advance fee tercatat.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sand-100 text-left">
                <th className="px-6 py-2 text-[11px] font-medium uppercase tracking-[.22em] text-ink-500">Perusahaan</th>
                <th className="px-6 py-2 text-[11px] font-medium uppercase tracking-[.22em] text-ink-500 text-right">Advance Diberikan</th>
                <th className="px-6 py-2 text-[11px] font-medium uppercase tracking-[.22em] text-ink-500 text-right">Komisi Terbayar</th>
                <th className="px-6 py-2 text-[11px] font-medium uppercase tracking-[.22em] text-ink-500 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {summary.agencies_with_advance.map(a => (
                <tr key={a.agency_id} className="hover:bg-sand-50">
                  <td className="px-6 py-3 font-medium text-ink-900">{a.agency_name}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-ink-700">{fmtRp(a.total_advance)}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-ink-700">{fmtRp(a.total_paid_fee)}</td>
                  <td className={`px-6 py-3 text-right tabular-nums font-semibold ${a.balance > 0 ? 'text-warning' : 'text-success'}`}>
                    {a.balance > 0 ? `+${fmtRp(a.balance)}` : fmtRp(a.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Section 5: Leaderboard (2-col grid) ── */}
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-1">

        {/* Top Mitra */}
        <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-line text-[11px] font-medium uppercase tracking-[.22em] text-ink-500">
            Top 5 Mitra
          </div>
          <div className="divide-y divide-line">
            {(summary?.top_drivers ?? []).length === 0 ? (
              <p className="px-6 py-8 text-sm text-ink-400 text-center">Belum ada data.</p>
            ) : (
              (summary?.top_drivers ?? []).map((item, i) => (
                <div
                  key={item.driver_id}
                  className={`px-6 py-3 flex items-center gap-3 ${i === 0 ? 'bg-pine-50' : ''}`}
                >
                  <span className={`text-xs w-5 flex-shrink-0 ${i === 0 ? 'font-bold text-pine' : i <= 2 ? 'font-semibold text-ink-500' : 'font-semibold text-ink-400'}`}>
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-ink-900 flex-1 truncate">{item.driver_name}</span>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold tabular-nums text-ink-900">{fmtRp(item.total_fee)}</p>
                    <p className="text-xs text-ink-400 tabular-nums">{fmtRp(item.total_sales)} penjualan</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Perusahaan */}
        <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-line text-[11px] font-medium uppercase tracking-[.22em] text-ink-500">
            Top 5 Perusahaan
          </div>
          <div className="divide-y divide-line">
            {(summary?.top_agencies ?? []).length === 0 ? (
              <p className="px-6 py-8 text-sm text-ink-400 text-center">Belum ada data.</p>
            ) : (
              (summary?.top_agencies ?? []).map((item, i) => (
                <div
                  key={item.agency_id}
                  className={`px-6 py-3 flex items-center gap-3 ${i === 0 ? 'bg-pine-50' : ''}`}
                >
                  <span className={`text-xs w-5 flex-shrink-0 ${i === 0 ? 'font-bold text-pine' : i <= 2 ? 'font-semibold text-ink-500' : 'font-semibold text-ink-400'}`}>
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-ink-900 flex-1 truncate">{item.agency_name}</span>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold tabular-nums text-ink-900">{fmtRp(item.total_fee)}</p>
                    <p className="text-xs text-ink-400 tabular-nums">{fmtRp(item.total_sales)} penjualan</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* ── Section 6: Riwayat Transaksi ── */}
      <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 pt-5 pb-0 border-b border-line">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-ink-900">Riwayat Transaksi</p>
            <span className="text-xs text-ink-500">{txTotal} transaksi</span>
          </div>
          <div className="flex gap-6">
            <button
              onClick={() => setTxTab('all')}
              className={`pb-3 text-sm -mb-px cursor-pointer ${txTab === 'all' ? 'border-b-2 border-pine text-pine font-medium' : 'text-ink-500 hover:text-ink-900'}`}
            >
              Semua
            </button>
            <button
              onClick={() => setTxTab('pending')}
              className={`pb-3 text-sm -mb-px cursor-pointer ${txTab === 'pending' ? 'border-b-2 border-pine text-pine font-medium' : 'text-ink-500 hover:text-ink-900'}`}
            >
              Pending
            </button>
          </div>
        </div>

        {loadingT ? (
          <div className="space-y-2 py-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 bg-sand-100 rounded mx-6" />
            ))}
          </div>
        ) : txs.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-400">Tidak ada transaksi.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="bg-sand-100 text-left">
                  <th className="px-6 py-2 text-[11px] font-medium uppercase tracking-[.22em] text-ink-500">Tanggal</th>
                  <th className="px-6 py-2 text-[11px] font-medium uppercase tracking-[.22em] text-ink-500">No. Order</th>
                  <th className="px-6 py-2 text-[11px] font-medium uppercase tracking-[.22em] text-ink-500">Nama Mitra</th>
                  <th className="px-6 py-2 text-[11px] font-medium uppercase tracking-[.22em] text-ink-500">Perusahaan</th>
                  <th className="px-6 py-2 text-[11px] font-medium uppercase tracking-[.22em] text-ink-500 text-right">Total Penjualan</th>
                  <th className="px-6 py-2 text-[11px] font-medium uppercase tracking-[.22em] text-ink-500 text-right">Komisi Mitra</th>
                  <th className="px-6 py-2 text-[11px] font-medium uppercase tracking-[.22em] text-ink-500 text-right">Komisi Perusahaan</th>
                </tr>
              </thead>
              <tbody>
                {txs.map(tx => (
                  <tr key={tx.id} className="border-b border-line last:border-0 hover:bg-sand-50">
                    <td className="px-6 py-3 text-xs text-ink-500 whitespace-nowrap">{fmtDate(tx.orders.paid_at)}</td>
                    <td className="px-6 py-3 font-mono text-xs text-ink-600">{tx.orders.order_number}</td>
                    <td className="px-6 py-3">
                      <p className="text-sm font-medium text-ink-900">{tx.drivers.name}</p>
                      {tx.drivers.phone && <p className="text-xs text-ink-400">{tx.drivers.phone}</p>}
                    </td>
                    <td className="px-6 py-3 text-xs text-ink-500">
                      {tx.travel_agencies?.name ?? <span className="text-ink-400">Perorangan</span>}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums font-medium text-ink-900">{fmtRp(tx.base_amount)}</td>
                    <td className="px-6 py-3 text-right">
                      <p className="tabular-nums font-semibold text-ink-900">{fmtRp(tx.fee_amount)}</p>
                      <div className="flex justify-end mt-0.5">
                        {tx.status === 'paid'
                          ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-success-bg text-success border border-success-bd">Lunas</span>
                          : <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-warning-bg text-warning border border-warning-bd">Pending</span>
                        }
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      {tx.agency_fee_amount ? (
                        <>
                          <p className="tabular-nums font-semibold text-ink-900">{fmtRp(tx.agency_fee_amount)}</p>
                          <div className="flex justify-end mt-0.5">
                            {tx.agency_status === 'paid'
                              ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-success-bg text-success border border-success-bd">Lunas</span>
                              : <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-warning-bg text-warning border border-warning-bd">Pending</span>
                            }
                          </div>
                        </>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {txTotal > PAGE_SIZE && (
          <div className="px-6 py-3 border-t border-line flex items-center justify-between">
            <span className="text-xs text-ink-500">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, txTotal)} dari {txTotal}
            </span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="text-sm text-ink-500 hover:text-ink-900 disabled:opacity-40"
              >
                ← Sebelumnya
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="text-sm text-ink-500 hover:text-ink-900 disabled:opacity-40"
              >
                Selanjutnya →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Payout Modal ── */}
      {payoutOpen && payoutTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold text-ink-900">Buat Payout</h3>
            <p className="text-sm text-ink-500 mt-1">{payoutTarget.name}</p>
            <label className="text-xs font-medium text-ink-600 block mb-1 mt-3">Dari Tanggal</label>
            <input type="date" value={payoutFrom} onChange={e => setPayoutFrom(e.target.value)} className={`${inputCls} w-full`} />
            <label className="text-xs font-medium text-ink-600 block mb-1 mt-3">Sampai Tanggal</label>
            <input type="date" value={payoutTo}   onChange={e => setPayoutTo(e.target.value)}   className={`${inputCls} w-full`} />
            {payoutError && (
              <p className="text-xs text-danger bg-danger-bg border border-danger-bd rounded px-2 py-1.5 mt-2">{payoutError}</p>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setPayoutOpen(false)}
                className="flex-1 border border-line-strong h-9 rounded-md text-sm text-ink-700 hover:bg-sand-50"
              >
                Batal
              </button>
              <button
                onClick={submitPayout}
                disabled={payoutLoading}
                className="flex-1 bg-pine text-white h-9 rounded-md text-sm font-medium hover:bg-pine-700 disabled:opacity-45"
              >
                {payoutLoading ? 'Memproses…' : 'Buat Payout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Advance Fee Modal ── */}
      {advOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold text-ink-900">Tambah Advance Fee</h3>
            <p className="text-sm text-ink-500 mt-1">{advAgency?.name}</p>
            <label className="text-xs font-medium text-ink-600 block mb-1 mt-3">Jumlah (Rp)</label>
            <input
              type="number"
              min={1}
              value={advAmount}
              onChange={e => setAdvAmount(e.target.value)}
              className={`${inputCls} w-full`}
              placeholder="cth. 500000"
            />
            <label className="text-xs font-medium text-ink-600 block mb-1 mt-3">Catatan (opsional)</label>
            <input
              type="text"
              value={advNote}
              onChange={e => setAdvNote(e.target.value)}
              className={`${inputCls} w-full`}
              placeholder="Transfer via BCA..."
            />
            {advError && (
              <p className="text-xs text-danger bg-danger-bg border border-danger-bd rounded px-2 py-1.5 mt-2">{advError}</p>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setAdvOpen(false)}
                className="flex-1 border border-line-strong h-9 rounded-md text-sm text-ink-700 hover:bg-sand-50"
              >
                Batal
              </button>
              <button
                onClick={submitAdvance}
                disabled={advLoading}
                className="flex-1 bg-pine text-white h-9 rounded-md text-sm font-medium hover:bg-pine-700 disabled:opacity-45"
              >
                {advLoading ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
