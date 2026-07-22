'use client'

import Link from 'next/link'
import { EXP_TYPE_LABEL } from '@/lib/finance-constants'

const _rp = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
function fmt(n: number) { return 'Rp ' + _rp.format(Math.round(n)) }
function fmtDate(s: string) {
  const [y, m, d] = s.split('-')
  const bln = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  return `${+d} ${bln[+m - 1]} ${y}`
}

interface Props {
  today:         string
  branchId:      string
  branches:      { id: string; name: string }[]
  todayIncome:   { gopay: number; bca: number; mandiri: number; cash: number; note?: string } | null
  todayExpenses: { type: string; amount: number; method: string }[]
  totalIncome:   number
  totalExpense:  number
  net:           number
  monthLabel:    string
}

export function FinanceHomeClient({
  today, todayIncome, todayExpenses, totalIncome, totalExpense, net, monthLabel,
}: Props) {
  const todayTotalInc = todayIncome
    ? +todayIncome.gopay + +todayIncome.bca + +todayIncome.mandiri + +todayIncome.cash
    : 0
  const todayTotalExp = todayExpenses.reduce((s, x) => s + +x.amount, 0)
  const noIncome = !todayIncome || todayTotalInc === 0

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-[28px] text-pine">Beranda Finance</h1>
        <p className="text-sm text-ink-400 mt-0.5">Ringkasan keuangan — {fmtDate(today)}</p>
      </div>

      {/* Alert jika belum input hari ini */}
      {noIncome && (
        <div className="flex items-start gap-3 bg-warning-bg border border-warning-bd rounded-xl px-4 py-3 mb-5 text-sm text-warning">
          <span className="text-base">⚠</span>
          <span>Belum ada input pendapatan untuk hari ini. Jangan lupa input setelah tutup toko.</span>
        </div>
      )}

      {/* Stat hari ini */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-line rounded-xl px-4 py-4 border-t-2 border-t-amber-400">
          <p className="text-[11px] font-bold tracking-wider text-ink-400 uppercase">Pendapatan Hari Ini</p>
          <p className="font-mono text-lg font-semibold mt-1 tabular-nums">{fmt(todayTotalInc)}</p>
        </div>
        <div className="bg-white border border-line rounded-xl px-4 py-4 border-t-2 border-t-danger">
          <p className="text-[11px] font-bold tracking-wider text-ink-400 uppercase">Pengeluaran Hari Ini</p>
          <p className="font-mono text-lg font-semibold mt-1 tabular-nums text-danger">{fmt(todayTotalExp)}</p>
        </div>
        <div className="bg-white border border-line rounded-xl px-4 py-4 border-t-2 border-t-ink-300">
          <p className="text-[11px] font-bold tracking-wider text-ink-400 uppercase">Net Hari Ini</p>
          <p className={`font-mono text-lg font-semibold mt-1 tabular-nums ${todayTotalInc - todayTotalExp >= 0 ? 'text-success' : 'text-danger'}`}>
            {fmt(todayTotalInc - todayTotalExp)}
          </p>
        </div>
      </div>

      {/* Pendapatan hari ini per channel */}
      {todayIncome && (
        <div className="bg-white border border-line rounded-xl p-4 mb-4">
          <p className="text-xs font-bold text-ink-500 uppercase tracking-wider mb-3">Channel Pendapatan Hari Ini</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {[
              { label: 'Gopay',        value: todayIncome.gopay    },
              { label: 'Bank BCA',     value: todayIncome.bca      },
              { label: 'Bank Mandiri', value: todayIncome.mandiri  },
              { label: 'Cash',         value: todayIncome.cash     },
            ].map(ch => (
              <div key={ch.label} className="flex justify-between items-center py-1 border-b border-line last:border-0">
                <span className="text-sm text-ink-600">{ch.label}</span>
                <span className="font-mono text-sm tabular-nums font-semibold">{fmt(+ch.value)}</span>
              </div>
            ))}
          </div>
          {todayIncome.note && (
            <p className="text-xs text-ink-400 mt-3 italic">{todayIncome.note}</p>
          )}
        </div>
      )}

      {/* Pengeluaran hari ini per tipe */}
      {todayExpenses.length > 0 && (
        <div className="bg-white border border-line rounded-xl p-4 mb-4">
          <p className="text-xs font-bold text-ink-500 uppercase tracking-wider mb-3">Pengeluaran Hari Ini</p>
          <div className="space-y-1.5">
            {(['toko', 'bahan', 'vendor'] as const).map(type => {
              const total = todayExpenses.filter(x => x.type === type).reduce((s, x) => s + +x.amount, 0)
              if (!total) return null
              return (
                <div key={type} className="flex justify-between items-center py-1 border-b border-line last:border-0">
                  <span className="text-sm text-ink-600">{EXP_TYPE_LABEL[type]}</span>
                  <span className="font-mono text-sm tabular-nums font-semibold text-danger">{fmt(total)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Ringkasan bulan ini */}
      <div className="bg-white border border-line rounded-xl p-4 mb-6">
        <p className="text-xs font-bold text-ink-500 uppercase tracking-wider mb-3">Bulan Ini — {monthLabel}</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-ink-400">Total Pendapatan</p>
            <p className="font-mono text-sm font-semibold mt-0.5 tabular-nums">{fmt(totalIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Total Pengeluaran</p>
            <p className="font-mono text-sm font-semibold mt-0.5 tabular-nums text-danger">{fmt(totalExpense)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Net</p>
            <p className={`font-mono text-sm font-semibold mt-0.5 tabular-nums ${net >= 0 ? 'text-success' : 'text-danger'}`}>
              {fmt(net)}
            </p>
          </div>
        </div>
      </div>

      {/* Shortcuts */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/finance/income"
          className="bg-white border border-line rounded-xl px-4 py-3 hover:border-pine-300 hover:bg-pine-50 transition-colors text-sm font-semibold text-ink-700 flex items-center gap-2">
          <span className="text-pine">▲</span> Input Pendapatan
        </Link>
        <Link href="/finance/expenses/toko"
          className="bg-white border border-line rounded-xl px-4 py-3 hover:border-pine-300 hover:bg-pine-50 transition-colors text-sm font-semibold text-ink-700 flex items-center gap-2">
          <span className="text-danger">▼</span> Catat Pengeluaran
        </Link>
        <Link href="/finance/cash-flow"
          className="bg-white border border-line rounded-xl px-4 py-3 hover:border-pine-300 hover:bg-pine-50 transition-colors text-sm font-semibold text-ink-700 flex items-center gap-2">
          <span>⇄</span> Laporan Arus Kas
        </Link>
        <Link href="/finance/bank-statements"
          className="bg-white border border-line rounded-xl px-4 py-3 hover:border-pine-300 hover:bg-pine-50 transition-colors text-sm font-semibold text-ink-700 flex items-center gap-2">
          <span>▤</span> Rekening Koran
        </Link>
      </div>
    </div>
  )
}
