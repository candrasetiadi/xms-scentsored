'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { FINANCE_REKENINGS } from '@/lib/finance-constants'

interface BankRow {
  id:         string
  rekening:   string
  date:       string
  jenis:      'kredit' | 'debit' | 'saldo'
  nominal:    number
  keterangan: string | null
}

interface Props {
  branchId:       string
  branches:       { id: string; name: string }[]
  rows:           BankRow[]
  from:           string
  to:             string
  rekeningFilter: string
  today:          string
}

const _rp = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
function fmt(n: number) { return 'Rp ' + _rp.format(Math.round(+n || 0)) }
function fmtDate(s: string) {
  const [y, m, d] = s.split('-')
  const bln = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  return `${+d} ${bln[+m - 1]} ${y}`
}

const JENIS_STYLE: Record<string, string> = {
  kredit: 'bg-success-bg text-success border-success-bd',
  debit:  'bg-danger-bg text-danger border-danger-bd',
  saldo:  'bg-sand-100 text-ink-500 border-line',
}

const inputCls = 'h-9 w-full rounded-md border border-line-strong px-3 text-sm bg-white focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100'

export function BankStatementsClient({
  branchId, branches, rows: initialRows, from, to, rekeningFilter, today,
}: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const fileRef  = useRef<HTMLInputElement>(null)

  const [editing,   setEditing]   = useState<BankRow | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [msg,       setMsg]       = useState<{ text: string; ok: boolean } | null>(null)

  const [fRekening,    setFRekening]    = useState<string>(FINANCE_REKENINGS[0])
  const [fDate,        setFDate]        = useState(today)
  const [fJenis,       setFJenis]       = useState<'kredit' | 'debit' | 'saldo'>('kredit')
  const [fNominal,     setFNominal]     = useState('')
  const [fKeterangan,  setFKeterangan]  = useState('')

  function pushFilter(updates: Record<string, string>) {
    const sp = new URLSearchParams({ branch: branchId, from, to, rekening: rekeningFilter })
    Object.entries(updates).forEach(([k, v]) => sp.set(k, v))
    router.push(`${pathname}?${sp.toString()}`)
  }

  function startEdit(row: BankRow) {
    setEditing(row)
    setFRekening(row.rekening)
    setFDate(row.date)
    setFJenis(row.jenis)
    setFNominal(String(row.nominal))
    setFKeterangan(row.keterangan ?? '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditing(null)
    setFRekening(FINANCE_REKENINGS[0])
    setFDate(today)
    setFJenis('kredit')
    setFNominal('')
    setFKeterangan('')
  }

  const handleSave = useCallback(async () => {
    if (!fRekening || !fDate || !fNominal) { setMsg({ text: 'Rekening, tanggal, dan nominal wajib diisi.', ok: false }); return }
    setSaving(true)
    setMsg(null)
    try {
      const payload = { branch_id: branchId, rekening: fRekening, date: fDate, jenis: fJenis, nominal: +fNominal, keterangan: fKeterangan || null }
      const url = editing ? `/api/v1/finance/bank-statements/${editing.id}` : '/api/v1/finance/bank-statements'
      const res = await fetch(url, {
        method:  editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Gagal menyimpan.')
      setMsg({ text: editing ? 'Perubahan tersimpan.' : 'Data ditambahkan.', ok: true })
      cancelEdit()
      router.refresh()
    } catch (e: any) {
      setMsg({ text: e.message, ok: false })
    } finally { setSaving(false) }
  }, [branchId, fRekening, fDate, fJenis, fNominal, fKeterangan, editing])

  async function handleDelete(id: string) {
    if (!confirm('Hapus baris ini?')) return
    setDeleting(id)
    const res = await fetch(`/api/v1/finance/bank-statements/${id}`, { method: 'DELETE' })
    setDeleting(null)
    if (res.ok) { setMsg({ text: 'Data dihapus.', ok: true }); router.refresh() }
    else setMsg({ text: 'Gagal menghapus.', ok: false })
  }

  // ── Excel import (SheetJS loaded via CDN inline) ──────────────────────────
  function downloadTemplate() {
    const header = ['rekening', 'tanggal', 'jenis', 'nominal', 'keterangan']
    const sample = [
      ['BCA PT Scentsored', '2026-07-01', 'kredit', 5000000, 'Transfer masuk'],
      ['Mandiri PT Scentsored', '2026-07-01', 'debit', 1200000, 'Pembelian bahan'],
      ['BCA PT Scentsored', '2026-07-01', 'saldo', 15000000, 'Saldo akhir'],
    ]
    const rows = [header, ...sample]
    const csv  = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'template-rekening-koran.csv' })
    a.click()
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportMsg(null)

    try {
      // Dynamic import XLSX (loaded from CDN in browser)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const XLSX = (window as any).XLSX
      if (!XLSX) throw new Error('Library XLSX belum tersedia. Refresh halaman dan coba lagi.')

      const buf  = await file.arrayBuffer()
      const wb   = XLSX.read(buf, { type: 'array', cellDates: true })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: 'yyyy-mm-dd' })

      // Map kolom fleksibel
      function mapRek(v: string): string | null {
        const s = String(v ?? '').toLowerCase()
        if (s.includes('bca'))     return 'BCA PT Scentsored'
        if (s.includes('mandiri')) return 'Mandiri PT Scentsored'
        return null
      }
      function mapJenis(v: string): string | null {
        const s = String(v ?? '').toLowerCase()
        if (s === 'kredit' || s === 'credit' || s === 'cr') return 'kredit'
        if (s === 'debit'  || s === 'db')                   return 'debit'
        if (s === 'saldo'  || s === 'balance')               return 'saldo'
        return null
      }
      function parseDate(v: any): string | null {
        if (!v) return null
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
        const d = new Date(v)
        if (isNaN(d.getTime())) return null
        return d.toISOString().slice(0, 10)
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (data as any[]).map((row: any) => ({
        rekening:    mapRek(row.rekening ?? row.Rekening ?? row.REKENING ?? ''),
        date:        parseDate(row.tanggal ?? row.Tanggal ?? row.date ?? row.Date ?? row.DATE),
        jenis:       mapJenis(row.jenis ?? row.Jenis ?? row.JENIS ?? row.type ?? row.Type ?? ''),
        nominal:     parseFloat(String(row.nominal ?? row.Nominal ?? row.amount ?? '').replace(/[,\.]/g, m => m === ',' ? '' : '.') || '0'),
        keterangan:  String(row.keterangan ?? row.Keterangan ?? row.description ?? '').trim() || null,
      }))

      const res  = await fetch('/api/v1/finance/bank-statements/import', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ branch_id: branchId, rows }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Import gagal.')

      const skipped = json.skipped?.length ?? 0
      setImportMsg(`✓ ${json.inserted} baris diimport${skipped ? `, ${skipped} dilewati` : ''}.`)
      router.refresh()
    } catch (e: any) {
      setImportMsg(`✗ ${e.message}`)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const totalKredit = initialRows.filter(r => r.jenis === 'kredit').reduce((s, r) => s + +r.nominal, 0)
  const totalDebit  = initialRows.filter(r => r.jenis === 'debit').reduce((s, r)  => s + +r.nominal, 0)

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-[28px] text-pine">Rekening Koran</h1>
        <p className="text-sm text-ink-400 mt-0.5">Mutasi rekening BCA & Mandiri PT Scentsored — untuk pencocokan dengan catatan sistem.</p>
      </div>

      {/* Import section */}
      <div className="bg-white border border-line rounded-xl p-5 mb-5">
        <p className="text-sm font-bold text-ink-700 mb-2">Import dari Excel / CSV</p>
        <p className="text-xs text-ink-400 mb-3">Unduh template, isi sesuai rekening koran bank, lalu unggah — semua baris masuk otomatis.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={downloadTemplate}
            className="h-9 px-4 rounded-md border border-line text-sm font-medium text-ink-600 hover:bg-sand-50 transition-colors">
            ↓ Unduh Template
          </button>
          <label className={`h-9 px-4 rounded-md bg-pine text-white text-sm font-semibold cursor-pointer flex items-center transition-colors hover:bg-pine-700 ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
            {importing ? 'Mengimpor…' : '↑ Unggah File'}
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
          </label>
          {importMsg && (
            <span className={`text-xs font-medium ${importMsg.startsWith('✓') ? 'text-success' : 'text-danger'}`}>
              {importMsg}
            </span>
          )}
        </div>
      </div>

      {/* Manual form */}
      <div className="bg-white border border-line rounded-xl p-5 mb-5">
        <p className="text-sm font-bold text-ink-700 mb-4">{editing ? 'Edit Baris' : 'Tambah Manual'}</p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-ink-500 mb-1">Rekening</label>
            <select className={inputCls} value={fRekening} onChange={e => setFRekening(e.target.value)}>
              {FINANCE_REKENINGS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-ink-500 mb-1">Tanggal</label>
            <input type="date" className={inputCls} value={fDate} onChange={e => setFDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-ink-500 mb-1">Jenis</label>
            <select className={inputCls} value={fJenis} onChange={e => setFJenis(e.target.value as any)}>
              <option value="kredit">Kredit (masuk)</option>
              <option value="debit">Debit (keluar)</option>
              <option value="saldo">Saldo Akhir</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-ink-500 mb-1">Nominal</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-400">Rp</span>
              <input type="number" min="0" className="h-9 w-full rounded-md border border-line-strong pl-9 pr-3 text-sm bg-white font-mono focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100"
                value={fNominal} onChange={e => setFNominal(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-ink-500 mb-1">Keterangan</label>
            <input type="text" className={inputCls} value={fKeterangan} onChange={e => setFKeterangan(e.target.value)} placeholder="Opsional" />
          </div>
        </div>
        {msg && (
          <p className={`text-xs mb-3 font-medium ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>
        )}
        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving}
            className="h-9 px-5 rounded-md bg-pine text-white text-sm font-semibold hover:bg-pine-700 transition-colors disabled:opacity-50">
            {saving ? 'Menyimpan…' : editing ? 'Simpan Perubahan' : 'Tambah'}
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
        <select className="h-9 rounded-md border border-line-strong px-3 text-sm bg-white focus:outline-none"
          value={rekeningFilter} onChange={e => pushFilter({ rekening: e.target.value })}>
          <option value="">Semua rekening</option>
          {FINANCE_REKENINGS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <input type="date" className="h-9 rounded-md border border-line-strong px-3 text-sm bg-white focus:outline-none"
          value={from} onChange={e => pushFilter({ from: e.target.value })} />
        <span className="text-ink-400 text-sm">–</span>
        <input type="date" className="h-9 rounded-md border border-line-strong px-3 text-sm bg-white focus:outline-none"
          value={to} onChange={e => pushFilter({ to: e.target.value })} />
      </div>

      {/* Summary chips */}
      {initialRows.length > 0 && (
        <div className="flex gap-3 mb-4">
          <div className="bg-success-bg border border-success-bd rounded-lg px-4 py-2">
            <p className="text-[10px] font-bold text-success uppercase tracking-wider">Total Kredit</p>
            <p className="font-mono text-sm font-bold text-success tabular-nums mt-0.5">{fmt(totalKredit)}</p>
          </div>
          <div className="bg-danger-bg border border-danger-bd rounded-lg px-4 py-2">
            <p className="text-[10px] font-bold text-danger uppercase tracking-wider">Total Debit</p>
            <p className="font-mono text-sm font-bold text-danger tabular-nums mt-0.5">{fmt(totalDebit)}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-line rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sand-50 border-b border-line text-xs uppercase tracking-wider text-ink-500 text-left">
                <th className="px-4 py-3 font-medium">Tanggal</th>
                <th className="px-3 py-3 font-medium">Rekening</th>
                <th className="px-3 py-3 font-medium">Jenis</th>
                <th className="px-3 py-3 font-medium text-right">Nominal</th>
                <th className="px-3 py-3 font-medium">Keterangan</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {initialRows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-ink-400">Belum ada data.</td></tr>
              )}
              {initialRows.map(row => (
                <tr key={row.id} className="hover:bg-sand-50/50">
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{fmtDate(row.date)}</td>
                  <td className="px-3 py-3 text-xs text-ink-600">{row.rekening}</td>
                  <td className="px-3 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${JENIS_STYLE[row.jenis]}`}>
                      {row.jenis}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs tabular-nums font-semibold">{fmt(+row.nominal)}</td>
                  <td className="px-3 py-3 text-xs text-ink-400 max-w-[200px] truncate">{row.keterangan ?? '—'}</td>
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
          </table>
        </div>
      </div>

      {/* SheetJS dari CDN — hanya di-load di finance module */}
      <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" async />
    </div>
  )
}
