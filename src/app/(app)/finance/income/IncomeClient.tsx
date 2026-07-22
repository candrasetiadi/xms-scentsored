'use client'

import { useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface IncomeRow {
  id:       string
  date:     string
  gopay:    number
  bca:      number
  mandiri:  number
  cash:     number
  note:     string | null
}

interface Props {
  branchId: string
  branches: { id: string; name: string }[]
  rows:     IncomeRow[]
  from:     string
  to:       string
  today:    string
}

const _rp = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
function fmt(n: number) { return 'Rp ' + _rp.format(Math.round(+n || 0)) }
function fmtDate(s: string) {
  const [y, m, d] = s.split('-')
  const bln = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  return `${+d} ${bln[+m - 1]} ${y}`
}
function incTotal(r: IncomeRow) { return +r.gopay + +r.bca + +r.mandiri + +r.cash }

const inputCls = 'h-9 w-full rounded-md border border-line-strong px-3 text-sm bg-white focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100'
const monoCls  = 'h-9 w-full rounded-md border border-line-strong pl-9 pr-3 text-sm bg-white font-mono focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100'

function MoneyField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-bold text-ink-500 mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-400">Rp</span>
        <input type="number" min="0" className={monoCls} value={value}
          onChange={e => onChange(e.target.value)} placeholder="0" />
      </div>
    </div>
  )
}

export function IncomeClient({ branchId, branches, rows: initialRows, from, to, today }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  const [rows,     setRows]     = useState<IncomeRow[]>(initialRows)
  const [editing,  setEditing]  = useState<IncomeRow | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [msg,      setMsg]      = useState<{ text: string; ok: boolean } | null>(null)

  const [fDate,    setFDate]    = useState(today)
  const [fGopay,   setFGopay]  = useState('')
  const [fBca,     setFBca]    = useState('')
  const [fMandiri, setFMandiri] = useState('')
  const [fCash,    setFCash]   = useState('')
  const [fNote,    setFNote]   = useState('')

  function pushFilter(updates: Record<string, string>) {
    const sp = new URLSearchParams({ branch: branchId, from, to })
    Object.entries(updates).forEach(([k, v]) => sp.set(k, v))
    router.push(`${pathname}?${sp.toString()}`)
  }

  function startEdit(row: IncomeRow) {
    setEditing(row)
    setFDate(row.date)
    setFGopay(row.gopay ? String(row.gopay) : '')
    setFBca(row.bca ? String(row.bca) : '')
    setFMandiri(row.mandiri ? String(row.mandiri) : '')
    setFCash(row.cash ? String(row.cash) : '')
    setFNote(row.note ?? '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditing(null)
    setFDate(today)
    setFGopay(''); setFBca(''); setFMandiri(''); setFCash(''); setFNote('')
  }

  const handleSave = useCallback(async () => {
    if (!fDate) { setMsg({ text: 'Tanggal wajib diisi.', ok: false }); return }
    setSaving(true)
    setMsg(null)
    try {
      const res  = await fetch('/api/v1/finance/income', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          branch_id: branchId, date: fDate,
          gopay: +fGopay || 0, bca: +fBca || 0, mandiri: +fMandiri || 0, cash: +fCash || 0,
          note: fNote || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Gagal menyimpan.')
      setMsg({ text: editing ? 'Perubahan tersimpan.' : 'Pendapatan disimpan.', ok: true })
      cancelEdit()
      router.refresh()
    } catch (e: any) {
      setMsg({ text: e.message, ok: false })
    } finally { setSaving(false) }
  }, [branchId, fDate, fGopay, fBca, fMandiri, fCash, fNote, editing])

  async function handleDelete(id: string) {
    if (!confirm('Hapus data pendapatan ini?')) return
    setDeleting(id)
    const res = await fetch(`/api/v1/finance/income/${id}`, { method: 'DELETE' })
    setDeleting(null)
    if (res.ok) { setMsg({ text: 'Data dihapus.', ok: true }); router.refresh() }
    else setMsg({ text: 'Gagal menghapus.', ok: false })
  }

  // Summary totals
  const totGopay   = rows.reduce((s, r) => s + +r.gopay,   0)
  const totBca     = rows.reduce((s, r) => s + +r.bca,     0)
  const totMandiri = rows.reduce((s, r) => s + +r.mandiri, 0)
  const totCash    = rows.reduce((s, r) => s + +r.cash,    0)
  const totAll     = totGopay + totBca + totMandiri + totCash

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-[28px] text-pine">Pendapatan</h1>
        <p className="text-sm text-ink-400 mt-0.5">Input pendapatan harian dari Gopay, Bank BCA, Bank Mandiri, dan Cash.</p>
      </div>

      {/* Form */}
      <div className="bg-white border border-line rounded-xl p-5 mb-5">
        <p className="text-sm font-bold text-ink-700 mb-4">
          {editing ? 'Edit Pendapatan' : 'Input Pendapatan Harian'}
        </p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs font-bold text-ink-500 mb-1">Tanggal</label>
            <input type="date" className={inputCls} value={fDate} onChange={e => setFDate(e.target.value)} max={today} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <MoneyField id="gopay"   label="Gopay"        value={fGopay}   onChange={setFGopay}   />
          <MoneyField id="bca"     label="Bank BCA"     value={fBca}     onChange={setFBca}     />
          <MoneyField id="mandiri" label="Bank Mandiri" value={fMandiri} onChange={setFMandiri} />
          <MoneyField id="cash"    label="Cash"         value={fCash}    onChange={setFCash}    />
        </div>
        <div className="mb-4">
          <label className="block text-xs font-bold text-ink-500 mb-1">Catatan</label>
          <input type="text" className={inputCls} value={fNote} onChange={e => setFNote(e.target.value)} placeholder="Opsional" />
        </div>
        {msg && (
          <p className={`text-xs mb-3 font-medium ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>
        )}
        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving}
            className="h-9 px-5 rounded-md bg-pine text-white text-sm font-semibold hover:bg-pine-700 transition-colors disabled:opacity-50">
            {saving ? 'Menyimpan…' : editing ? 'Simpan Perubahan' : 'Simpan'}
          </button>
          {editing && (
            <button onClick={cancelEdit}
              className="h-9 px-4 rounded-md border border-line text-sm text-ink-500 hover:bg-sand-50 transition-colors">
              Batal
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
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

      {/* Table */}
      <div className="bg-white border border-line rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sand-50 border-b border-line text-xs uppercase tracking-wider text-ink-500 text-left">
                <th className="px-4 py-3 font-medium">Tanggal</th>
                <th className="px-3 py-3 font-medium text-right">Gopay</th>
                <th className="px-3 py-3 font-medium text-right">Bank BCA</th>
                <th className="px-3 py-3 font-medium text-right">Bank Mandiri</th>
                <th className="px-3 py-3 font-medium text-right">Cash</th>
                <th className="px-3 py-3 font-medium text-right">Total</th>
                <th className="px-3 py-3 font-medium">Catatan</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-ink-400">Belum ada data.</td></tr>
              )}
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-sand-50/50">
                  <td className="px-4 py-3 font-mono text-xs">{fmtDate(row.date)}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs tabular-nums">{row.gopay   ? fmt(+row.gopay)   : <span className="text-ink-300">—</span>}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs tabular-nums">{row.bca     ? fmt(+row.bca)     : <span className="text-ink-300">—</span>}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs tabular-nums">{row.mandiri ? fmt(+row.mandiri) : <span className="text-ink-300">—</span>}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs tabular-nums">{row.cash    ? fmt(+row.cash)    : <span className="text-ink-300">—</span>}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs tabular-nums font-bold">{fmt(incTotal(row))}</td>
                  <td className="px-3 py-3 text-xs text-ink-400 max-w-[160px] truncate">{row.note ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(row)}
                        className="text-xs text-ink-400 hover:text-pine transition-colors font-medium">Edit</button>
                      <button onClick={() => handleDelete(row.id)} disabled={deleting === row.id}
                        className="text-xs text-ink-400 hover:text-danger transition-colors font-medium disabled:opacity-40">
                        {deleting === row.id ? '…' : 'Hapus'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-sand-50 border-t border-line text-xs font-semibold">
                  <td className="px-4 py-3">Total ({rows.length} hari)</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{fmt(totGopay)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{fmt(totBca)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{fmt(totMandiri)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{fmt(totCash)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums font-bold">{fmt(totAll)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
