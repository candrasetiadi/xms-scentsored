'use client'

import { useState, useEffect, useCallback } from 'react'
import { SectionHeader }   from '@/components/hr/SectionHeader'
import { StatusBadge }     from '@/components/hr/StatusBadge'
import { BottomSheet }     from '@/components/hr/BottomSheet'
import { EmptyState }      from '@/components/hr/EmptyState'
import { TableWrapper, Th, Td } from '@/components/hr/TableWrapper'
import { useToast }        from '@/components/hr/Toast'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Branch { id: string; name: string }

interface Vendor {
  id:           string
  name:         string
  phone:        string | null
  bank_account: string | null
  notes:        string | null
  is_active:    boolean
  branch_id:    string
}

interface Props {
  staffRole: string
  branchId:  string | null
  branches:  Branch[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  'w-full border border-line-strong rounded-md px-3 py-2.5 text-sm font-sans text-ink-900 bg-white ' +
  'focus:border-pine-400 focus:ring-2 focus:ring-pine-100 outline-none placeholder:text-ink-400'

// ── Main ──────────────────────────────────────────────────────────────────────

export function VendorsClient({ staffRole, branchId, branches }: Props) {
  const { showToast } = useToast()
  const isOwner = staffRole === 'owner'

  const [vendors,       setVendors]       = useState<Vendor[]>([])
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [filterBranch,  setFilterBranch]  = useState(isOwner ? '' : (branchId ?? ''))
  const [sheetOpen,     setSheetOpen]     = useState(false)
  const [editing,       setEditing]       = useState<Vendor | null>(null)
  const [saving,        setSaving]        = useState(false)

  // Form fields
  const [fName,        setFName]        = useState('')
  const [fPhone,       setFPhone]       = useState('')
  const [fBank,        setFBank]        = useState('')
  const [fBranch,      setFBranch]      = useState(isOwner ? '' : (branchId ?? ''))
  const [fNotes,       setFNotes]       = useState('')

  const fetchVendors = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterBranch) params.set('branch_id', filterBranch)
      const res  = await fetch(`/api/v1/hr/vendors?${params}`)
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal memuat vendor.', 'error'); return }
      setVendors(json.data ?? [])
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setLoading(false)
    }
  }, [filterBranch, showToast])

  useEffect(() => { fetchVendors() }, [fetchVendors])

  function openAdd() {
    setEditing(null)
    setFName('')
    setFPhone('')
    setFBank('')
    setFBranch(isOwner ? '' : (branchId ?? ''))
    setFNotes('')
    setSheetOpen(true)
  }

  function openEdit(v: Vendor) {
    setEditing(v)
    setFName(v.name)
    setFPhone(v.phone ?? '')
    setFBank(v.bank_account ?? '')
    setFBranch(v.branch_id)
    setFNotes(v.notes ?? '')
    setSheetOpen(true)
  }

  async function handleSave() {
    if (!fName.trim()) { showToast('Nama vendor wajib diisi.', 'error'); return }
    if (!fBranch)      { showToast('Pilih cabang terlebih dahulu.', 'error'); return }

    setSaving(true)
    try {
      const body = {
        name:         fName.trim(),
        phone:        fPhone.trim() || null,
        bank_account: fBank.trim()  || null,
        branch_id:    fBranch,
        notes:        fNotes.trim() || null,
      }

      const res = editing
        ? await fetch(`/api/v1/hr/vendors/${editing.id}`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
          })
        : await fetch('/api/v1/hr/vendors', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
          })

      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal menyimpan.', 'error'); return }

      showToast(editing ? 'Vendor diperbarui.' : 'Vendor ditambahkan.')
      setSheetOpen(false)
      fetchVendors()
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(v: Vendor) {
    if (!confirm(`Nonaktifkan vendor "${v.name}"?`)) return
    try {
      const res  = await fetch(`/api/v1/hr/vendors/${v.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal menonaktifkan.', 'error'); return }
      showToast('Vendor dinonaktifkan.')
      fetchVendors()
    } catch {
      showToast('Koneksi gagal.', 'error')
    }
  }

  const filtered = vendors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="bg-sand-50 min-h-full p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <SectionHeader title="Manajemen Vendor">
          <button
            onClick={openAdd}
            className="bg-pine text-white rounded-xl px-4 py-2 text-sm font-sans font-semibold hover:bg-pine-700 transition-colors"
          >
            + Tambah Vendor
          </button>
        </SectionHeader>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {isOwner && (
            <select
              value={filterBranch}
              onChange={e => setFilterBranch(e.target.value)}
              className="border border-line-strong rounded-xl px-3 py-2.5 text-sm font-sans text-ink-900 bg-white focus:border-pine-400 focus:ring-2 focus:ring-pine-100 outline-none min-w-[180px]"
            >
              <option value="">Semua Cabang</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama vendor..."
            className="flex-1 border border-line-strong rounded-xl px-3 py-2.5 text-sm font-sans text-ink-900 bg-white focus:border-pine-400 focus:ring-2 focus:ring-pine-100 outline-none placeholder:text-ink-400"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3 border-b border-line flex gap-4">
                <div className="h-4 w-40 bg-sand-100 rounded" />
                <div className="h-4 w-28 bg-sand-100 rounded" />
                <div className="h-4 w-28 bg-sand-100 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-line rounded-2xl shadow-sm">
            <EmptyState
              heading="Belum ada vendor"
              subtext="Tambahkan vendor untuk mulai mengelola penggajian vendor."
            />
          </div>
        ) : (
          <TableWrapper>
            <thead>
              <tr>
                <Th>Nama</Th>
                <Th>Telepon</Th>
                <Th>Rekening Bank</Th>
                <Th>Status</Th>
                <Th>Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id} className="border-b border-line last:border-0 hover:bg-sand-50 transition-colors">
                  <Td className="font-medium">{v.name}</Td>
                  <Td>{v.phone ?? <span className="text-ink-400">—</span>}</Td>
                  <Td>{v.bank_account ?? <span className="text-ink-400">—</span>}</Td>
                  <Td>
                    <StatusBadge
                      status={v.is_active ? 'approved' : 'rejected'}
                      label={v.is_active ? 'Aktif' : 'Nonaktif'}
                    />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => openEdit(v)}
                        className="text-xs text-pine underline underline-offset-2 hover:no-underline"
                      >
                        Edit
                      </button>
                      {v.is_active && (
                        <button
                          onClick={() => handleDeactivate(v)}
                          className="text-xs text-danger underline underline-offset-2 hover:no-underline"
                        >
                          Nonaktifkan
                        </button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        )}
      </div>

      {/* Add / Edit Sheet */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? 'Edit Vendor' : 'Tambah Vendor'}
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs text-ink-500 mb-1 block">Nama Vendor *</label>
            <input
              type="text"
              value={fName}
              onChange={e => setFName(e.target.value)}
              placeholder="Nama vendor"
              className={inputCls}
            />
          </div>

          {isOwner && (
            <div>
              <label className="text-xs text-ink-500 mb-1 block">Cabang *</label>
              <select
                value={fBranch}
                onChange={e => setFBranch(e.target.value)}
                className={inputCls}
              >
                <option value="">Pilih cabang...</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-ink-500 mb-1 block">Telepon</label>
            <input
              type="text"
              value={fPhone}
              onChange={e => setFPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              className={inputCls}
            />
          </div>

          <div>
            <label className="text-xs text-ink-500 mb-1 block">Rekening Bank</label>
            <input
              type="text"
              value={fBank}
              onChange={e => setFBank(e.target.value)}
              placeholder="BCA 1234567890 a/n ..."
              className={inputCls}
            />
          </div>

          <div>
            <label className="text-xs text-ink-500 mb-1 block">Catatan</label>
            <textarea
              value={fNotes}
              onChange={e => setFNotes(e.target.value)}
              placeholder="Catatan tambahan..."
              rows={2}
              className={inputCls + ' resize-none'}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setSheetOpen(false)}
              className="flex-1 border border-line-strong text-ink-700 rounded-xl py-3 text-sm font-sans font-medium hover:bg-sand-50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-pine text-white rounded-xl py-3 text-sm font-sans font-semibold hover:bg-pine-700 disabled:opacity-45 transition-colors flex items-center justify-center gap-2"
            >
              {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {editing ? 'Simpan Perubahan' : 'Tambah Vendor'}
            </button>
          </div>
        </div>
      </BottomSheet>

      {staffRole && null}
    </div>
  )
}
