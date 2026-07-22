'use client'

import { useRouter, usePathname } from 'next/navigation'
import { TAX_CATS, EXP_TYPE_LABEL } from '@/lib/finance-constants'

interface IncomeRow { id: string; date: string; gopay: number; bca: number; mandiri: number; cash: number; note: string | null }
interface ExpenseRow { id: string; date: string; type: string; amount: number; method: string; cat: string | null; who: string | null; note: string | null }

interface Props {
  branchId: string
  branches: { id: string; name: string }[]
  incomes:  IncomeRow[]
  expenses: ExpenseRow[]
  from:     string
  to:       string
}

const _rp = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
function fmt(n: number) { return 'Rp ' + _rp.format(Math.round(+n || 0)) }
function fmtDate(s: string) {
  const [y, m, d] = s.split('-')
  const bln = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  return `${+d} ${bln[+m - 1]} ${y}`
}

const TAX_AKUN: Record<string, string> = Object.fromEntries(TAX_CATS.map(c => [c.n, c.akun]))
const EXP_AKUN: Record<string, string> = { bahan: 'Pembelian Bahan Baku & Produk', vendor: 'Beban Jasa Vendor' }

interface JournalEntry {
  date:    string
  type:    string
  debit:   string
  credit:  string
  nominal: number
  note:    string | null
  label?:  string
}

function buildJournal(incomes: IncomeRow[], expenses: ExpenseRow[]): JournalEntry[] {
  const entries: JournalEntry[] = []

  for (const x of incomes) {
    const channels = [
      { label: 'Gopay',        value: +x.gopay    },
      { label: 'Bank BCA',     value: +x.bca      },
      { label: 'Bank Mandiri', value: +x.mandiri  },
      { label: 'Cash',         value: +x.cash     },
    ]
    for (const ch of channels) {
      if (ch.value <= 0) continue
      entries.push({ date: x.date, type: 'income', debit: ch.label, credit: 'Pendapatan Penjualan', nominal: ch.value, note: x.note, label: ch.label })
    }
  }

  for (const x of expenses) {
    const akun = x.type === 'toko' ? (TAX_AKUN[x.cat ?? ''] ?? 'Beban Operasional Lain') : (EXP_AKUN[x.type] ?? 'Beban Operasional Lain')
    entries.push({ date: x.date, type: x.type, debit: akun, credit: x.method, nominal: +x.amount, note: x.note, label: x.cat ?? x.who ?? x.type })
  }

  entries.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    if (a.type === 'income' && b.type !== 'income') return -1
    if (a.type !== 'income' && b.type === 'income') return 1
    return 0
  })
  return entries
}

export function JournalClient({ branchId, branches, incomes, expenses, from, to }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  function pushFilter(updates: Record<string, string>) {
    const sp = new URLSearchParams({ branch: branchId, from, to })
    Object.entries(updates).forEach(([k, v]) => sp.set(k, v))
    router.push(`${pathname}?${sp.toString()}`)
  }

  const entries = buildJournal(incomes, expenses)
  const totalDebit  = entries.reduce((s, e) => s + e.nominal, 0)
  const totalCredit = totalDebit

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="font-display text-[28px] text-pine">Jurnal Umum</h1>
        <p className="text-sm text-ink-400 mt-0.5">Dibuat otomatis dari semua input pendapatan dan pengeluaran (format debit–kredit).</p>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
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

      <div className="bg-white border border-line rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sand-50 border-b border-line text-xs uppercase tracking-wider text-ink-500 text-left">
                <th className="px-4 py-3 font-medium">Tanggal</th>
                <th className="px-3 py-3 font-medium">Tipe</th>
                <th className="px-3 py-3 font-medium">Akun Debit</th>
                <th className="px-3 py-3 font-medium">Akun Kredit</th>
                <th className="px-3 py-3 font-medium text-right">Nominal</th>
                <th className="px-4 py-3 font-medium">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {entries.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-ink-400">Belum ada data.</td></tr>
              )}
              {entries.map((e, i) => (
                <tr key={i} className="hover:bg-sand-50/50">
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{fmtDate(e.date)}</td>
                  <td className="px-3 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      e.type === 'income' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-sand-100 text-ink-500 border-line'
                    }`}>
                      {e.type === 'income' ? 'Pendapatan' : EXP_TYPE_LABEL[e.type] ?? e.type}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-ink-700">{e.debit}</td>
                  <td className="px-3 py-3 text-xs text-ink-500 italic">{e.credit}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs tabular-nums font-semibold">{fmt(e.nominal)}</td>
                  <td className="px-4 py-3 text-xs text-ink-400 max-w-[200px] truncate">{e.note ?? (e.label ?? '—')}</td>
                </tr>
              ))}
            </tbody>
            {entries.length > 0 && (
              <tfoot>
                <tr className="bg-sand-50 border-t border-line text-xs font-semibold">
                  <td colSpan={4} className="px-4 py-3">Total ({entries.length} entri)</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums font-bold">{fmt(totalDebit)}</td>
                  <td className="px-4 py-3 text-xs text-ink-400 italic">Debit = Kredit ✓</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
