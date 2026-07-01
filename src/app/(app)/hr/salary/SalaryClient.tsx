'use client'

import { useState, useEffect, useCallback } from 'react'
import { SectionHeader } from '@/components/hr/SectionHeader'
import { FormCard }      from '@/components/hr/FormCard'
import { EmptyState }    from '@/components/hr/EmptyState'
import { useToast }      from '@/components/hr/Toast'

// ── Types ──────────────────────────────────────────────────────────────────────

interface StaffMember { id: string; name: string }

interface SalaryComponent {
  id:          string
  name:        string
  type:        'basic' | 'allowance' | 'deduction'
  amount:      number
  is_recurring: boolean
  is_active:   boolean
}

interface Props {
  staffRole: string
  branchId:  string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  'w-full border border-line-strong rounded-md px-3 py-2.5 text-sm font-sans text-ink-900 bg-white ' +
  'focus:border-pine-400 focus:ring-2 focus:ring-pine-100 outline-none placeholder:text-ink-400'

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

// ── Inline-editable amount cell ───────────────────────────────────────────────

function AmountCell({
  component,
  onSave,
}: {
  component: SalaryComponent
  onSave:    (id: string, amount: number) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [val,     setVal]     = useState(String(component.amount))

  async function handleBlur() {
    const parsed = parseInt(val.replace(/\D/g, ''), 10)
    if (!isNaN(parsed) && parsed !== component.amount) {
      await onSave(component.id, parsed)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        type="number"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={handleBlur}
        autoFocus
        className="w-32 border border-pine-400 rounded px-2 py-1 text-sm tabular-nums text-right font-sans focus:ring-2 focus:ring-pine-100 outline-none"
      />
    )
  }

  return (
    <button
      onClick={() => { setEditing(true); setVal(String(component.amount)) }}
      className="text-sm tabular-nums text-ink-900 hover:text-pine underline-offset-2 hover:underline transition-colors"
      title="Klik untuk edit"
    >
      {formatRp(component.amount)}
    </button>
  )
}

// ── Component row ─────────────────────────────────────────────────────────────

function ComponentRow({
  component,
  onSaveAmount,
  onToggleRecurring,
  onDelete,
}: {
  component:         SalaryComponent
  onSaveAmount:      (id: string, amount: number) => Promise<void>
  onToggleRecurring: (id: string, current: boolean) => Promise<void>
  onDelete:          (id: string) => Promise<void>
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-900 truncate">{component.name}</p>
      </div>
      <AmountCell component={component} onSave={onSaveAmount} />
      <button
        onClick={() => onToggleRecurring(component.id, component.is_recurring)}
        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${component.is_recurring ? 'bg-pine/10 text-pine border-pine/20' : 'bg-sand-100 text-ink-500 border-line'}`}
        title={component.is_recurring ? 'Berulang — klik untuk nonaktifkan' : 'Tidak berulang — klik untuk aktifkan'}
      >
        {component.is_recurring ? 'Berulang' : 'Sekali'}
      </button>
      <button
        onClick={() => onDelete(component.id)}
        className="text-xs text-danger hover:text-danger/70 transition-colors"
        title="Hapus komponen"
      >
        Hapus
      </button>
    </div>
  )
}

// ── Inline add form ───────────────────────────────────────────────────────────

function AddComponentForm({
  type,
  onAdd,
  onCancel,
}: {
  type:     'allowance' | 'deduction'
  onAdd:    (name: string, amount: number) => Promise<void>
  onCancel: () => void
}) {
  const [name,   setName]   = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const parsed = parseInt(amount.replace(/\D/g, ''), 10)
    if (!name.trim() || isNaN(parsed) || parsed <= 0) return
    setSaving(true)
    await onAdd(name.trim(), parsed)
    setSaving(false)
  }

  return (
    <div className="flex items-center gap-2 py-2">
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={type === 'allowance' ? 'Nama tunjangan...' : 'Nama potongan...'}
        className="flex-1 border border-line-strong rounded-md px-3 py-2 text-sm font-sans text-ink-900 bg-white focus:border-pine-400 outline-none"
      />
      <input
        type="number"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        placeholder="Jumlah (Rp)"
        className="w-36 border border-line-strong rounded-md px-3 py-2 text-sm font-sans text-ink-900 bg-white focus:border-pine-400 outline-none tabular-nums"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-pine text-white rounded-md px-3 py-2 text-sm font-semibold hover:bg-pine-700 disabled:opacity-45 transition-colors"
      >
        {saving ? '...' : 'Simpan'}
      </button>
      <button onClick={onCancel} className="text-sm text-ink-500 hover:text-ink-900 transition-colors">
        Batal
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function SalaryClient({ staffRole, branchId }: Props) {
  const { showToast } = useToast()

  const [staffList,    setStaffList]    = useState<StaffMember[]>([])
  const [search,       setSearch]       = useState('')
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const [components,   setComponents]   = useState<SalaryComponent[]>([])
  const [compLoading,  setCompLoading]  = useState(false)
  const [showAddAllow, setShowAddAllow] = useState(false)
  const [showAddDeduct, setShowAddDeduct] = useState(false)

  // Fetch staff list
  useEffect(() => {
    async function fetch_() {
      try {
        const params = new URLSearchParams({ active: 'true' })
        if (branchId) params.set('branch_id', branchId)
        const res  = await fetch(`/api/v1/staff?${params}`)
        const json = await res.json()
        setStaffList(json.data ?? [])
      } catch { /* silent */ }
    }
    fetch_()
  }, [branchId])

  const fetchComponents = useCallback(async (staffId: string) => {
    setCompLoading(true)
    try {
      const res  = await fetch(`/api/v1/hr/salary-components?staff_id=${staffId}`)
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal memuat komponen.', 'error'); return }
      setComponents(json.data ?? [])
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setCompLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (selectedId) fetchComponents(selectedId)
    else setComponents([])
  }, [selectedId, fetchComponents])

  async function handleSaveAmount(id: string, amount: number) {
    try {
      const res  = await fetch(`/api/v1/hr/salary-components/${id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ amount }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal menyimpan.', 'error'); return }
      setComponents(prev => prev.map(c => c.id === id ? { ...c, amount } : c))
    } catch {
      showToast('Koneksi gagal.', 'error')
    }
  }

  async function handleToggleRecurring(id: string, current: boolean) {
    try {
      const res  = await fetch(`/api/v1/hr/salary-components/${id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ is_recurring: !current }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal memperbarui.', 'error'); return }
      setComponents(prev => prev.map(c => c.id === id ? { ...c, is_recurring: !current } : c))
    } catch {
      showToast('Koneksi gagal.', 'error')
    }
  }

  async function handleDelete(id: string) {
    try {
      const res  = await fetch(`/api/v1/hr/salary-components/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal menghapus.', 'error'); return }
      setComponents(prev => prev.filter(c => c.id !== id))
      showToast('Komponen dihapus.')
    } catch {
      showToast('Koneksi gagal.', 'error')
    }
  }

  async function handleAdd(type: 'allowance' | 'deduction', name: string, amount: number) {
    if (!selectedId) return
    try {
      const res  = await fetch('/api/v1/hr/salary-components', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ staff_id: selectedId, name, type, amount, is_recurring: true }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal menambahkan.', 'error'); return }
      setComponents(prev => [...prev, json.data])
      setShowAddAllow(false)
      setShowAddDeduct(false)
      showToast('Komponen ditambahkan.')
    } catch {
      showToast('Koneksi gagal.', 'error')
    }
  }

  const filtered    = staffList.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
  const basic       = components.filter(c => c.type === 'basic')
  const allowances  = components.filter(c => c.type === 'allowance')
  const deductions  = components.filter(c => c.type === 'deduction')

  const grossSalary   = [...basic, ...allowances].reduce((s, c) => s + c.amount, 0)
  const totalDeduct   = deductions.reduce((s, c) => s + c.amount, 0)
  const estimatedNet  = grossSalary - totalDeduct

  const selectedStaff = staffList.find(s => s.id === selectedId)

  return (
    <div className="bg-sand-50 min-h-full p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <SectionHeader title="Komponen Gaji" />

        {/* Staff picker */}
        <FormCard className="mb-4">
          <p className="text-xs text-ink-500 mb-2">Cari & Pilih Karyawan</p>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Ketik nama karyawan..."
            className={inputCls}
          />
          {search && filtered.length > 0 && (
            <div className="mt-2 bg-white border border-line rounded-lg overflow-hidden">
              {filtered.slice(0, 8).map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedId(s.id); setSearch('') }}
                  className="w-full text-left px-4 py-2.5 text-sm text-ink-900 hover:bg-sand-50 transition-colors border-b border-line last:border-0"
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
          {selectedStaff && !search && (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm font-medium text-ink-900">
                Dipilih: <span className="text-pine">{selectedStaff.name}</span>
              </p>
              <button
                onClick={() => setSelectedId(null)}
                className="text-xs text-ink-500 underline underline-offset-2 hover:no-underline"
              >
                Ganti
              </button>
            </div>
          )}
        </FormCard>

        {/* Components */}
        {selectedId && (
          compLoading ? (
            <FormCard>
              <div className="animate-pulse space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-8 bg-sand-100 rounded" />
                ))}
              </div>
            </FormCard>
          ) : (
            <FormCard>
              {/* Gaji Pokok */}
              <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Gaji Pokok</p>
              <div className="divide-y divide-line mb-4">
                {basic.length === 0 ? (
                  <p className="text-xs text-ink-400 py-2">Belum ada gaji pokok.</p>
                ) : (
                  basic.map(c => (
                    <ComponentRow
                      key={c.id}
                      component={c}
                      onSaveAmount={handleSaveAmount}
                      onToggleRecurring={handleToggleRecurring}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </div>

              {/* Tunjangan */}
              <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Tunjangan</p>
              <div className="divide-y divide-line mb-2">
                {allowances.length === 0 && !showAddAllow && (
                  <p className="text-xs text-ink-400 py-2">Belum ada tunjangan.</p>
                )}
                {allowances.map(c => (
                  <ComponentRow
                    key={c.id}
                    component={c}
                    onSaveAmount={handleSaveAmount}
                    onToggleRecurring={handleToggleRecurring}
                    onDelete={handleDelete}
                  />
                ))}
                {showAddAllow && (
                  <AddComponentForm
                    type="allowance"
                    onAdd={(name, amount) => handleAdd('allowance', name, amount)}
                    onCancel={() => setShowAddAllow(false)}
                  />
                )}
              </div>
              {!showAddAllow && (
                <button
                  onClick={() => setShowAddAllow(true)}
                  className="text-xs text-pine underline underline-offset-2 hover:no-underline mb-4"
                >
                  + Tambah Tunjangan
                </button>
              )}

              {/* Potongan */}
              <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2 mt-2">Potongan</p>
              <div className="divide-y divide-line mb-2">
                {deductions.length === 0 && !showAddDeduct && (
                  <p className="text-xs text-ink-400 py-2">Belum ada potongan.</p>
                )}
                {deductions.map(c => (
                  <ComponentRow
                    key={c.id}
                    component={c}
                    onSaveAmount={handleSaveAmount}
                    onToggleRecurring={handleToggleRecurring}
                    onDelete={handleDelete}
                  />
                ))}
                {showAddDeduct && (
                  <AddComponentForm
                    type="deduction"
                    onAdd={(name, amount) => handleAdd('deduction', name, amount)}
                    onCancel={() => setShowAddDeduct(false)}
                  />
                )}
              </div>
              {!showAddDeduct && (
                <button
                  onClick={() => setShowAddDeduct(true)}
                  className="text-xs text-pine underline underline-offset-2 hover:no-underline"
                >
                  + Tambah Potongan
                </button>
              )}

              {/* Summary bar */}
              {components.length > 0 && (
                <div className="mt-5 pt-4 border-t border-line grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-ink-500">Gaji Kotor</p>
                    <p className="text-sm font-semibold tabular-nums text-ink-900">{formatRp(grossSalary)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-500">Total Potongan</p>
                    <p className="text-sm font-semibold tabular-nums text-danger">{formatRp(totalDeduct)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-500">Estimasi Net</p>
                    <p className="text-sm font-semibold tabular-nums text-pine">{formatRp(estimatedNet)}</p>
                  </div>
                </div>
              )}
            </FormCard>
          )
        )}

        {!selectedId && !search && (
          <div className="bg-white border border-line rounded-2xl shadow-sm">
            <EmptyState heading="Pilih karyawan" subtext="Cari dan pilih karyawan untuk melihat komponen gajinya." />
          </div>
        )}
      </div>

      {staffRole && null}
    </div>
  )
}
