'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Branch { id: string; name: string }
interface StaffMember {
  id:        string
  name:      string
  nickname:  string | null
  team:      string | null
  job_title: string | null
  role:      string
  active:    boolean
  branch_id: string | null
}

interface Props {
  initialStaff: StaffMember[]
  branches:     Branch[]
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner', admin: 'Admin', cashier: 'Kasir',
  perfumer: 'Peracik', stock_keeper: 'Stock Keeper',
}

const ROLE_COLOR: Record<string, string> = {
  owner:        'bg-purple-50 text-purple-700 border-purple-200',
  admin:        'bg-pine-50 text-pine border-pine-100',
  cashier:      'bg-sky-50 text-sky-700 border-sky-200',
  perfumer:     'bg-amber-50 text-amber-700 border-amber-200',
  stock_keeper: 'bg-sand-100 text-ink-600 border-line',
}

const TEAM_COLOR: Record<string, string> = {
  SALES: 'bg-sky-50 text-sky-700 border-sky-200',
  RACIK: 'bg-amber-50 text-amber-700 border-amber-200',
  FLOOR: 'bg-green-50 text-green-700 border-green-200',
  OFFICE: 'bg-purple-50 text-purple-700 border-purple-200',
}

const TEAMS = ['SALES', 'RACIK', 'FLOOR', 'OFFICE']

const EMPTY_FORM = {
  name: '', email: '', password: '', role: 'cashier', branch_id: '',
  nickname: '', team: '', job_title: '',
}

// ── Field wrapper ──────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-ink-700">{label}</label>
      {children}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function StaffClient({ initialStaff, branches }: Props) {
  const router = useRouter()
  const [staff, setStaff]     = useState(initialStaff)
  const [search, setSearch]   = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [modalOpen, setModal] = useState(false)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [form, setForm]       = useState(EMPTY_FORM)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const branchMap = Object.fromEntries(branches.map(b => [b.id, b.name]))

  const filtered = staff.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      s.name.toLowerCase().includes(q) ||
      (s.nickname ?? '').toLowerCase().includes(q) ||
      (s.job_title ?? '').toLowerCase().includes(q) ||
      ROLE_LABEL[s.role]?.toLowerCase().includes(q)
    const matchTeam = !teamFilter || s.team === teamFilter
    return matchSearch && matchTeam
  })

  const activeCount   = staff.filter(s => s.active).length
  const inactiveCount = staff.length - activeCount

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM); setError(null); setModal(true)
  }

  function openEdit(s: StaffMember) {
    setEditing(s)
    setForm({
      name: s.name, email: '', password: '', role: s.role, branch_id: s.branch_id ?? '',
      nickname: s.nickname ?? '', team: s.team ?? '', job_title: s.job_title ?? '',
    })
    setError(null); setModal(true)
  }

  async function handleSave() {
    setError(null)
    if (!form.name.trim()) { setError('Nama wajib diisi.'); return }
    if (!editing && !form.email.trim()) { setError('Email wajib diisi.'); return }
    if (!editing && form.password.length < 6) { setError('Password minimal 6 karakter.'); return }

    setSaving(true)
    try {
      if (editing) {
        const res = await fetch(`/api/v1/hr/staff/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:      form.name,
            role:      form.role,
            branch_id: form.branch_id || null,
            nickname:  form.nickname || null,
            team:      form.team || null,
            job_title: form.job_title || null,
          }),
        })
        const json = await res.json()
        if (!res.ok) { setError(json.error ?? 'Gagal menyimpan.'); return }
        setStaff(prev => prev.map(s => s.id === editing.id ? { ...s, ...json.data } : s))
      } else {
        const res = await fetch('/api/v1/hr/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name, email: form.email, password: form.password,
            role: form.role, branch_id: form.branch_id || null,
            nickname: form.nickname || null, team: form.team || null, job_title: form.job_title || null,
          }),
        })
        const json = await res.json()
        if (!res.ok) { setError(json.error ?? 'Gagal membuat karyawan.'); return }
        router.refresh()
      }
      setModal(false)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(s: StaffMember) {
    const res = await fetch(`/api/v1/hr/staff/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !s.active }),
    })
    if (res.ok) setStaff(prev => prev.map(p => p.id === s.id ? { ...p, active: !p.active } : p))
  }

  const inp = 'h-11 rounded-lg border border-line-strong px-3.5 text-sm text-ink-900 bg-white focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100 transition-colors'

  return (
    <div className="bg-sand-50 min-h-full p-4 md:p-6">
      {/* Page header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-ink-900">Data Karyawan</h2>
        <p className="text-sm text-ink-400 mt-0.5">
          {staff.length} karyawan · {activeCount} aktif
          {inactiveCount > 0 && ` · ${inactiveCount} nonaktif`}
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
            width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.75"
          >
            <circle cx="6.5" cy="6.5" r="4.5"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/>
          </svg>
          <input
            placeholder="Cari nama, nick, jabatan…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-11 rounded-lg border border-line-strong pl-10 pr-4 text-sm text-ink-900 bg-white focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100 transition-colors"
          />
        </div>
        <select
          value={teamFilter}
          onChange={e => setTeamFilter(e.target.value)}
          className="h-11 rounded-lg border border-line-strong px-3 text-sm text-ink-900 bg-white focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100 transition-colors"
        >
          <option value="">Semua Tim</option>
          {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          onClick={openCreate}
          className="h-11 px-5 rounded-lg bg-pine text-white text-sm font-semibold hover:bg-pine-700 active:scale-[0.98] transition-all shrink-0 flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 1v12M1 7h12"/>
          </svg>
          Tambah Karyawan
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-line rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-line bg-sand-50">
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">Karyawan</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider hidden md:table-cell">Tim</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">Role</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider hidden lg:table-cell">Cabang</th>
              <th className="px-5 py-3.5 text-center text-xs font-semibold text-ink-500 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center">
                  <p className="text-sm text-ink-400">
                    {search || teamFilter ? 'Tidak ada hasil yang cocok.' : 'Belum ada karyawan.'}
                  </p>
                </td>
              </tr>
            )}
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-sand-50/60 transition-colors group">
                {/* Karyawan: avatar + nama + nick + jabatan */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-full bg-pine-100 text-pine flex items-center justify-center text-sm font-bold select-none">
                        {(s.nickname ?? s.name).charAt(0).toUpperCase()}
                      </div>
                      {s.nickname && (
                        <span className="absolute -bottom-1 -right-1 text-[9px] font-bold bg-pine text-white rounded px-0.5 leading-tight">
                          {s.nickname}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-ink-900 truncate">{s.name}</p>
                      {s.job_title && (
                        <p className="text-xs text-ink-400 truncate mt-0.5">{s.job_title}</p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Tim */}
                <td className="px-5 py-4 hidden md:table-cell">
                  {s.team ? (
                    <span className={`inline-flex text-xs px-2.5 py-1 rounded-full font-semibold border ${TEAM_COLOR[s.team] ?? 'bg-sand-100 text-ink-600 border-line'}`}>
                      {s.team}
                    </span>
                  ) : (
                    <span className="text-ink-300 text-xs">—</span>
                  )}
                </td>

                {/* Role */}
                <td className="px-5 py-4">
                  <span className={`inline-flex text-xs px-2.5 py-1 rounded-full font-medium border ${ROLE_COLOR[s.role] ?? 'bg-sand-100 text-ink-600 border-line'}`}>
                    {ROLE_LABEL[s.role] ?? s.role}
                  </span>
                </td>

                {/* Cabang */}
                <td className="px-5 py-4 text-sm text-ink-500 hidden lg:table-cell">
                  {s.branch_id ? branchMap[s.branch_id] : <span className="text-ink-300">Semua cabang</span>}
                </td>

                {/* Status */}
                <td className="px-5 py-4 text-center">
                  <button
                    onClick={() => toggleActive(s)}
                    title={s.active ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                    className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                      s.active
                        ? 'bg-success-bg text-success border-success-bd hover:bg-success/10'
                        : 'bg-sand-100 text-ink-400 border-line hover:bg-sand-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${s.active ? 'bg-success' : 'bg-ink-300'}`} />
                    {s.active ? 'Aktif' : 'Nonaktif'}
                  </button>
                </td>

                {/* Actions */}
                <td className="px-5 py-4 text-right">
                  <button
                    onClick={() => openEdit(s)}
                    className="text-xs font-medium text-ink-400 hover:text-pine transition-colors opacity-0 group-hover:opacity-100 px-3 py-1.5 rounded-md hover:bg-pine-50"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-line bg-sand-50 text-xs text-ink-400">
            Menampilkan {filtered.length} dari {staff.length} karyawan
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModal(false)}
        title={editing ? 'Edit Karyawan' : 'Tambah Karyawan'}
      >
        <div className="flex flex-col gap-5">
          <Field label="Nama Lengkap *">
            <input
              className={inp}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Budi Santoso"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Nickname">
              <input
                className={inp}
                value={form.nickname}
                onChange={e => setForm(f => ({ ...f, nickname: e.target.value.toUpperCase() }))}
                placeholder="BUDI"
                maxLength={10}
              />
            </Field>
            <Field label="Tim">
              <select
                className={inp}
                value={form.team}
                onChange={e => setForm(f => ({ ...f, team: e.target.value }))}
              >
                <option value="">— Pilih Tim —</option>
                {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Jabatan">
            <input
              className={inp}
              value={form.job_title}
              onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))}
              placeholder="Olfactory Consultant"
            />
          </Field>

          {!editing && (
            <>
              <Field label="Email Login *">
                <input
                  className={inp}
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="budi@scentsored.com"
                />
              </Field>
              <Field label="Password *">
                <input
                  className={inp}
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min. 6 karakter"
                />
              </Field>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Role *">
              <select
                className={inp}
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              >
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="cashier">Kasir</option>
                <option value="perfumer">Peracik</option>
                <option value="stock_keeper">Stock Keeper</option>
              </select>
            </Field>
            <Field label="Cabang">
              <select
                className={inp}
                value={form.branch_id}
                onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}
              >
                <option value="">Semua cabang</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </Field>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 text-sm text-danger bg-danger-bg border border-danger-bd rounded-lg px-4 py-3">
              <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <circle cx="7" cy="7" r="6"/><path d="M7 4.5v3M7 9.5v.5"/>
              </svg>
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setModal(false)}
              className="flex-1 h-11 rounded-lg border border-line-strong text-sm font-medium text-ink-700 hover:bg-sand-50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-11 rounded-lg bg-pine text-white text-sm font-semibold hover:bg-pine-700 disabled:opacity-45 active:scale-[0.98] transition-all"
            >
              {saving ? 'Menyimpan…' : editing ? 'Simpan Perubahan' : 'Buat Karyawan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
