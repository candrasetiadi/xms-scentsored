'use client'

import { useState, useEffect } from 'react'
import { SectionHeader } from '@/components/hr/SectionHeader'
import { FormCard }      from '@/components/hr/FormCard'
import { useToast }      from '@/components/hr/Toast'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Branch { id: string; name: string }

interface HrSettings {
  late_tolerance_minutes: number
  overtime_rate_per_hour: number
  vendor_fee_per_tx:      number
}

interface Props {
  staffRole: string
  branchId:  string | null
  branches:  Branch[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  'flex-1 border border-line-strong rounded-md px-3 py-2.5 text-sm font-sans text-ink-900 bg-white ' +
  'focus:border-pine-400 focus:ring-2 focus:ring-pine-100 outline-none tabular-nums'

// ── Main ──────────────────────────────────────────────────────────────────────

export function HrSettingsClient({ staffRole, branchId, branches }: Props) {
  const { showToast } = useToast()
  const isOwner = staffRole === 'owner'

  const [selectedBranch,   setSelectedBranch]   = useState(isOwner ? '' : (branchId ?? ''))
  const [tolerance,        setTolerance]         = useState('15')
  const [overtimeRate,     setOvertimeRate]      = useState('25000')
  const [vendorFee,        setVendorFee]         = useState('500')
  const [loading,          setLoading]           = useState(false)
  const [saving,           setSaving]            = useState(false)

  useEffect(() => {
    if (!selectedBranch) return
    setLoading(true)
    fetch(`/api/v1/hr/settings?branch_id=${selectedBranch}`)
      .then(r => r.json())
      .then(json => {
        if (json.data) {
          setTolerance(String(json.data.late_tolerance_minutes ?? 15))
          setOvertimeRate(String(json.data.overtime_rate_per_hour ?? 25000))
          setVendorFee(String(json.data.vendor_fee_per_tx ?? 500))
        }
      })
      .catch(() => showToast('Gagal memuat pengaturan.', 'error'))
      .finally(() => setLoading(false))
  }, [selectedBranch, showToast])

  async function handleSave() {
    if (!selectedBranch) { showToast('Pilih cabang terlebih dahulu.', 'error'); return }
    const tolMin    = parseInt(tolerance, 10)
    const otRate    = parseInt(overtimeRate.replace(/\D/g, ''), 10)
    const vendorFeeVal = parseInt(vendorFee.replace(/\D/g, ''), 10)
    if (isNaN(tolMin) || isNaN(otRate) || isNaN(vendorFeeVal)) { showToast('Nilai tidak valid.', 'error'); return }

    setSaving(true)
    try {
      const res  = await fetch('/api/v1/hr/settings', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          branch_id:               selectedBranch,
          late_tolerance_minutes:  tolMin,
          overtime_rate_per_hour:  otRate,
          vendor_fee_per_tx:       vendorFeeVal,
        }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Gagal menyimpan.', 'error'); return }
      showToast('Pengaturan berhasil disimpan.')
    } catch {
      showToast('Koneksi gagal.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-sand-50 min-h-full p-4 md:p-6">
      <div className="max-w-lg mx-auto">
        <SectionHeader title="Pengaturan SDM" />

        {/* Branch picker (owner only) */}
        {isOwner && (
          <FormCard className="mb-4">
            <label>
              <span className="text-xs text-ink-500 mb-1 block">Pilih Cabang</span>
              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="w-full border border-line-strong rounded-md px-3 py-2.5 text-sm font-sans text-ink-900 bg-white focus:border-pine-400 focus:ring-2 focus:ring-pine-100 outline-none"
              >
                <option value="">Pilih cabang...</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          </FormCard>
        )}

        {/* Settings form */}
        {(selectedBranch || !isOwner) && (
          <FormCard>
            <p className="text-sm font-semibold text-ink-900 mb-4">
              {branches.find(b => b.id === selectedBranch)?.name ?? 'Pengaturan Cabang'}
            </p>

            {loading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-10 bg-sand-100 rounded-md" />
                <div className="h-10 bg-sand-100 rounded-md" />
              </div>
            ) : (
              <div className="grid gap-4">
                {/* Toleransi */}
                <div>
                  <label className="text-xs text-ink-500 mb-1 block">
                    Toleransi Keterlambatan (menit)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={tolerance}
                      onChange={e => setTolerance(e.target.value)}
                      min={0}
                      max={120}
                      className={inputCls}
                      placeholder="15"
                    />
                    <span className="text-sm text-ink-500 whitespace-nowrap">menit</span>
                  </div>
                  <p className="text-xs text-ink-400 mt-1">
                    Karyawan yang masuk lebih dari {tolerance} menit setelah jam shift dianggap terlambat.
                  </p>
                </div>

                {/* Tarif Lembur */}
                <div>
                  <label className="text-xs text-ink-500 mb-1 block">
                    Tarif Lembur per Jam
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-ink-500 whitespace-nowrap">Rp</span>
                    <input
                      type="number"
                      value={overtimeRate}
                      onChange={e => setOvertimeRate(e.target.value)}
                      min={0}
                      step={1000}
                      className={inputCls}
                      placeholder="25000"
                    />
                  </div>
                  <p className="text-xs text-ink-400 mt-1">
                    Dasar perhitungan biaya lembur per jam kerja tambahan.
                  </p>
                </div>

                {/* Tarif Fee Vendor */}
                <div>
                  <label className="text-xs text-ink-500 mb-1 block">
                    Tarif Fee Vendor (Rp/transaksi)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-ink-500 whitespace-nowrap">Rp</span>
                    <input
                      type="number"
                      value={vendorFee}
                      onChange={e => setVendorFee(e.target.value)}
                      min={0}
                      step={100}
                      className={inputCls}
                      placeholder="500"
                    />
                    <span className="text-sm text-ink-500 whitespace-nowrap">/transaksi</span>
                  </div>
                  <p className="text-xs text-ink-400 mt-1">
                    Fee yang dibayarkan ke vendor per transaksi yang ditangani.
                  </p>
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-pine text-white rounded-xl py-3 text-sm font-sans font-semibold hover:bg-pine-700 disabled:opacity-45 transition-colors flex items-center justify-center gap-2 mt-2"
                >
                  {saving && (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  Simpan Pengaturan
                </button>
              </div>
            )}
          </FormCard>
        )}

        {isOwner && !selectedBranch && (
          <div className="bg-white border border-line rounded-2xl shadow-sm p-8 text-center">
            <p className="text-sm text-ink-500">Pilih cabang untuk melihat dan mengubah pengaturan SDM.</p>
          </div>
        )}
      </div>
    </div>
  )
}
