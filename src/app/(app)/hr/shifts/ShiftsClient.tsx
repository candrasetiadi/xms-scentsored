'use client'

import { useState, useEffect, useCallback } from 'react'
import { SectionHeader } from '@/components/hr/SectionHeader'
import { PageTabs }      from '@/components/hr/PageTabs'
import { BottomSheet }   from '@/components/hr/BottomSheet'
import { FormCard }      from '@/components/hr/FormCard'
import { EmptyState }    from '@/components/hr/EmptyState'
import { useToast }      from '@/components/hr/Toast'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Branch { id: string; name: string }

interface Shift {
  id:           string
  name:         string
  start_time:   string
  end_time:     string
  break_minutes: number
  is_active:    boolean
  branch_id:    string | null
}

interface StaffMember {
  id:   string
  name: string
}

interface ScheduleEntry {
  id:       string
  staff_id: string
  date:     string
  shift_id: string
  shift:    { name: string }
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

function addDays(date: Date, n: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toISO(d: Date) {
  return d.toISOString().split('T')[0]
}

function formatDay(d: Date) {
  return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function ShiftsClient({ staffRole, branchId, branches }: Props) {
  const { showToast } = useToast()
  const isOwner = staffRole === 'owner'

  const [tab,        setTab]        = useState('shifts')
  const [filterBranch, setFilterBranch] = useState(branchId ?? '')

  // ── Shift state ────────────────────────────────────────────────────────────
  const [shifts,         setShifts]         = useState<Shift[]>([])
  const [shiftsLoading,  setShiftsLoading]  = useState(true)
  const [sheetOpen,      setSheetOpen]      = useState(false)
  const [editingShift,   setEditingShift]   = useState<Shift | null>(null)
  const [shiftName,      setShiftName]      = useState('')
  const [shiftStart,     setShiftStart]     = useState('')
  const [shiftEnd,       setShiftEnd]       = useState('')
  const [shiftBreak,     setShiftBreak]     = useState('0')
  const [shiftBranch,    setShiftBranch]    = useState('')
  const [shiftSaving,    setShiftSaving]    = useState(false)

  // ── Schedule state ─────────────────────────────────────────────────────────
  const [staffList,       setStaffList]       = useState<StaffMember[]>([])
  const [schedules,       setSchedules]       = useState<ScheduleEntry[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [cellSheet,       setCellSheet]       = useState<{ staffId: string; date: string } | null>(null)
  const [cellShiftId,     setCellShiftId]     = useState('')
  const [cellSaving,      setCellSaving]      = useState(false)

  const today     = new Date()
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(today, i))

  // ── Fetch shifts ───────────────────────────────────────────────────────────
  const fetchShifts = useCallback(async () => {
    setShiftsLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterBranch) params.set('branch_id', filterBranch)
      const res  = await fetch(`/api/v1/hr/shifts?${params}`)
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal memuat shift.', 'error'); return }
      setShifts(json.data ?? [])
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setShiftsLoading(false)
    }
  }, [filterBranch, showToast])

  // ── Fetch schedule ─────────────────────────────────────────────────────────
  const fetchSchedule = useCallback(async () => {
    setScheduleLoading(true)
    try {
      const from   = toISO(weekDates[0])
      const to     = toISO(weekDates[6])
      const params = new URLSearchParams({ from, to })
      if (filterBranch) params.set('branch_id', filterBranch)
      const [schedRes, staffRes] = await Promise.all([
        fetch(`/api/v1/hr/schedules?${params}`),
        fetch(`/api/v1/staff?active=true${filterBranch ? `&branch_id=${filterBranch}` : ''}`),
      ])
      const [schedJson, staffJson] = await Promise.all([schedRes.json(), staffRes.json()])
      if (!schedRes.ok) { showToast(schedJson.error ?? 'Gagal memuat jadwal.', 'error'); return }
      setSchedules(schedJson.data ?? [])
      setStaffList(staffJson.data ?? [])
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setScheduleLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranch, showToast])

  useEffect(() => { fetchShifts() }, [fetchShifts])
  useEffect(() => {
    if (tab === 'schedule') fetchSchedule()
  }, [tab, fetchSchedule])

  // ── Save shift ─────────────────────────────────────────────────────────────
  async function handleShiftSave() {
    if (!shiftName || !shiftStart || !shiftEnd) {
      showToast('Nama, jam mulai, dan jam selesai wajib diisi.', 'error')
      return
    }
    setShiftSaving(true)
    try {
      const body = {
        name:          shiftName,
        start_time:    shiftStart,
        end_time:      shiftEnd,
        break_minutes: parseInt(shiftBreak) || 0,
        branch_id:     shiftBranch || null,
      }
      const url    = editingShift ? `/api/v1/hr/shifts/${editingShift.id}` : '/api/v1/hr/shifts'
      const method = editingShift ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json   = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal menyimpan shift.', 'error'); return }
      showToast(editingShift ? 'Shift diperbarui.' : 'Shift ditambahkan.')
      setSheetOpen(false)
      resetShiftForm()
      fetchShifts()
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setShiftSaving(false)
    }
  }

  async function handleToggleActive(shift: Shift) {
    try {
      const res  = await fetch(`/api/v1/hr/shifts/${shift.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...shift, is_active: !shift.is_active }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal memperbarui.', 'error'); return }
      fetchShifts()
    } catch {
      showToast('Koneksi gagal.', 'error')
    }
  }

  function openEdit(shift: Shift) {
    setEditingShift(shift)
    setShiftName(shift.name)
    setShiftStart(shift.start_time)
    setShiftEnd(shift.end_time)
    setShiftBreak(String(shift.break_minutes))
    setShiftBranch(shift.branch_id ?? '')
    setSheetOpen(true)
  }

  function openAdd() {
    setEditingShift(null)
    resetShiftForm()
    setSheetOpen(true)
  }

  function resetShiftForm() {
    setShiftName(''); setShiftStart(''); setShiftEnd(''); setShiftBreak('0'); setShiftBranch('')
    setEditingShift(null)
  }

  // ── Save cell schedule ─────────────────────────────────────────────────────
  async function handleCellSave() {
    if (!cellSheet || !cellShiftId) { showToast('Pilih shift terlebih dahulu.', 'error'); return }
    setCellSaving(true)
    try {
      const res  = await fetch('/api/v1/hr/schedules', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ staff_id: cellSheet.staffId, date: cellSheet.date, shift_id: cellShiftId }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal menyimpan jadwal.', 'error'); return }
      showToast('Jadwal disimpan.')
      setCellSheet(null)
      setCellShiftId('')
      fetchSchedule()
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setCellSaving(false)
    }
  }

  async function handleCellClear() {
    if (!cellSheet) return
    const existing = schedules.find(s => s.staff_id === cellSheet.staffId && s.date === cellSheet.date)
    if (!existing) { setCellSheet(null); return }
    setCellSaving(true)
    try {
      const res  = await fetch(`/api/v1/hr/schedules/${existing.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal menghapus jadwal.', 'error'); return }
      showToast('Jadwal dihapus.')
      setCellSheet(null)
      setCellShiftId('')
      fetchSchedule()
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setCellSaving(false)
    }
  }

  // ── Schedule lookup ────────────────────────────────────────────────────────
  function getSchedule(staffId: string, date: string) {
    return schedules.find(s => s.staff_id === staffId && s.date === date)
  }

  const tabs = [
    { key: 'shifts',   label: 'Daftar Shift' },
    { key: 'schedule', label: 'Jadwal Mingguan' },
  ]

  return (
    <div className="bg-sand-50 min-h-full p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <SectionHeader title="Shift & Jadwal">
          {isOwner && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-ink-500">Cabang:</label>
              <select
                value={filterBranch}
                onChange={e => setFilterBranch(e.target.value)}
                className="border border-line-strong rounded-md px-2 py-1.5 text-sm text-ink-900 bg-white focus:border-pine-400 focus:ring-2 focus:ring-pine-100 outline-none"
              >
                <option value="">Semua</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
        </SectionHeader>

        <PageTabs tabs={tabs} active={tab} onChange={setTab} />

        {/* ── Daftar Shift ──────────────────────────────────────────────── */}
        {tab === 'shifts' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={openAdd}
                className="bg-pine text-white rounded-lg px-4 py-2 text-sm font-sans font-semibold hover:bg-pine-700 transition-colors"
              >
                + Tambah Shift
              </button>
            </div>

            {shiftsLoading ? (
              <div className="grid sm:grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white border border-line rounded-2xl p-4 shadow-sm animate-pulse">
                    <div className="h-4 w-32 bg-sand-100 rounded mb-2" />
                    <div className="h-3 w-48 bg-sand-100 rounded" />
                  </div>
                ))}
              </div>
            ) : shifts.length === 0 ? (
              <div className="bg-white border border-line rounded-2xl shadow-sm">
                <EmptyState heading="Belum ada shift" subtext="Tambah shift untuk mulai mengatur jadwal karyawan." />
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {shifts.map(shift => (
                  <div
                    key={shift.id}
                    className={`bg-white border rounded-2xl p-4 shadow-sm ${shift.is_active ? 'border-line' : 'border-line opacity-60'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-ink-900">{shift.name}</p>
                        <p className="text-xs text-ink-500 mt-0.5 tabular-nums">
                          {shift.start_time.slice(0, 5)} – {shift.end_time.slice(0, 5)}
                          {shift.break_minutes > 0 && ` · istirahat ${shift.break_minutes}m`}
                        </p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${shift.is_active ? 'bg-success/10 text-success' : 'bg-sand-100 text-ink-500'}`}>
                        {shift.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => openEdit(shift)}
                        className="text-xs text-pine underline underline-offset-2 hover:no-underline"
                      >
                        Edit
                      </button>
                      <span className="text-ink-300">·</span>
                      <button
                        onClick={() => handleToggleActive(shift)}
                        className="text-xs text-ink-500 underline underline-offset-2 hover:no-underline"
                      >
                        {shift.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Jadwal Mingguan ────────────────────────────────────────────── */}
        {tab === 'schedule' && (
          <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
            {scheduleLoading ? (
              <div className="p-6 text-center animate-pulse">
                <div className="h-4 w-48 bg-sand-100 rounded mx-auto mb-2" />
                <div className="h-3 w-32 bg-sand-100 rounded mx-auto" />
              </div>
            ) : staffList.length === 0 ? (
              <EmptyState heading="Tidak ada karyawan" subtext="Tidak ada karyawan aktif di cabang ini." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[640px] w-full border-collapse text-sm font-sans">
                  <thead>
                    <tr className="bg-sand-100">
                      <th className="sticky left-0 z-10 bg-sand-100 px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wide text-left border-b border-r border-line min-w-[140px]">
                        Karyawan
                      </th>
                      {weekDates.map(d => (
                        <th key={toISO(d)} className="px-3 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wide border-b border-line whitespace-nowrap min-w-[100px]">
                          {formatDay(d)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map(member => (
                      <tr key={member.id} className="border-b border-line last:border-0 hover:bg-sand-50 transition-colors">
                        <td className="sticky left-0 z-10 bg-white px-4 py-3 font-medium text-ink-900 border-r border-line">
                          {member.name}
                        </td>
                        {weekDates.map(d => {
                          const iso      = toISO(d)
                          const schedule = getSchedule(member.id, iso)
                          return (
                            <td key={iso} className="px-3 py-3 text-center">
                              <button
                                onClick={() => {
                                  setCellSheet({ staffId: member.id, date: iso })
                                  setCellShiftId(schedule?.shift_id ?? '')
                                }}
                                className="group w-full"
                              >
                                {schedule ? (
                                  <span className="inline-block bg-pine/10 text-pine text-xs font-medium px-2 py-1 rounded-md group-hover:bg-pine/20 transition-colors">
                                    {schedule.shift.name}
                                  </span>
                                ) : (
                                  <span className="inline-block text-ink-300 text-xs group-hover:text-ink-500 transition-colors">–</span>
                                )}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Shift form BottomSheet ──────────────────────────────────────── */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); resetShiftForm() }}
        title={editingShift ? 'Edit Shift' : 'Tambah Shift'}
      >
        <div className="grid gap-3">
          <label>
            <span className="text-xs text-ink-500 mb-1 block">Nama Shift</span>
            <input type="text" value={shiftName} onChange={e => setShiftName(e.target.value)} className={inputCls} placeholder="Pagi, Siang, Malam..." />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="text-xs text-ink-500 mb-1 block">Jam Mulai</span>
              <input type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)} className={inputCls} />
            </label>
            <label>
              <span className="text-xs text-ink-500 mb-1 block">Jam Selesai</span>
              <input type="time" value={shiftEnd} onChange={e => setShiftEnd(e.target.value)} className={inputCls} />
            </label>
          </div>
          <label>
            <span className="text-xs text-ink-500 mb-1 block">Istirahat (menit)</span>
            <input type="number" value={shiftBreak} onChange={e => setShiftBreak(e.target.value)} min={0} className={inputCls} />
          </label>
          <label>
            <span className="text-xs text-ink-500 mb-1 block">Cabang (opsional)</span>
            <select value={shiftBranch} onChange={e => setShiftBranch(e.target.value)} className={inputCls}>
              <option value="">Semua Cabang</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <button
            onClick={handleShiftSave}
            disabled={shiftSaving}
            className="w-full bg-pine text-white rounded-xl py-3 text-sm font-sans font-semibold hover:bg-pine-700 disabled:opacity-45 transition-colors flex items-center justify-center gap-2"
          >
            {shiftSaving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {editingShift ? 'Simpan Perubahan' : 'Tambah Shift'}
          </button>
        </div>
      </BottomSheet>

      {/* ── Cell schedule BottomSheet ──────────────────────────────────── */}
      <BottomSheet
        open={!!cellSheet}
        onClose={() => { setCellSheet(null); setCellShiftId('') }}
        title="Atur Jadwal"
      >
        <div className="grid gap-3">
          <p className="text-xs text-ink-500">
            {cellSheet ? `${staffList.find(s => s.id === cellSheet.staffId)?.name ?? '—'} — ${new Date(cellSheet.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}` : ''}
          </p>
          <label>
            <span className="text-xs text-ink-500 mb-1 block">Shift</span>
            <select value={cellShiftId} onChange={e => setCellShiftId(e.target.value)} className={inputCls}>
              <option value="">Pilih shift...</option>
              {shifts.filter(s => s.is_active).map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.start_time.slice(0,5)}–{s.end_time.slice(0,5)})</option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleCellClear}
              disabled={cellSaving}
              className="flex-1 border border-line-strong text-ink-700 rounded-xl py-2.5 text-sm font-sans font-medium hover:bg-sand-50 disabled:opacity-45 transition-colors"
            >
              Hapus Jadwal
            </button>
            <button
              onClick={handleCellSave}
              disabled={cellSaving || !cellShiftId}
              className="flex-1 bg-pine text-white rounded-xl py-2.5 text-sm font-sans font-semibold hover:bg-pine-700 disabled:opacity-45 transition-colors flex items-center justify-center gap-2"
            >
              {cellSaving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Simpan
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
