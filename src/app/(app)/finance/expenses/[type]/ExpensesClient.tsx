'use client'

import { useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  FINANCE_METHODS, TAX_CATS, BAHAN_JENIS, EXP_TYPE_LABEL, taxChipStyle,
} from '@/lib/finance-constants'

interface ExpenseRow {
  id:        string
  date:      string
  type:      string
  amount:    number
  method:    string
  cat:       string | null
  who:       string | null
  note:      string | null
  photo_url: string | null
}

interface Props {
  type:     'toko' | 'bahan' | 'vendor'
  branchId: string
  branches: { id: string; name: string }[]
  rows:     ExpenseRow[]
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

const inputCls = 'h-9 w-full rounded-md border border-line-strong px-3 text-sm bg-white focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100'
const monoCls  = 'h-9 w-full rounded-md border border-line-strong pl-9 pr-3 text-sm bg-white font-mono focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100'

export function ExpensesClient({ type, branchId, branches, rows: initialRows, from, to, today }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  const [editing,    setEditing]    = useState<ExpenseRow | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [uploading,  setUploading]  = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [photoModal, setPhotoModal] = useState<string | null>(null)
  const [msg,        setMsg]        = useState<{ text: string; ok: boolean } | null>(null)

  // Form fields
  const [fDate,   setFDate]   = useState(today)
  const [fAmount, setFAmount] = useState('')
  const [fMethod, setFMethod] = useState<string>(FINANCE_METHODS[0])
  const [fCat,    setFCat]    = useState<string>(type === 'toko' ? TAX_CATS[0].n : type === 'bahan' ? BAHAN_JENIS[0] : '')
  const [fWho,    setFWho]    = useState('')
  const [fNote,   setFNote]   = useState('')

  const taxCat = type === 'toko' ? TAX_CATS.find(c => c.n === fCat) : null

  function pushFilter(updates: Record<string, string>) {
    const sp = new URLSearchParams({ branch: branchId, from, to })
    Object.entries(updates).forEach(([k, v]) => sp.set(k, v))
    router.push(`${pathname}?${sp.toString()}`)
  }

  function startEdit(row: ExpenseRow) {
    setEditing(row)
    setFDate(row.date)
    setFAmount(String(row.amount))
    setFMethod(row.method)
    setFCat(row.cat ?? (type === 'toko' ? TAX_CATS[0].n : type === 'bahan' ? BAHAN_JENIS[0] : ''))
    setFWho(row.who ?? '')
    setFNote(row.note ?? '')
    setPendingFile(null)
    setPreviewUrl(row.photo_url ?? null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditing(null)
    setFDate(today)
    setFAmount('')
    setFMethod(FINANCE_METHODS[0])
    setFCat(type === 'toko' ? TAX_CATS[0].n : type === 'bahan' ? BAHAN_JENIS[0] : '')
    setFWho('')
    setFNote('')
    setPendingFile(null)
    setPreviewUrl(null)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setPendingFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleSave = useCallback(async () => {
    if (!fDate || !fAmount || !fMethod) { setMsg({ text: 'Tanggal, jumlah, dan metode wajib diisi.', ok: false }); return }
    setSaving(true)
    setMsg(null)
    try {
      let savedId = editing?.id

      if (editing) {
        // Update
        const res = await fetch(`/api/v1/finance/expenses/${editing.id}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: fDate, amount: +fAmount, method: fMethod,
            cat: (type === 'toko' || type === 'bahan') ? fCat : null,
            who: (type === 'bahan' || type === 'vendor') ? fWho || null : null,
            note: fNote || null,
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error?.message ?? 'Gagal menyimpan.')
      } else {
        // Create
        const res = await fetch('/api/v1/finance/expenses', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branch_id: branchId, date: fDate, type, amount: +fAmount, method: fMethod,
            cat: (type === 'toko' || type === 'bahan') ? fCat : null,
            who: (type === 'bahan' || type === 'vendor') ? fWho || null : null,
            note: fNote || null,
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error?.message ?? 'Gagal menyimpan.')
        savedId = json.data?.id
      }

      // Upload foto jika ada
      if (pendingFile && savedId) {
        setUploading(true)
        const form = new FormData()
        form.append('file', pendingFile)
        await fetch(`/api/v1/finance/expenses/${savedId}/photo`, { method: 'POST', body: form })
        setUploading(false)
      }

      setMsg({ text: editing ? 'Perubahan tersimpan.' : 'Pengeluaran disimpan.', ok: true })
      cancelEdit()
      router.refresh()
    } catch (e: any) {
      setMsg({ text: e.message, ok: false })
    } finally { setSaving(false); setUploading(false) }
  }, [branchId, type, fDate, fAmount, fMethod, fCat, fWho, fNote, pendingFile, editing])

  async function handleDelete(id: string) {
    if (!confirm('Hapus pengeluaran ini?')) return
    setDeleting(id)
    const res = await fetch(`/api/v1/finance/expenses/${id}`, { method: 'DELETE' })
    setDeleting(null)
    if (res.ok) { setMsg({ text: 'Data dihapus.', ok: true }); router.refresh() }
    else setMsg({ text: 'Gagal menghapus.', ok: false })
  }

  const totalAmount = initialRows.reduce((s, r) => s + +r.amount, 0)

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-[28px] text-pine">{EXP_TYPE_LABEL[type]}</h1>
        <p className="text-sm text-ink-400 mt-0.5">Catat pengeluaran lengkap dengan foto bukti pembayaran.</p>
      </div>

      {/* Form */}
      <div className="bg-white border border-line rounded-xl p-5 mb-5">
        <p className="text-sm font-bold text-ink-700 mb-4">{editing ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}</p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-ink-500 mb-1">Tanggal</label>
            <input type="date" className={inputCls} value={fDate} onChange={e => setFDate(e.target.value)} max={today} />
          </div>
          <div>
            <label className="block text-xs font-bold text-ink-500 mb-1">Jumlah</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-400">Rp</span>
              <input type="number" min="0" className={monoCls} value={fAmount}
                onChange={e => setFAmount(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-ink-500 mb-1">Metode Bayar</label>
            <select className={inputCls} value={fMethod} onChange={e => setFMethod(e.target.value)}>
              {FINANCE_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Field spesifik per type */}
          {type === 'toko' && (
            <div>
              <label className="block text-xs font-bold text-ink-500 mb-1">Kategori</label>
              <select className={inputCls} value={fCat} onChange={e => setFCat(e.target.value)}>
                {TAX_CATS.map(c => <option key={c.n} value={c.n}>{c.n}</option>)}
              </select>
            </div>
          )}
          {type === 'bahan' && (
            <>
              <div>
                <label className="block text-xs font-bold text-ink-500 mb-1">Jenis</label>
                <select className={inputCls} value={fCat} onChange={e => setFCat(e.target.value)}>
                  {BAHAN_JENIS.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-500 mb-1">Supplier</label>
                <input type="text" className={inputCls} value={fWho} onChange={e => setFWho(e.target.value)} placeholder="Nama supplier" />
              </div>
            </>
          )}
          {type === 'vendor' && (
            <div>
              <label className="block text-xs font-bold text-ink-500 mb-1">Nama Vendor</label>
              <input type="text" className={inputCls} value={fWho} onChange={e => setFWho(e.target.value)} placeholder="Nama vendor" />
            </div>
          )}

          <div className="col-span-2">
            <label className="block text-xs font-bold text-ink-500 mb-1">Catatan</label>
            <input type="text" className={inputCls} value={fNote} onChange={e => setFNote(e.target.value)} placeholder="Opsional" />
          </div>
        </div>

        {/* Tax hint untuk toko */}
        {type === 'toko' && taxCat && (
          <div className="mb-4 p-3 rounded-lg bg-sand-50 border border-line flex items-start gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${taxChipStyle(taxCat.t).cls}`}>
              {taxChipStyle(taxCat.t).label}
            </span>
            <p className="text-xs text-ink-500">{taxCat.note}</p>
          </div>
        )}

        {/* Foto upload */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-ink-500 mb-2">Foto Kwitansi</label>
          {previewUrl ? (
            <div className="flex items-center gap-3">
              <button onClick={() => setPhotoModal(previewUrl)} className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="preview" className="h-16 w-16 object-cover rounded-lg border border-line" />
              </button>
              <button onClick={() => { setPendingFile(null); setPreviewUrl(null) }}
                className="text-xs text-danger hover:underline">Hapus foto</button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-16 border-2 border-dashed border-line rounded-lg cursor-pointer hover:border-pine-300 hover:bg-pine-50 transition-colors">
              <span className="text-xs text-ink-400 font-medium">📷 Klik untuk unggah foto kwitansi</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
          )}
        </div>

        {msg && (
          <p className={`text-xs mb-3 font-medium ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>
        )}
        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving || uploading}
            className="h-9 px-5 rounded-md bg-pine text-white text-sm font-semibold hover:bg-pine-700 transition-colors disabled:opacity-50">
            {uploading ? 'Upload foto…' : saving ? 'Menyimpan…' : editing ? 'Simpan Perubahan' : 'Simpan'}
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
                {type === 'toko'   && <th className="px-3 py-3 font-medium">Kategori</th>}
                {type === 'bahan'  && <th className="px-3 py-3 font-medium">Jenis</th>}
                {type === 'bahan'  && <th className="px-3 py-3 font-medium">Supplier</th>}
                {type === 'vendor' && <th className="px-3 py-3 font-medium">Vendor</th>}
                <th className="px-3 py-3 font-medium">Metode</th>
                <th className="px-3 py-3 font-medium text-right">Jumlah</th>
                <th className="px-3 py-3 font-medium">Catatan</th>
                <th className="px-4 py-3 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {initialRows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-ink-400">Belum ada data.</td></tr>
              )}
              {initialRows.map(row => {
                const taxInfo = type === 'toko' && row.cat ? TAX_CATS.find(c => c.n === row.cat) : null
                const taxStyle = taxInfo ? taxChipStyle(taxInfo.t) : null
                return (
                  <tr key={row.id} className="hover:bg-sand-50/50">
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{fmtDate(row.date)}</td>
                    {type === 'toko' && (
                      <td className="px-3 py-3">
                        <p className="text-xs">{row.cat ?? '—'}</p>
                        {taxStyle && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border mt-0.5 inline-block ${taxStyle.cls}`}>
                            {taxStyle.label}
                          </span>
                        )}
                      </td>
                    )}
                    {type === 'bahan' && (
                      <>
                        <td className="px-3 py-3 text-xs">
                          <span className="bg-sand-100 text-ink-600 px-2 py-0.5 rounded-full text-[10px] font-semibold">{row.cat ?? '—'}</span>
                        </td>
                        <td className="px-3 py-3 text-xs text-ink-600">{row.who ?? '—'}</td>
                      </>
                    )}
                    {type === 'vendor' && (
                      <td className="px-3 py-3 text-xs text-ink-600">{row.who ?? '—'}</td>
                    )}
                    <td className="px-3 py-3 text-xs text-ink-500">{row.method}</td>
                    <td className="px-3 py-3 text-right font-mono text-xs tabular-nums font-semibold">{fmt(+row.amount)}</td>
                    <td className="px-3 py-3 text-xs text-ink-400 max-w-[140px] truncate">{row.note ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {row.photo_url && (
                          <button onClick={() => setPhotoModal(row.photo_url!)}
                            className="text-xs text-ink-400 hover:text-pine transition-colors">📷</button>
                        )}
                        <button onClick={() => startEdit(row)}
                          className="text-xs text-ink-400 hover:text-pine transition-colors font-medium">Edit</button>
                        <button onClick={() => handleDelete(row.id)} disabled={deleting === row.id}
                          className="text-xs text-ink-400 hover:text-danger transition-colors font-medium disabled:opacity-40">
                          {deleting === row.id ? '…' : 'Hapus'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {initialRows.length > 0 && (
              <tfoot>
                <tr className="bg-sand-50 border-t border-line text-xs font-semibold">
                  <td className="px-4 py-3" colSpan={type === 'bahan' ? 4 : type === 'toko' ? 3 : 3}>
                    Total ({initialRows.length} transaksi)
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums font-bold">{fmt(totalAmount)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Photo modal */}
      {photoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setPhotoModal(null)}>
          <div className="relative max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoModal} alt="kwitansi" className="w-full rounded-xl shadow-2xl" />
            <button onClick={() => setPhotoModal(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white border border-line text-ink-700 text-sm font-bold shadow">✕</button>
          </div>
        </div>
      )}
    </div>
  )
}
