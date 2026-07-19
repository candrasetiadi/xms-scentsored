'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AutocompleteInput } from '@/components/commission/AutocompleteInput'
import { PhotoBox } from '@/components/commission/PhotoBox'

// ── Types ──────────────────────────────────────────────────────────────────────

type EditEntry = {
  changed_at: string
  reason: string
  changes: Record<string, { old: unknown; new: unknown }>
}

type Transaction = {
  id: string
  tx_date: string
  sale_amount: number
  admin_fee: number
  driver_fee_pct: number
  driver_fee_amount: number
  company_fee_pct: number | null
  company_fee_amount: number | null
  status: 'pending' | 'paid'
  transfer_date: string | null
  transfer_note: string | null
  receipt_photo_url: string | null
  guest_photo_url: string | null
  transfer_photo_url: string | null
  edit_history: EditEntry[] | null
  driver_id: string
  driver_name: string | null
  driver_phone: string | null
  company_id: string | null
  company_name: string | null
  created_at: string
}

type AdvanceFee = {
  id: string
  company_id: string
  company_name: string | null
  amount: number
  given_at: string
  notes: string | null
}

type AdvanceFeeBalance = {
  company_id: string
  company_name: string | null
  total_advance: number
  total_used_fee: number
  balance: number
}

type TopEntry = {
  driver_id?: string
  company_id?: string
  driver_name?: string | null
  company_name?: string | null
  total_sales: number
  total_fee: number
}

type Summary = {
  total_sales: number
  total_driver_fee: number
  total_company_fee: number
  pending_driver: number
  pending_company: number
  tx_count: number
  top_drivers: TopEntry[]
  top_companies: TopEntry[]
  advance_fee_balances: AdvanceFeeBalance[]
}

type RecapDriverItem = {
  driver_id: string
  driver_name: string | null
  tx_count: number
  total_sales: number
  total_driver_fee: number
  pending_fee: number
  paid_fee: number
}

type RecapCompanyItem = {
  company_id: string
  company_name: string | null
  tx_count: number
  total_sales: number
  total_company_fee: number
  pending_fee: number
  paid_fee: number
}

type Driver = { id: string; name: string; fee_value: number; fee_type: string; active: boolean; company_id: string | null }
type Company = { id: string; name: string; fee_value: number }

type BulkTarget = {
  type: 'driver' | 'company'
  name: string
  payeeId: string
  txs: Transaction[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtRp(n: number): string {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n))
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function today(): string { return new Date().toISOString().split('T')[0] }
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}
function monthStart(): string {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().split('T')[0]
}

// ── Toast ─────────────────────────────────────────────────────────────────────

type ToastItem = { id: string; message: string; variant: 'success' | 'error' | 'warning' }

function useToastState() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  function showToast(message: string, variant: 'success' | 'error' | 'warning' = 'success') {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, variant }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), variant === 'error' ? 5000 : 3000)
  }

  return { toasts, showToast }
}

function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null
  return (
    <div aria-live="polite" className="fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 sm:bottom-4 sm:top-auto z-[60] flex flex-col gap-2 items-center sm:items-end pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={['bg-ink-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-sans border-l-4 pointer-events-auto max-w-xs', t.variant === 'success' ? 'border-success' : t.variant === 'error' ? 'border-danger' : 'border-warning'].join(' ')}>
          {t.message}
        </div>
      ))}
    </div>
  )
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, maxW = 'max-w-md' }: { title: string; onClose: () => void; children: React.ReactNode; maxW?: string }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`w-full ${maxW} bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col max-h-[90vh]`}>
        <div className="px-5 py-4 border-b border-line flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-ink-900">{title}</h2>
          <button onClick={onClose} aria-label="Tutup" className="p-1 text-ink-400 hover:text-ink-900 rounded-md hover:bg-sand-100">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3l10 10M3 13L13 3"/></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

// ── Input helpers ─────────────────────────────────────────────────────────────

const inputCls = 'w-full h-10 rounded-lg border border-line-strong px-3 text-sm text-ink-900 bg-white focus:outline-none focus:border-pine focus:ring-2 focus:ring-pine-100 disabled:opacity-50'
const labelCls = 'text-xs font-medium text-ink-600 block mb-1'

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  drivers: Driver[]
  companies: Company[]
}

export function CommissionTrackerClient({ drivers: initialDrivers, companies: initialCompanies }: Props) {
  const { toasts, showToast } = useToastState()

  // Live lists (can grow via auto-create)
  const [drivers, setDrivers]     = useState<Driver[]>(initialDrivers)
  const [companies, setCompanies] = useState<Company[]>(initialCompanies)

  // Date filter
  const [dateFrom, setDateFrom] = useState(daysAgo(2))
  const [dateTo, setDateTo]     = useState(today())
  const [appliedFrom, setAppliedFrom] = useState(daysAgo(2))
  const [appliedTo, setAppliedTo]     = useState(today())

  // Data
  const [summary, setSummary]           = useState<Summary | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [recapDrivers, setRecapDrivers]   = useState<RecapDriverItem[]>([])
  const [recapCompanies, setRecapCompanies] = useState<RecapCompanyItem[]>([])
  const [advanceFees, setAdvanceFees]   = useState<AdvanceFee[]>([])

  // UI
  const [txSearch, setTxSearch]               = useState('')
  const [txStatusFilter, setTxStatusFilter]   = useState<'all' | 'pending' | 'paid'>('all')
  const [recapTab, setRecapTab]               = useState<'driver' | 'company'>('driver')
  const [bulkTab, setBulkTab]                 = useState<'driver' | 'company'>('driver')
  const [afPage, setAfPage]                   = useState(0)
  const [txPage, setTxPage]                   = useState(0)
  const [recapPage, setRecapPage]             = useState(0)

  // Loading
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [loadingTx, setLoadingTx]           = useState(true)

  // Modals
  const [modalTransfer, setModalTransfer]   = useState<Transaction | null>(null)
  const [modalBulk, setModalBulk]           = useState<BulkTarget | null>(null)
  const [modalEdit, setModalEdit]           = useState<Transaction | null>(null)
  const [modalHistory, setModalHistory]     = useState<Transaction | null>(null)
  const [modalAdvanceFee, setModalAdvanceFee] = useState(false)
  const [lightboxUrl, setLightboxUrl]       = useState<string | null>(null)

  // Form — new transaction
  const [formDriverId, setFormDriverId]     = useState('')
  const [formDriverInput, setFormDriverInput] = useState('')
  const [formCompanyId, setFormCompanyId]   = useState('')
  const [formCompanyInput, setFormCompanyInput] = useState('')
  const [formDate, setFormDate]             = useState(today())
  const [formAmount, setFormAmount]         = useState('')
  const [formAdminFee, setFormAdminFee]     = useState('')
  const [formStatus, setFormStatus]         = useState<'pending' | 'paid'>('pending')
  const [formNotes, setFormNotes]           = useState('')
  const [formReceiptFile, setFormReceiptFile] = useState<File | null>(null)
  const [formGuestFile, setFormGuestFile]   = useState<File | null>(null)
  const [formSubmitting, setFormSubmitting] = useState(false)

  // ── Fetch functions ──────────────────────────────────────────────────────────

  const fetchSummary = useCallback(async (from: string, to: string) => {
    setLoadingSummary(true)
    try {
      const res = await fetch(`/api/v1/commission-tracker/summary?from=${from}&to=${to}`)
      const json = await res.json()
      if (json.data) setSummary(json.data)
    } catch {
      showToast('Gagal memuat summary', 'error')
    } finally {
      setLoadingSummary(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTransactions = useCallback(async (from: string, to: string) => {
    setLoadingTx(true)
    try {
      const res = await fetch(`/api/v1/commission-tracker/transactions?from=${from}&to=${to}&limit=200`)
      const json = await res.json()
      if (json.data?.transactions) setTransactions(json.data.transactions)
    } catch {
      showToast('Gagal memuat transaksi', 'error')
    } finally {
      setLoadingTx(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRecapDrivers = useCallback(async (from: string, to: string) => {
    try {
      const res = await fetch(`/api/v1/commission-tracker/recap?type=driver&from=${from}&to=${to}`)
      const json = await res.json()
      if (json.data?.items) setRecapDrivers(json.data.items)
    } catch { /* silent */ }
  }, [])

  const fetchRecapCompanies = useCallback(async (from: string, to: string) => {
    try {
      const res = await fetch(`/api/v1/commission-tracker/recap?type=company&from=${from}&to=${to}`)
      const json = await res.json()
      if (json.data?.items) setRecapCompanies(json.data.items)
    } catch { /* silent */ }
  }, [])

  const fetchAdvanceFees = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/commission-tracker/advance-fees')
      const json = await res.json()
      if (json.data?.advance_fees) setAdvanceFees(json.data.advance_fees)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchSummary(appliedFrom, appliedTo)
    fetchTransactions(appliedFrom, appliedTo)
    fetchRecapDrivers(appliedFrom, appliedTo)
    fetchRecapCompanies(appliedFrom, appliedTo)
    fetchAdvanceFees()
  }, [appliedFrom, appliedTo, fetchSummary, fetchTransactions, fetchRecapDrivers, fetchRecapCompanies, fetchAdvanceFees])

  function applyFilter() {
    setAppliedFrom(dateFrom)
    setAppliedTo(dateTo)
    setAfPage(0)
    setTxPage(0)
    setRecapPage(0)
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const filteredTx = transactions.filter(tx => {
    const matchSearch =
      !txSearch ||
      (tx.driver_name ?? '').toLowerCase().includes(txSearch.toLowerCase()) ||
      (tx.company_name ?? '').toLowerCase().includes(txSearch.toLowerCase())
    const matchStatus = txStatusFilter === 'all' || tx.status === txStatusFilter
    return matchSearch && matchStatus
  })

  // Pending grouped per driver
  const pendingByDriver = (() => {
    const map = new Map<string, { name: string; txs: Transaction[] }>()
    for (const tx of transactions) {
      if (tx.status !== 'pending') continue
      const key = tx.driver_id
      const existing = map.get(key)
      if (existing) existing.txs.push(tx)
      else map.set(key, { name: tx.driver_name ?? tx.driver_id, txs: [tx] })
    }
    return [...map.entries()].map(([id, val]) => ({ id, ...val }))
  })()

  const pendingByCompany = (() => {
    const map = new Map<string, { name: string; txs: Transaction[] }>()
    for (const tx of transactions) {
      if (tx.status !== 'pending' || !tx.company_id) continue
      const key = tx.company_id
      const existing = map.get(key)
      if (existing) existing.txs.push(tx)
      else map.set(key, { name: tx.company_name ?? tx.company_id, txs: [tx] })
    }
    return [...map.entries()].map(([id, val]) => ({ id, ...val }))
  })()

  // Preview calc
  const selectedDriver = drivers.find(d => d.id === formDriverId)
  const selectedCompany = companies.find(c => c.id === formCompanyId)
  const previewAmount = parseFloat(formAmount) || 0
  const previewDriverFee = selectedDriver ? Math.round(previewAmount * selectedDriver.fee_value / 100) : 0
  const previewCompanyFee = selectedCompany ? Math.round(previewAmount * selectedCompany.fee_value / 100) : 0

  // ── Auto-create driver/company ────────────────────────────────────────────────

  async function createDriver(name: string) {
    const res = await fetch('/api/v1/drivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, fee_value: 15, fee_type: 'percentage' }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error?.message ?? 'Gagal membuat driver')
    const newDriver: Driver = { id: json.data.id, name: json.data.name, fee_value: json.data.fee_value, fee_type: json.data.fee_type, active: true, company_id: null }
    setDrivers(prev => [...prev, newDriver].sort((a, b) => a.name.localeCompare(b.name)))
    setFormDriverId(newDriver.id)
    setFormDriverInput(newDriver.name)
    showToast(`Driver "${name}" berhasil ditambahkan`, 'success')
  }

  async function createCompany(name: string) {
    const res = await fetch('/api/v1/driver-companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, fee_value: 5 }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error?.message ?? 'Gagal membuat perusahaan')
    const newCompany: Company = { id: json.data.id, name: json.data.name, fee_value: json.data.fee_value }
    setCompanies(prev => [...prev, newCompany].sort((a, b) => a.name.localeCompare(b.name)))
    setFormCompanyId(newCompany.id)
    setFormCompanyInput(newCompany.name)
    showToast(`Perusahaan "${name}" berhasil ditambahkan`, 'success')
  }

  // ── Submit new transaction ────────────────────────────────────────────────────

  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault()
    if (!formDriverId) { showToast('Pilih mitra terlebih dahulu', 'error'); return }
    if (!formAmount || parseFloat(formAmount) <= 0) { showToast('Amount harus lebih dari 0', 'error'); return }

    setFormSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        driver_id: formDriverId,
        tx_date: formDate,
        sale_amount: parseFloat(formAmount),
        admin_fee: parseFloat(formAdminFee) || 0,
        status: formStatus,
        notes: formNotes || undefined,
      }
      if (formCompanyId) body.company_id = formCompanyId

      const res = await fetch('/api/v1/commission-tracker/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Gagal menyimpan transaksi')

      const txId: string = json.data?.transaction?.id ?? json.data?.id
      if (txId) {
        // Upload photos if present
        const uploads: Promise<void>[] = []
        if (formReceiptFile) uploads.push(uploadPhoto(txId, 'receipt', formReceiptFile))
        if (formGuestFile) uploads.push(uploadPhoto(txId, 'guest', formGuestFile))
        await Promise.allSettled(uploads)
      }

      showToast('Transaksi berhasil disimpan', 'success')
      // Reset form
      setFormDriverId(''); setFormDriverInput('')
      setFormCompanyId(''); setFormCompanyInput('')
      setFormDate(today()); setFormAmount(''); setFormAdminFee('')
      setFormStatus('pending'); setFormNotes('')
      setFormReceiptFile(null); setFormGuestFile(null)
      // Refresh data
      fetchSummary(appliedFrom, appliedTo)
      fetchTransactions(appliedFrom, appliedTo)
      fetchRecapDrivers(appliedFrom, appliedTo)
      fetchRecapCompanies(appliedFrom, appliedTo)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Terjadi kesalahan', 'error')
    } finally {
      setFormSubmitting(false)
    }
  }

  async function uploadPhoto(txId: string, type: 'receipt' | 'guest' | 'transfer', file: File) {
    const fd = new FormData()
    fd.append('tx_id', txId)
    fd.append('photo_type', type)
    fd.append('file', file)
    await fetch('/api/v1/commission-tracker/photos', { method: 'POST', body: fd })
  }

  // ── Payout ────────────────────────────────────────────────────────────────────

  async function handlePayout(txIds: string[], transferDate: string, notes: string, photoFile: File | null): Promise<boolean> {
    let photoUrl: string | undefined
    // Foto payout diupload ke tx pertama agar tersimpan di Storage.
    // mark_commission_transactions_paid akan menyebarkan URL yang sama ke semua tx dalam batch.
    if (photoFile && txIds.length > 0) {
      const fd = new FormData()
      fd.append('tx_id', txIds[0])
      fd.append('photo_type', 'transfer')
      fd.append('file', photoFile)
      const uploadRes = await fetch('/api/v1/commission-tracker/photos', { method: 'POST', body: fd })
      if (uploadRes.ok) {
        const uploadJson = await uploadRes.json()
        photoUrl = uploadJson.data?.url
        // URL ini diteruskan ke payout endpoint dan DB function akan
        // mengaplikasikannya ke transfer_photo_url pada SEMUA tx dalam batch.
      }
    }

    const res = await fetch('/api/v1/commission-tracker/payout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tx_ids: txIds, transfer_date: transferDate, notes: notes || undefined, transfer_photo_url: photoUrl }),
    })
    const json = await res.json()
    if (!res.ok) {
      showToast(json.error?.message ?? 'Gagal melakukan transfer', 'error')
      return false
    }
    showToast('Transfer berhasil dicatat', 'success')
    fetchSummary(appliedFrom, appliedTo)
    fetchTransactions(appliedFrom, appliedTo)
    fetchRecapDrivers(appliedFrom, appliedTo)
    fetchRecapCompanies(appliedFrom, appliedTo)
    return true
  }

  // ── Edit transaction ─────────────────────────────────────────────────────────

  async function handleEditSave(id: string, patch: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/v1/commission-tracker/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (!res.ok) {
      showToast(json.error?.message ?? 'Gagal menyimpan perubahan', 'error')
      return false
    }
    showToast('Transaksi berhasil diubah', 'success')
    fetchSummary(appliedFrom, appliedTo)
    fetchTransactions(appliedFrom, appliedTo)
    return true
  }

  // ── Delete transaction ────────────────────────────────────────────────────────

  async function handleDelete(tx: Transaction) {
    if (!confirm(`Hapus transaksi ${tx.driver_name} (${fmtDate(tx.tx_date)})? Tindakan ini tidak bisa dibatalkan.`)) return
    const res = await fetch(`/api/v1/commission-tracker/transactions/${tx.id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      showToast('Transaksi dihapus', 'success')
      setTransactions(prev => prev.filter(t => t.id !== tx.id))
      fetchSummary(appliedFrom, appliedTo)
    } else {
      const json = await res.json()
      showToast(json.error?.message ?? 'Gagal menghapus transaksi', 'error')
    }
  }

  // ── Advance fee ───────────────────────────────────────────────────────────────

  async function handleDeleteAdvanceFee(id: string) {
    if (!confirm('Hapus advance fee ini?')) return
    const res = await fetch(`/api/v1/commission-tracker/advance-fees/${id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      showToast('Advance fee dihapus', 'success')
      setAdvanceFees(prev => prev.filter(f => f.id !== id))
      fetchSummary(appliedFrom, appliedTo)
    } else {
      showToast('Gagal menghapus advance fee', 'error')
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────────

  async function handleExportJSON() {
    try {
      const res = await fetch(`/api/v1/commission-tracker/transactions?from=${appliedFrom}&to=${appliedTo}&limit=1000`)
      const json = await res.json()
      const data = json.data?.transactions ?? []
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `commission-tracker-${appliedFrom}-${appliedTo}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      showToast('Gagal export data', 'error')
    }
  }

  async function handleExportPDF() {
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF()
      doc.setFontSize(16)
      doc.text('SCENTSORED — Commission Tracker', 14, 18)
      doc.setFontSize(10)
      doc.text(`Periode: ${fmtDate(appliedFrom)} — ${fmtDate(appliedTo)}`, 14, 26)

      let y = 36
      doc.setFontSize(9)
      const headers = ['Tanggal', 'Mitra', 'Perusahaan', 'Penjualan', 'Komisi Mitra', 'Komisi Perusahaan', 'Status']
      const colWidths = [22, 35, 32, 25, 28, 30, 16]
      headers.forEach((h, i) => {
        doc.text(h, 14 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y)
      })
      y += 5
      doc.line(14, y, 196, y)
      y += 3

      for (const tx of filteredTx) {
        if (y > 270) { doc.addPage(); y = 20 }
        const row = [
          fmtDate(tx.tx_date),
          (tx.driver_name ?? '').slice(0, 18),
          (tx.company_name ?? '—').slice(0, 16),
          fmtRp(tx.sale_amount),
          fmtRp(tx.driver_fee_amount),
          tx.company_fee_amount != null ? fmtRp(tx.company_fee_amount) : '—',
          tx.status,
        ]
        row.forEach((cell, i) => {
          doc.text(cell, 14 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y)
        })
        y += 6
      }

      doc.save(`commission-tracker-${appliedFrom}-${appliedTo}.pdf`)
    } catch {
      showToast('Gagal export PDF', 'error')
    }
  }

  // ── Transfer all (bulk tab) ──────────────────────────────────────────────────

  function openTransferAll() {
    const pendingList = bulkTab === 'driver' ? pendingByDriver : pendingByCompany
    if (pendingList.length === 0) { showToast('Tidak ada transaksi pending', 'warning'); return }
    const allTxs = pendingList.flatMap(p => p.txs)
    const name = `Semua ${bulkTab === 'driver' ? 'Mitra' : 'Perusahaan'}`
    setModalBulk({ type: bulkTab, name, payeeId: '', txs: allTxs })
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      <ToastContainer toasts={toasts} />

      <div className="px-4 py-6 space-y-6 pb-32 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div>
        <h1 className="font-display text-3xl text-ink-900">Commission Tracker</h1>
        <p className="text-sm text-ink-500 mt-1">Rekap komisi mitra dan perusahaan</p>
      </div>

        {/* ── Date Filter ── */}
        <div className="bg-white rounded-xl border border-line p-4 flex flex-wrap items-end gap-3 shadow-sm">
          <div>
            <label className={labelCls}>Dari</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls + ' w-40'} />
          </div>
          <div>
            <label className={labelCls}>Sampai</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls + ' w-40'} />
          </div>
          <button
            onClick={applyFilter}
            className="h-10 px-5 rounded-lg bg-pine text-white text-sm font-medium hover:bg-pine-700 transition-colors"
          >
            Terapkan
          </button>
          <span className="text-xs text-ink-400 self-center">
            {loadingSummary ? 'Memuat...' : summary ? `${summary.tx_count} transaksi` : ''}
          </span>
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Penjualan', value: summary?.total_sales },
            { label: 'Komisi Mitra', value: summary?.total_driver_fee },
            { label: 'Komisi Perusahaan', value: summary?.total_company_fee },
          ].map(card => (
            <div key={card.label} className="bg-sand-50 border border-line rounded-xl p-5 shadow-sm">
              <p className="text-xs text-ink-500 mb-1">{card.label}</p>
              <p className="text-2xl font-semibold text-ink-900">
                {loadingSummary ? '—' : fmtRp(card.value ?? 0)}
              </p>
            </div>
          ))}
        </div>

        {/* ── Pending Bar ── */}
        <div className="bg-warning-bg border border-warning-bd rounded-xl p-4 flex flex-wrap gap-6">
          {[
            { label: 'Pending Mitra', value: summary?.pending_driver },
            { label: 'Pending Perusahaan', value: summary?.pending_company },
            { label: 'Total Pending', value: (summary?.pending_driver ?? 0) + (summary?.pending_company ?? 0) },
          ].map(item => (
            <div key={item.label}>
              <p className="text-xs text-warning mb-0.5">{item.label}</p>
              <p className="text-lg font-semibold text-ink-900">{loadingSummary ? '—' : fmtRp(item.value ?? 0)}</p>
            </div>
          ))}
        </div>

        {/* ── Leaderboard ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top Drivers */}
          <div className="bg-white border border-line rounded-xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-ink-900 mb-3">Top 5 Mitra</p>
            {(summary?.top_drivers ?? []).length === 0 ? (
              <p className="text-xs text-ink-400">Belum ada data</p>
            ) : (
              <div className="space-y-2">
                {(summary?.top_drivers ?? []).map((d, i) => {
                  const max = summary!.top_drivers[0]?.total_fee ?? 1
                  const pct = Math.round((d.total_fee / max) * 100)
                  return (
                    <div key={d.driver_id ?? i}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className={['w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0', i === 0 ? 'bg-amber' : i === 1 ? 'bg-ink-400' : 'bg-pine-300'].join(' ')}>{i + 1}</span>
                          <span className="text-ink-900 font-medium truncate max-w-[130px]">{d.driver_name ?? '—'}</span>
                        </span>
                        <span className="text-ink-500 shrink-0">{fmtRp(d.total_fee)}</span>
                      </div>
                      <div className="h-1.5 bg-sand-100 rounded-full overflow-hidden">
                        <div className="h-full bg-pine rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Top Companies */}
          <div className="bg-white border border-line rounded-xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-ink-900 mb-3">Top 5 Perusahaan</p>
            {(summary?.top_companies ?? []).length === 0 ? (
              <p className="text-xs text-ink-400">Belum ada data</p>
            ) : (
              <div className="space-y-2">
                {(summary?.top_companies ?? []).map((c, i) => {
                  const max = summary!.top_companies[0]?.total_fee ?? 1
                  const pct = Math.round((c.total_fee / max) * 100)
                  return (
                    <div key={c.company_id ?? i}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className={['w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0', i === 0 ? 'bg-amber' : i === 1 ? 'bg-ink-400' : 'bg-pine-300'].join(' ')}>{i + 1}</span>
                          <span className="text-ink-900 font-medium truncate max-w-[130px]">{c.company_name ?? '—'}</span>
                        </span>
                        <span className="text-ink-500 shrink-0">{fmtRp(c.total_fee)}</span>
                      </div>
                      <div className="h-1.5 bg-sand-100 rounded-full overflow-hidden">
                        <div className="h-full bg-rust rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Advance Fee Monitor ── */}
        <div className="bg-info-bg border border-info-bd rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-ink-900">Advance Fee Monitor</p>
            <button
              onClick={() => setModalAdvanceFee(true)}
              className="h-8 px-3 rounded-lg bg-pine text-white text-xs font-medium hover:bg-pine-700 transition-colors"
            >
              + Tambah Advance Fee
            </button>
          </div>
          {(() => {
            const AF_PAGE_SIZE = 5
            const allBals = summary?.advance_fee_balances ?? []
            const totalPages = Math.ceil(allBals.length / AF_PAGE_SIZE)
            const pageBals = allBals.slice(afPage * AF_PAGE_SIZE, (afPage + 1) * AF_PAGE_SIZE)
            if (allBals.length === 0) return <p className="text-xs text-ink-400">Belum ada advance fee</p>
            return (
              <>
                <div className="space-y-3">
                  {pageBals.map(bal => {
                    const balPct = bal.total_advance > 0 ? (bal.balance / bal.total_advance) * 100 : 0
                    const balColor = balPct > 20 ? 'text-success' : balPct > 0 ? 'text-warning' : 'text-danger'
                    const barColor = balPct > 20 ? 'bg-success' : balPct > 0 ? 'bg-warning' : 'bg-danger'
                    return (
                      <div key={bal.company_id} className="bg-white rounded-lg border border-line p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-ink-900">{bal.company_name ?? '—'}</span>
                          <span className={`text-sm font-semibold ${balColor}`}>Sisa {fmtRp(bal.balance)}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-ink-500 mb-2">
                          <span>Total Advance: {fmtRp(bal.total_advance)}</span>
                          <span>Terpakai: {fmtRp(bal.total_used_fee)}</span>
                        </div>
                        <div className="h-2 bg-sand-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, Math.max(0, 100 - balPct))}%` }} />
                        </div>
                        <div className="mt-2 flex justify-end">
                          <button onClick={() => {
                            const feesForCompany = advanceFees.filter(f => f.company_id === bal.company_id)
                            if (feesForCompany.length === 0) { showToast('Tidak ada advance fee untuk dihapus', 'warning'); return }
                            if (feesForCompany.length === 1) { handleDeleteAdvanceFee(feesForCompany[0].id) }
                            else { showToast('Pilih advance fee spesifik dari daftar advance fees', 'warning') }
                          }} className="text-xs text-danger hover:underline">Hapus</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-line">
                    <span className="text-xs text-ink-400">
                      {afPage * AF_PAGE_SIZE + 1}–{Math.min((afPage + 1) * AF_PAGE_SIZE, allBals.length)} dari {allBals.length}
                    </span>
                    <div className="flex gap-1">
                      <button
                        disabled={afPage === 0}
                        onClick={() => setAfPage(p => p - 1)}
                        className="h-7 w-7 rounded-md border border-line text-xs text-ink-700 hover:bg-sand-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >‹</button>
                      <button
                        disabled={afPage >= totalPages - 1}
                        onClick={() => setAfPage(p => p + 1)}
                        className="h-7 w-7 rounded-md border border-line text-xs text-ink-700 hover:bg-sand-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >›</button>
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </div>

        {/* ── Bulk Transfer ── */}
        <div className="bg-warning-bg border border-warning-bd rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-ink-900">Transfer Komisi Pending</p>
            <div className="flex gap-1">
              {(['driver', 'company'] as const).map(tab => (
                <button key={tab} onClick={() => setBulkTab(tab)} className={['px-3 py-1 rounded-md text-xs font-medium transition-colors', bulkTab === tab ? 'bg-pine text-white' : 'bg-white border border-line text-ink-700 hover:bg-sand-50'].join(' ')}>
                  {tab === 'driver' ? 'Mitra' : 'Perusahaan'}
                </button>
              ))}
            </div>
          </div>

          {bulkTab === 'driver' ? (
            pendingByDriver.length === 0 ? (
              <p className="text-xs text-ink-400">Tidak ada pending dari mitra</p>
            ) : (
              <div className="space-y-2">
                {pendingByDriver.map(({ id, name, txs }) => {
                  const total = txs.reduce((s, t) => s + t.driver_fee_amount, 0)
                  return (
                    <div key={id} className="flex items-center justify-between bg-white rounded-lg border border-line px-3 py-2.5 text-sm">
                      <span className="font-medium text-ink-900 truncate max-w-[40%]">{name}</span>
                      <span className="text-ink-500 text-xs">{txs.length} transaksi</span>
                      <span className="font-semibold text-ink-900">{fmtRp(total)}</span>
                      <button onClick={() => setModalBulk({ type: 'driver', name, payeeId: id, txs })} className="ml-2 h-7 px-3 rounded-md bg-pine text-white text-xs font-medium hover:bg-pine-700 transition-colors shrink-0">Transfer</button>
                    </div>
                  )
                })}
              </div>
            )
          ) : (
            pendingByCompany.length === 0 ? (
              <p className="text-xs text-ink-400">Tidak ada pending dari perusahaan</p>
            ) : (
              <div className="space-y-2">
                {pendingByCompany.map(({ id, name, txs }) => {
                  const total = txs.reduce((s, t) => s + (t.company_fee_amount ?? 0), 0)
                  return (
                    <div key={id} className="flex items-center justify-between bg-white rounded-lg border border-line px-3 py-2.5 text-sm">
                      <span className="font-medium text-ink-900 truncate max-w-[40%]">{name}</span>
                      <span className="text-ink-500 text-xs">{txs.length} transaksi</span>
                      <span className="font-semibold text-ink-900">{fmtRp(total)}</span>
                      <button onClick={() => setModalBulk({ type: 'company', name, payeeId: id, txs })} className="ml-2 h-7 px-3 rounded-md bg-pine text-white text-xs font-medium hover:bg-pine-700 transition-colors shrink-0">Transfer</button>
                    </div>
                  )
                })}
              </div>
            )
          )}

          <div className="mt-4 flex justify-end">
            <button
              onClick={openTransferAll}
              className="h-9 px-4 rounded-lg bg-warning text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Transfer Semua {bulkTab === 'driver' ? 'Mitra' : 'Perusahaan'}
            </button>
          </div>
        </div>

        {/* ── Form Input Transaksi Baru ── */}
        <div className="bg-white border border-line rounded-xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-ink-900 mb-4">Input Transaksi Baru</p>
          <form onSubmit={handleSubmitForm} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AutocompleteInput
                label="Nama Mitra *"
                options={drivers}
                value={formDriverId}
                inputValue={formDriverInput}
                onChange={(id, name) => { setFormDriverId(id); setFormDriverInput(name) }}
                onInputChange={v => setFormDriverInput(v)}
                placeholder="Cari atau ketik nama mitra..."
                allowCreate
                onCreateNew={createDriver}
              />
              <AutocompleteInput
                label="Perusahaan"
                options={companies}
                value={formCompanyId}
                inputValue={formCompanyInput}
                onChange={(id, name) => { setFormCompanyId(id); setFormCompanyInput(name) }}
                onInputChange={v => setFormCompanyInput(v)}
                placeholder="Cari atau ketik nama perusahaan..."
                allowCreate
                onCreateNew={createCompany}
              />
              <div>
                <label className={labelCls}>Tanggal *</label>
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className={inputCls} required />
              </div>
              <div>
                <label className={labelCls}>Jumlah Penjualan (Rp) *</label>
                <input type="number" min="1" step="1" value={formAmount} onChange={e => setFormAmount(e.target.value)} placeholder="0" className={inputCls} required />
              </div>
              <div>
                <label className={labelCls}>Admin Fee (Rp)</label>
                <input type="number" min="0" step="1" value={formAdminFee} onChange={e => setFormAdminFee(e.target.value)} placeholder="0" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select value={formStatus} onChange={e => setFormStatus(e.target.value as 'pending' | 'paid')} className={inputCls}>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Catatan</label>
              <input type="text" value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Catatan opsional..." className={inputCls} />
            </div>

            {/* Preview calculation */}
            {previewAmount > 0 && (selectedDriver || selectedCompany) && (
              <div className="bg-sand-50 border border-line rounded-lg p-3 text-sm">
                <p className="font-medium text-ink-900 mb-1">Preview Kalkulasi</p>
                <div className="flex flex-wrap gap-4 text-ink-700">
                  {selectedDriver && (
                    <span>Komisi Mitra ({selectedDriver.fee_value}%): <strong>{fmtRp(previewDriverFee)}</strong></span>
                  )}
                  {selectedCompany && (
                    <span>Komisi Perusahaan ({selectedCompany.fee_value}%): <strong>{fmtRp(previewCompanyFee)}</strong></span>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <PhotoBox label="Foto Receipt" icon="receipt" file={formReceiptFile} onChange={setFormReceiptFile} />
              <PhotoBox label="Foto Tamu" icon="photo" file={formGuestFile} onChange={setFormGuestFile} />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={formSubmitting}
                className="h-10 px-6 rounded-lg bg-pine text-white text-sm font-medium hover:bg-pine-700 disabled:opacity-50 transition-colors"
              >
                {formSubmitting ? 'Menyimpan...' : 'Simpan Transaksi'}
              </button>
            </div>
          </form>
        </div>

        {/* ── Riwayat Transaksi ── */}
        <div className="bg-white border border-line rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-ink-900 mr-auto">Riwayat Transaksi</p>
            <input
              type="search"
              value={txSearch}
              onChange={e => { setTxSearch(e.target.value); setTxPage(0) }}
              placeholder="Cari mitra / perusahaan..."
              className="h-9 rounded-lg border border-line-strong px-3 text-sm w-48 focus:outline-none focus:border-pine"
            />
            <div className="flex gap-1">
              {(['all', 'pending', 'paid'] as const).map(s => (
                <button key={s} onClick={() => { setTxStatusFilter(s); setTxPage(0) }} className={['px-3 py-1.5 rounded-md text-xs font-medium transition-colors', txStatusFilter === s ? 'bg-pine text-white' : 'bg-sand-50 border border-line text-ink-700 hover:bg-sand-100'].join(' ')}>
                  {s === 'all' ? 'Semua' : s === 'pending' ? 'Pending' : 'Paid'}
                </button>
              ))}
            </div>
          </div>

          {loadingTx ? (
            <div className="px-5 py-10 text-center text-sm text-ink-400">Memuat transaksi...</div>
          ) : filteredTx.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-ink-400">Tidak ada transaksi ditemukan</div>
          ) : (() => {
            const TX_PAGE_SIZE = 10
            const txTotalPages = Math.ceil(filteredTx.length / TX_PAGE_SIZE)
            const pageTx = filteredTx.slice(txPage * TX_PAGE_SIZE, (txPage + 1) * TX_PAGE_SIZE)
            return (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-sand-50">
                      <tr>
                        {['Tanggal', 'Mitra / Perusahaan', 'Foto', 'Penjualan', 'Komisi Mitra', 'Komisi Perusahaan', 'Status', 'Aksi'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-ink-500 border-b border-line whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {pageTx.map(tx => (
                        <tr key={tx.id} className={tx.status === 'pending' ? 'bg-warning-bg/40' : ''}>
                          <td className="px-3 py-2.5 text-ink-900 whitespace-nowrap">{fmtDate(tx.tx_date)}</td>
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-ink-900">{tx.driver_name ?? '—'}</p>
                            {tx.company_name && <p className="text-xs text-ink-500">{tx.company_name}</p>}
                            {tx.transfer_note && <p className="text-xs text-ink-400 italic">{tx.transfer_note}</p>}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-1">
                              {tx.receipt_photo_url && (
                                <button onClick={() => setLightboxUrl(tx.receipt_photo_url!)} className="w-8 h-8 rounded border border-line overflow-hidden hover:opacity-80">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={tx.receipt_photo_url} alt="receipt" className="w-full h-full object-cover" />
                                </button>
                              )}
                              {tx.guest_photo_url && (
                                <button onClick={() => setLightboxUrl(tx.guest_photo_url!)} className="w-8 h-8 rounded border border-line overflow-hidden hover:opacity-80">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={tx.guest_photo_url} alt="guest" className="w-full h-full object-cover" />
                                </button>
                              )}
                              {tx.transfer_photo_url && (
                                <button onClick={() => setLightboxUrl(tx.transfer_photo_url!)} className="w-8 h-8 rounded border border-line overflow-hidden hover:opacity-80">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={tx.transfer_photo_url} alt="bukti transfer" className="w-full h-full object-cover" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-ink-900 whitespace-nowrap">{fmtRp(tx.sale_amount)}</td>
                          <td className="px-3 py-2.5 text-ink-900 whitespace-nowrap">{fmtRp(tx.driver_fee_amount)}</td>
                          <td className="px-3 py-2.5 text-ink-900 whitespace-nowrap">{tx.company_fee_amount != null ? fmtRp(tx.company_fee_amount) : '—'}</td>
                          <td className="px-3 py-2.5">
                            <span className={['inline-block px-2 py-0.5 rounded-full text-xs font-medium', tx.status === 'pending' ? 'bg-warning-bg text-warning border border-warning-bd' : 'bg-success-bg text-success border border-success-bd'].join(' ')}>
                              {tx.status === 'pending' ? 'Pending' : 'Paid'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-1.5">
                              {tx.status === 'pending' && (
                                <button onClick={() => setModalTransfer(tx)} className="text-xs text-pine hover:underline">Transfer</button>
                              )}
                              <button onClick={() => setModalEdit(tx)} className="text-xs text-ink-500 hover:underline">Edit</button>
                              <button onClick={() => handleDelete(tx)} className="text-xs text-danger hover:underline">Hapus</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {txTotalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-line">
                    <span className="text-xs text-ink-400">
                      {txPage * TX_PAGE_SIZE + 1}–{Math.min((txPage + 1) * TX_PAGE_SIZE, filteredTx.length)} dari {filteredTx.length} transaksi
                    </span>
                    <div className="flex gap-1">
                      <button disabled={txPage === 0} onClick={() => setTxPage(p => p - 1)}
                        className="h-7 w-7 rounded-md border border-line text-xs text-ink-700 hover:bg-sand-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹</button>
                      <button disabled={txPage >= txTotalPages - 1} onClick={() => setTxPage(p => p + 1)}
                        className="h-7 w-7 rounded-md border border-line text-xs text-ink-700 hover:bg-sand-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">›</button>
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </div>

        {/* ── Rekap Komisi ── */}
        <div className="bg-white border border-line rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center gap-3">
            <p className="text-sm font-semibold text-ink-900 mr-auto">Rekap Komisi</p>
            <div className="flex gap-1">
              {(['driver', 'company'] as const).map(tab => (
                <button key={tab} onClick={() => { setRecapTab(tab); setRecapPage(0) }} className={['px-3 py-1.5 rounded-md text-xs font-medium transition-colors', recapTab === tab ? 'bg-pine text-white' : 'bg-sand-50 border border-line text-ink-700 hover:bg-sand-100'].join(' ')}>
                  {tab === 'driver' ? 'Per Mitra' : 'Per Perusahaan'}
                </button>
              ))}
            </div>
          </div>
          {(() => {
            const RECAP_PAGE_SIZE = 10
            const recapData   = recapTab === 'driver' ? recapDrivers : recapCompanies
            const recapTotal  = recapData.length
            const recapPages  = Math.ceil(recapTotal / RECAP_PAGE_SIZE)
            const pageRecap   = recapData.slice(recapPage * RECAP_PAGE_SIZE, (recapPage + 1) * RECAP_PAGE_SIZE)
            return (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-sand-50">
                      <tr>
                        {['Nama', 'Transaksi', 'Total Penjualan', 'Komisi', 'Paid', 'Pending'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-ink-500 border-b border-line whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {recapTotal === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-6 text-center text-xs text-ink-400">Belum ada data</td></tr>
                      ) : recapTab === 'driver' ? (
                        (pageRecap as typeof recapDrivers).map(item => (
                          <tr key={item.driver_id}>
                            <td className="px-4 py-2.5 font-medium text-ink-900">{item.driver_name ?? '—'}</td>
                            <td className="px-4 py-2.5 text-ink-700">{item.tx_count}</td>
                            <td className="px-4 py-2.5 text-ink-700">{fmtRp(item.total_sales)}</td>
                            <td className="px-4 py-2.5 font-medium text-ink-900">{fmtRp(item.total_driver_fee)}</td>
                            <td className="px-4 py-2.5 text-success">{fmtRp(item.paid_fee)}</td>
                            <td className="px-4 py-2.5 text-warning">{fmtRp(item.pending_fee)}</td>
                          </tr>
                        ))
                      ) : (
                        (pageRecap as typeof recapCompanies).map(item => (
                          <tr key={item.company_id}>
                            <td className="px-4 py-2.5 font-medium text-ink-900">{item.company_name ?? '—'}</td>
                            <td className="px-4 py-2.5 text-ink-700">{item.tx_count}</td>
                            <td className="px-4 py-2.5 text-ink-700">{fmtRp(item.total_sales)}</td>
                            <td className="px-4 py-2.5 font-medium text-ink-900">{fmtRp(item.total_company_fee)}</td>
                            <td className="px-4 py-2.5 text-success">{fmtRp(item.paid_fee)}</td>
                            <td className="px-4 py-2.5 text-warning">{fmtRp(item.pending_fee)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {recapPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-line">
                    <span className="text-xs text-ink-400">
                      {recapPage * RECAP_PAGE_SIZE + 1}–{Math.min((recapPage + 1) * RECAP_PAGE_SIZE, recapTotal)} dari {recapTotal}
                    </span>
                    <div className="flex gap-1">
                      <button disabled={recapPage === 0} onClick={() => setRecapPage(p => p - 1)}
                        className="h-7 w-7 rounded-md border border-line text-xs text-ink-700 hover:bg-sand-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹</button>
                      <button disabled={recapPage >= recapPages - 1} onClick={() => setRecapPage(p => p + 1)}
                        className="h-7 w-7 rounded-md border border-line text-xs text-ink-700 hover:bg-sand-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">›</button>
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </div>

        {/* ── Export ── */}
        <div className="flex gap-3 justify-end">
          <button onClick={handleExportPDF} className="h-9 px-4 rounded-lg border border-line text-sm text-ink-700 hover:bg-sand-50 transition-colors">Export PDF</button>
          <button onClick={handleExportJSON} className="h-9 px-4 rounded-lg border border-line text-sm text-ink-700 hover:bg-sand-50 transition-colors">Export Semua Data (JSON)</button>
        </div>

      </div>{/* end wrapper */}

      {/* ── Modals ── */}
      {modalTransfer && (
        <TransferSingleModal
          tx={modalTransfer}
          onClose={() => setModalTransfer(null)}
          onConfirm={async (date, notes, photo) => {
            const ok = await handlePayout([modalTransfer.id], date, notes, photo)
            if (ok) setModalTransfer(null)
          }}
        />
      )}

      {modalBulk && (
        <BulkTransferModal
          target={modalBulk}
          onClose={() => setModalBulk(null)}
          onConfirm={async (date, notes, photo) => {
            const ids = modalBulk.txs.map(t => t.id)
            const ok = await handlePayout(ids, date, notes, photo)
            if (ok) setModalBulk(null)
          }}
        />
      )}

      {modalEdit && (
        <EditModal
          tx={modalEdit}
          onClose={() => setModalEdit(null)}
          onHistory={() => { setModalHistory(modalEdit); setModalEdit(null) }}
          onSave={async (patch) => {
            const ok = await handleEditSave(modalEdit.id, patch)
            if (ok) setModalEdit(null)
          }}
        />
      )}

      {modalHistory && (
        <HistoryModal tx={modalHistory} onClose={() => { setModalHistory(null) }} />
      )}

      {modalAdvanceFee && (
        <AdvanceFeeModal
          companies={companies}
          onClose={() => setModalAdvanceFee(false)}
          onSave={async (body) => {
            const res = await fetch('/api/v1/commission-tracker/advance-fees', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            })
            const json = await res.json()
            if (!res.ok) {
              showToast(json.error?.message ?? 'Gagal menambah advance fee', 'error')
              return
            }
            showToast('Advance fee berhasil ditambahkan', 'success')
            setModalAdvanceFee(false)
            fetchAdvanceFees()
            fetchSummary(appliedFrom, appliedTo)
          }}
        />
      )}

      {lightboxUrl && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <button className="absolute top-4 right-4 text-white text-2xl leading-none" onClick={() => setLightboxUrl(null)}>x</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxUrl} alt="fullscreen" className="max-w-full max-h-full object-contain rounded-xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  )
}

// ── TransferSingleModal ───────────────────────────────────────────────────────

function TransferSingleModal({ tx, onClose, onConfirm }: {
  tx: Transaction
  onClose: () => void
  onConfirm: (date: string, notes: string, photo: File | null) => Promise<void>
}) {
  const [date, setDate]     = useState(today())
  const [notes, setNotes]   = useState('')
  const [photo, setPhoto]   = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleConfirm() {
    setSaving(true)
    try { await onConfirm(date, notes, photo) } finally { setSaving(false) }
  }

  return (
    <Modal title="Ubah ke Sudah Ditransfer" onClose={onClose}>
      <div className="px-5 py-4 space-y-3">
        <div className="bg-sand-50 border border-line rounded-lg p-3 text-sm space-y-1">
          <p><span className="text-ink-500">Mitra:</span> <strong>{tx.driver_name}</strong></p>
          <p><span className="text-ink-500">Tanggal Transaksi:</span> {fmtDate(tx.tx_date)}</p>
          <p><span className="text-ink-500">Komisi Mitra:</span> {fmtRp(tx.driver_fee_amount)}</p>
          {tx.company_name && <p><span className="text-ink-500">Komisi Perusahaan ({tx.company_name}):</span> {fmtRp(tx.company_fee_amount ?? 0)}</p>}
        </div>
        <div>
          <label className={labelCls}>Tanggal Transfer *</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
        </div>
        <PhotoBox label="Foto Bukti Transfer" icon="transfer" file={photo} onChange={setPhoto} />
        <div>
          <label className={labelCls}>Catatan</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opsional..." className={inputCls} />
        </div>
      </div>
      <div className="px-5 pb-5 flex gap-2">
        <button onClick={onClose} disabled={saving} className="flex-1 h-10 rounded-lg border border-line text-sm font-medium text-ink-700 hover:bg-sand-50">Batal</button>
        <button onClick={handleConfirm} disabled={saving || !date} className="flex-1 h-10 rounded-lg bg-pine text-white text-sm font-medium hover:bg-pine-700 disabled:opacity-50">
          {saving ? 'Menyimpan...' : 'Konfirmasi Transfer'}
        </button>
      </div>
    </Modal>
  )
}

// ── BulkTransferModal ─────────────────────────────────────────────────────────

function BulkTransferModal({ target, onClose, onConfirm }: {
  target: BulkTarget
  onClose: () => void
  onConfirm: (date: string, notes: string, photo: File | null) => Promise<void>
}) {
  const [date, setDate]     = useState(today())
  const [notes, setNotes]   = useState('')
  const [photo, setPhoto]   = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const totalDriverFee  = target.txs.reduce((s, t) => s + t.driver_fee_amount, 0)
  const totalCompanyFee = target.txs.reduce((s, t) => s + (t.company_fee_amount ?? 0), 0)

  async function handleConfirm() {
    setSaving(true)
    try { await onConfirm(date, notes, photo) } finally { setSaving(false) }
  }

  return (
    <Modal title={`Transfer Komisi — ${target.name}`} onClose={onClose} maxW="max-w-lg">
      <div className="px-5 py-4 space-y-3">
        <div className="max-h-48 overflow-y-auto border border-line rounded-lg divide-y divide-line">
          {target.txs.map(tx => (
            <div key={tx.id} className="px-3 py-2 flex items-center justify-between text-sm">
              <span className="text-ink-700">{fmtDate(tx.tx_date)} — {tx.driver_name}</span>
              <span className="font-medium">{fmtRp(target.type === 'driver' ? tx.driver_fee_amount : (tx.company_fee_amount ?? 0))}</span>
            </div>
          ))}
        </div>
        <div className="bg-sand-50 border border-line rounded-lg p-3 text-sm flex justify-between font-semibold">
          <span>Total</span>
          <span>{fmtRp(target.type === 'driver' ? totalDriverFee : totalCompanyFee)}</span>
        </div>
        <div>
          <label className={labelCls}>Tanggal Transfer *</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
        </div>
        <PhotoBox label="Foto Bukti Transfer" icon="transfer" file={photo} onChange={setPhoto} />
        <div>
          <label className={labelCls}>Catatan</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opsional..." className={inputCls} />
        </div>
      </div>
      <div className="px-5 pb-5 flex gap-2">
        <button onClick={onClose} disabled={saving} className="flex-1 h-10 rounded-lg border border-line text-sm font-medium text-ink-700 hover:bg-sand-50">Batal</button>
        <button onClick={handleConfirm} disabled={saving || !date} className="flex-1 h-10 rounded-lg bg-pine text-white text-sm font-medium hover:bg-pine-700 disabled:opacity-50">
          {saving ? 'Mentransfer...' : `Transfer ${target.txs.length} Transaksi`}
        </button>
      </div>
    </Modal>
  )
}

// ── EditModal ─────────────────────────────────────────────────────────────────

function EditModal({ tx, onClose, onHistory, onSave }: {
  tx: Transaction
  onClose: () => void
  onHistory: () => void
  onSave: (patch: Record<string, unknown>) => Promise<void>
}) {
  const [txDate, setTxDate]       = useState(tx.tx_date)
  const [amount, setAmount]       = useState(String(tx.sale_amount))
  const [adminFee, setAdminFee]   = useState(String(tx.admin_fee))
  const [status, setStatus]       = useState<'pending' | 'paid'>(tx.status)
  const [notes, setNotes]         = useState(tx.transfer_note ?? '')
  const [reason, setReason]       = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  async function handleSave() {
    if (!reason.trim()) { setError('Alasan edit wajib diisi'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({
        tx_date: txDate,
        sale_amount: parseFloat(amount),
        admin_fee: parseFloat(adminFee) || 0,
        status,
        transfer_note: notes || undefined,
        edit_reason: reason.trim(),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Edit Transaksi" onClose={onClose}>
      <div className="px-5 py-4 space-y-3">
        <div>
          <label className={labelCls}>Tanggal</label>
          <input type="date" value={txDate} onChange={e => setTxDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Jumlah Penjualan (Rp)</label>
          <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Admin Fee (Rp)</label>
          <input type="number" min="0" value={adminFee} onChange={e => setAdminFee(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value as 'pending' | 'paid')} className={inputCls}>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Catatan</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Alasan Edit *</label>
          <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Jelaskan alasan perubahan..." className={inputCls} />
        </div>
        {error && <p className="text-xs text-danger bg-danger-bg border border-danger-bd rounded-lg px-3 py-2">{error}</p>}
        {(tx.edit_history?.length ?? 0) > 0 && (
          <button onClick={onHistory} className="text-xs text-pine hover:underline">Lihat Riwayat Edit ({tx.edit_history?.length})</button>
        )}
      </div>
      <div className="px-5 pb-5 flex gap-2">
        <button onClick={onClose} disabled={saving} className="flex-1 h-10 rounded-lg border border-line text-sm font-medium text-ink-700 hover:bg-sand-50">Batal</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 h-10 rounded-lg bg-pine text-white text-sm font-medium hover:bg-pine-700 disabled:opacity-50">
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </Modal>
  )
}

// ── HistoryModal ──────────────────────────────────────────────────────────────

function HistoryModal({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const history = tx.edit_history ?? []
  return (
    <Modal title="Riwayat Edit" onClose={onClose} maxW="max-w-lg">
      <div className="px-5 py-4 space-y-3">
        {history.length === 0 ? (
          <p className="text-sm text-ink-400">Belum ada riwayat edit</p>
        ) : (
          [...history].reverse().map((entry, i) => (
            <div key={i} className="border border-line rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-ink-500">
                <span>{new Date(entry.changed_at).toLocaleString('id-ID')}</span>
              </div>
              <p className="text-sm font-medium text-ink-900">Alasan: {entry.reason}</p>
              {Object.entries(entry.changes).map(([field, change]) => (
                <p key={field} className="text-xs text-ink-600">
                  <span className="font-medium">{field}</span>: {String(change.old)} &rarr; {String(change.new)}
                </p>
              ))}
            </div>
          ))
        )}
      </div>
    </Modal>
  )
}

// ── AdvanceFeeModal ────────────────────────────────────────────────────────────

function AdvanceFeeModal({ companies, onClose, onSave }: {
  companies: Company[]
  onClose: () => void
  onSave: (body: { company_id: string; amount: number; given_at: string; notes?: string }) => Promise<void>
}) {
  const [companyId, setCompanyId]     = useState('')
  const [companyInput, setCompanyInput] = useState('')
  const [amount, setAmount]           = useState('')
  const [givenAt, setGivenAt]         = useState(today())
  const [notes, setNotes]             = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  async function handleSave() {
    if (!companyId) { setError('Pilih perusahaan terlebih dahulu'); return }
    if (!amount || parseFloat(amount) <= 0) { setError('Jumlah harus lebih dari 0'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({ company_id: companyId, amount: parseFloat(amount), given_at: givenAt, notes: notes || undefined })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Tambah Advance Fee" onClose={onClose}>
      <div className="px-5 py-4 space-y-3">
        <AutocompleteInput
          label="Perusahaan *"
          options={companies}
          value={companyId}
          inputValue={companyInput}
          onChange={(id, name) => { setCompanyId(id); setCompanyInput(name) }}
          onInputChange={v => setCompanyInput(v)}
          placeholder="Cari perusahaan..."
        />
        <div>
          <label className={labelCls}>Jumlah (Rp) *</label>
          <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Tanggal Diberikan *</label>
          <input type="date" value={givenAt} onChange={e => setGivenAt(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Catatan</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opsional..." className={inputCls} />
        </div>
        {error && <p className="text-xs text-danger bg-danger-bg border border-danger-bd rounded-lg px-3 py-2">{error}</p>}
      </div>
      <div className="px-5 pb-5 flex gap-2">
        <button onClick={onClose} disabled={saving} className="flex-1 h-10 rounded-lg border border-line text-sm font-medium text-ink-700 hover:bg-sand-50">Batal</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 h-10 rounded-lg bg-pine text-white text-sm font-medium hover:bg-pine-700 disabled:opacity-50">
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </Modal>
  )
}
