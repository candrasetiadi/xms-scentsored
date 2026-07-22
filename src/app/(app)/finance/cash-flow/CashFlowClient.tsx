'use client'

import { useRouter, usePathname } from 'next/navigation'
import { EXP_TYPE_LABEL } from '@/lib/finance-constants'

interface Props {
  branchId:       string
  branches:       { id: string; name: string }[]
  masuk:          Record<string, number>
  totalMasuk:     number
  keluar:         Record<string, number>
  keluarByMethod: Record<string, number>
  totalKeluar:    number
  net:            number
  from:           string
  to:             string
}

const _rp = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
function fmt(n: number) { return 'Rp ' + _rp.format(Math.round(+n || 0)) }

export function CashFlowClient({
  branchId, branches, masuk, totalMasuk, keluar, keluarByMethod, totalKeluar, net, from, to,
}: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  function pushFilter(updates: Record<string, string>) {
    const sp = new URLSearchParams({ branch: branchId, from, to })
    Object.entries(updates).forEach(([k, v]) => sp.set(k, v))
    router.push(`${pathname}?${sp.toString()}`)
  }

  const masukChannels  = Object.entries(masuk)
  const keluarTypes    = Object.entries(keluar).filter(([, v]) => v > 0)
  const keluarMethods  = Object.entries(keluarByMethod).sort((a, b) => b[1] - a[1])

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="font-display text-[28px] text-pine">Laporan Arus Kas</h1>
        <p className="text-sm text-ink-400 mt-0.5">Uang masuk dan keluar per periode, plus posisi per kanal pembayaran.</p>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {branches.length > 0 && (
          <select className="h-9 rounded-md border border-line-strong px-3 text-sm bg-white focus:outline-none"
            value={branchId} onChange={e => pushFilter({ branch: e.target.value })}>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <input type="date" className="h-9 rounded-md border border-line-strong px-3 text-sm bg-white focus:outline-none"
          value={from} onChange={e => pushFilter({ from: e.target.value })} />
        <span className="text-ink-400 text-sm">–</span>
        <input type="date" className="h-9 rounded-md border border-line-strong px-3 text-sm bg-white focus:outline-none"
          value={to} onChange={e => pushFilter({ to: e.target.value })} />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-line rounded-xl px-4 py-4 border-t-2 border-t-amber-400">
          <p className="text-[11px] font-bold tracking-wider text-ink-400 uppercase">Total Masuk</p>
          <p className="font-mono text-xl font-bold mt-1 tabular-nums">{fmt(totalMasuk)}</p>
        </div>
        <div className="bg-white border border-line rounded-xl px-4 py-4 border-t-2 border-t-danger">
          <p className="text-[11px] font-bold tracking-wider text-ink-400 uppercase">Total Keluar</p>
          <p className="font-mono text-xl font-bold mt-1 tabular-nums text-danger">{fmt(totalKeluar)}</p>
        </div>
        <div className={`bg-white border border-line rounded-xl px-4 py-4 border-t-2 ${net >= 0 ? 'border-t-success' : 'border-t-danger'}`}>
          <p className="text-[11px] font-bold tracking-wider text-ink-400 uppercase">Net</p>
          <p className={`font-mono text-xl font-bold mt-1 tabular-nums ${net >= 0 ? 'text-success' : 'text-danger'}`}>{fmt(net)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Uang masuk per channel */}
        <div className="bg-white border border-line rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Uang Masuk per Channel</p>
          </div>
          <div className="divide-y divide-line">
            {masukChannels.map(([ch, val]) => (
              <div key={ch} className="flex justify-between items-center px-4 py-2.5">
                <span className="text-sm text-ink-600">{ch}</span>
                <span className="font-mono text-sm tabular-nums font-semibold">{fmt(val)}</span>
              </div>
            ))}
            <div className="flex justify-between items-center px-4 py-2.5 bg-sand-50">
              <span className="text-sm font-bold text-ink-900">Total</span>
              <span className="font-mono text-sm tabular-nums font-bold">{fmt(totalMasuk)}</span>
            </div>
          </div>
        </div>

        {/* Uang keluar per tipe */}
        <div className="bg-white border border-line rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-danger-bg border-b border-danger-bd">
            <p className="text-xs font-bold text-danger uppercase tracking-wider">Uang Keluar per Kategori</p>
          </div>
          <div className="divide-y divide-line">
            {keluarTypes.length === 0 && (
              <p className="px-4 py-3 text-xs text-ink-400">Belum ada pengeluaran.</p>
            )}
            {keluarTypes.map(([type, val]) => (
              <div key={type} className="flex justify-between items-center px-4 py-2.5">
                <span className="text-sm text-ink-600">{EXP_TYPE_LABEL[type] ?? type}</span>
                <span className="font-mono text-sm tabular-nums font-semibold text-danger">{fmt(val)}</span>
              </div>
            ))}
            {keluarTypes.length > 0 && (
              <div className="flex justify-between items-center px-4 py-2.5 bg-sand-50">
                <span className="text-sm font-bold text-ink-900">Total</span>
                <span className="font-mono text-sm tabular-nums font-bold text-danger">{fmt(totalKeluar)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Keluar per metode bayar */}
      {keluarMethods.length > 0 && (
        <div className="bg-white border border-line rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line bg-sand-50">
            <p className="text-xs font-bold text-ink-500 uppercase tracking-wider">Keluar per Metode Bayar</p>
          </div>
          <div className="divide-y divide-line">
            {keluarMethods.map(([method, val]) => (
              <div key={method} className="flex justify-between items-center px-4 py-2.5">
                <span className="text-sm text-ink-600">{method}</span>
                <span className="font-mono text-sm tabular-nums font-semibold text-danger">{fmt(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
