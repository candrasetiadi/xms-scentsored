'use client'

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useId,
} from 'react'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScentCategory { id: string; name: string; color_hex: string }
interface WorkshopMaterial {
  id: string
  name: string
  dilution_percentage: number | null
  category: ScentCategory | null
}

type ItemGrams = number | ''
type ItemDrops = number | ''
type ItemAdj   = number | ''

interface FormulationItem {
  _key:        string
  material_id: string
  drops:       ItemDrops
  grams:       ItemGrams
  adj:         ItemAdj
}

interface SlotInfo { date: string; start_time: string; end_time: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAYS_ID   = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return `${DAYS_ID[dt.getDay()]}, ${dt.getDate()} ${MONTHS_ID[dt.getMonth()]}`
}
function fmtTime(t: string) { return t.slice(0, 5) }
const formatGram = (n: number) => n % 1 === 0 ? `${n}g` : `${n.toFixed(2)}g`

let _keyCounter = 0
function nextKey() { return String(++_keyCounter) }

// ── useDebounce ───────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ── CategoryPill ──────────────────────────────────────────────────────────────

function CategoryPill({ category }: { category: ScentCategory | null }) {
  if (!category) return <span className="text-xs text-ink-400">—</span>
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
      style={{ backgroundColor: category.color_hex + '25', color: category.color_hex }}
    >
      {category.name}
    </span>
  )
}

// ── MaterialPicker ────────────────────────────────────────────────────────────

interface MaterialPickerProps {
  materials:      WorkshopMaterial[]
  selectedIds:    Set<string>
  onSelect:       (material: WorkshopMaterial) => void
  onClose:        () => void
}

function MaterialPicker({ materials, selectedIds, onSelect, onClose }: MaterialPickerProps) {
  const [search,          setSearch]          = useState('')
  const [categoryFilter,  setCategoryFilter]  = useState<string | null>(null)
  const debouncedSearch = useDebounce(search, 300)
  const searchRef       = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Unique categories
  const categories = useMemo<ScentCategory[]>(() => {
    const seen = new Map<string, ScentCategory>()
    materials.forEach(m => {
      if (m.category && !seen.has(m.category.id)) seen.set(m.category.id, m.category)
    })
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [materials])

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim()
    return materials.filter(m => {
      const matchName = !q || m.name.toLowerCase().includes(q)
      const matchCat  = !q || (m.category?.name.toLowerCase().includes(q) ?? false)
      const matchFilter = !categoryFilter || m.category?.id === categoryFilter
      return (matchName || matchCat) && matchFilter
    }).slice(0, 50)
  }, [materials, debouncedSearch, categoryFilter])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-safe-top pt-4 pb-2 border-b border-line bg-white">
        <div className="flex-1 relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={searchRef}
            type="search"
            placeholder="Cari bahan..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-line bg-sand-50 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-pine-200 focus:border-pine"
          />
        </div>
        <button
          onClick={onClose}
          className="px-3 py-2 rounded-xl border border-line text-sm text-ink-600 hover:bg-sand-100 transition-colors"
        >
          Batal
        </button>
      </div>

      {/* Category filter pills */}
      <div className="overflow-x-auto flex gap-2 py-2 px-4 scrollbar-hide border-b border-line bg-white">
        <button
          onClick={() => setCategoryFilter(null)}
          className={[
            'flex-shrink-0 text-xs px-3 py-1 rounded-full font-medium border transition-colors',
            !categoryFilter
              ? 'bg-pine text-white border-pine'
              : 'bg-white text-ink-600 border-line hover:bg-sand-50',
          ].join(' ')}
        >
          Semua
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategoryFilter(prev => prev === cat.id ? null : cat.id)}
            className="flex-shrink-0 text-xs px-3 py-1 rounded-full font-medium border transition-colors"
            style={
              categoryFilter === cat.id
                ? { backgroundColor: cat.color_hex, color: '#fff', borderColor: cat.color_hex }
                : { backgroundColor: cat.color_hex + '20', color: cat.color_hex, borderColor: cat.color_hex + '40' }
            }
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Material list */}
      <div className="flex-1 overflow-y-auto divide-y divide-line">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-ink-400 text-sm">
            Bahan tidak ditemukan
          </div>
        ) : (
          filtered.map(m => {
            const alreadyAdded = selectedIds.has(m.id)
            return (
              <button
                key={m.id}
                onClick={() => { onSelect(m); onClose() }}
                className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-sand-50 active:bg-sand-100 transition-colors"
              >
                {/* Checkmark or spacer */}
                <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                  {alreadyAdded && (
                    <svg className="w-4 h-4 text-pine" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-900 truncate">{m.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <CategoryPill category={m.category} />
                    {m.dilution_percentage !== null && (
                      <span className="text-xs text-ink-400">{m.dilution_percentage}%</span>
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
        {filtered.length === 50 && (
          <p className="px-4 py-3 text-xs text-ink-400 text-center">
            Menampilkan 50 hasil pertama — ketik lebih spesifik untuk menyempurnakan pencarian
          </p>
        )}
      </div>
    </div>
  )
}

// ── WorkshopFormClient ────────────────────────────────────────────────────────

interface Props {
  slotId:   string | null
  slotInfo: SlotInfo | null
}

type Step = 'info' | 'formulation'

const INPUT_CLS =
  'w-full rounded-xl px-4 py-3.5 text-sm border outline-none focus:ring-2 focus:ring-pine-200 focus:border-pine border-line text-ink-900 bg-white placeholder:text-ink-300'

export function WorkshopFormClient({ slotId, slotInfo }: Props) {
  const router = useRouter()

  // Step
  const [step, setStep] = useState<Step>('info')

  // Customer info
  const [name,       setName]       = useState('')
  const [phone,      setPhone]      = useState('')
  const [social,     setSocial]     = useState('')
  const [perfumeName, setPerfumeName] = useState('')
  const [theme,      setTheme]      = useState('')
  const [notes,      setNotes]      = useState('')

  // Materials
  const [materials,      setMaterials]      = useState<WorkshopMaterial[]>([])
  const [materialsLoading, setMaterialsLoading] = useState(false)
  const [materialsError,   setMaterialsError]   = useState('')

  // Formulation items
  const [items,       setItems]       = useState<FormulationItem[]>([])
  const [showPicker,  setShowPicker]  = useState(false)

  // Submit state
  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState('')

  const nameId        = useId()
  const phoneId       = useId()
  const socialId      = useId()
  const perfumeNameId = useId()
  const themeId       = useId()
  const notesId       = useId()

  // Fetch materials once
  useEffect(() => {
    if (materials.length > 0) return
    setMaterialsLoading(true)
    setMaterialsError('')
    fetch('/api/v1/public/workshop/materials')
      .then(r => r.json())
      .then(j => setMaterials(j.data ?? []))
      .catch(() => setMaterialsError('Gagal memuat daftar bahan. Coba muat ulang halaman.'))
      .finally(() => setMaterialsLoading(false))
  }, [materials.length])

  // Material lookup map
  const materialMap = useMemo(() => {
    const m = new Map<string, WorkshopMaterial>()
    materials.forEach(mat => m.set(mat.id, mat))
    return m
  }, [materials])

  // Set of already-selected material IDs (for checkmarks in picker)
  const selectedMaterialIds = useMemo(
    () => new Set(items.map(i => i.material_id)),
    [items],
  )

  // Total grams
  const totalGrams = useMemo(
    () => items.reduce((sum, item) => sum + (typeof item.grams === 'number' ? item.grams : 0), 0),
    [items],
  )

  const remainingGrams = 25 - totalGrams
  const isOver  = totalGrams > 25
  const isNear  = !isOver && totalGrams >= 20
  const barPct  = Math.min((totalGrams / 25) * 100, 100)

  const barColorClass  = isOver ? 'bg-danger'   : isNear ? 'bg-amber-400' : 'bg-pine'
  const textColorClass = isOver ? 'text-danger'  : isNear ? 'text-amber-600' : 'text-ink-900'

  // Validation
  const hasEmptyGrams   = items.some(i => i.grams === '')
  const canSubmit       = items.length > 0 && !isOver && !hasEmptyGrams

  // Step 1 validation
  const canProceed = name.trim() !== '' && perfumeName.trim() !== ''

  function handleAddMaterial(material: WorkshopMaterial) {
    setItems(prev => [
      ...prev,
      { _key: nextKey(), material_id: material.id, drops: '', grams: '', adj: '' },
    ])
  }

  function handleRemoveItem(key: string) {
    setItems(prev => prev.filter(i => i._key !== key))
  }

  function handleUpdateItem(key: string, field: 'drops' | 'grams' | 'adj', value: number | '') {
    setItems(prev =>
      prev.map(i => i._key === key ? { ...i, [field]: value } : i),
    )
  }

  function parseNumInput(raw: string): number | '' {
    if (raw === '' || raw === '-') return ''
    const n = parseFloat(raw)
    return isNaN(n) ? '' : n
  }

  async function handleSubmit() {
    setSubmitError('')
    setSubmitting(true)

    const payload = {
      slot_id:       slotId ?? undefined,
      customer_name:   name.trim(),
      customer_phone:  phone.trim() || undefined,
      customer_social: social.trim() || undefined,
      perfume_name:    perfumeName.trim(),
      theme:           theme.trim() || undefined,
      notes:           notes.trim() || undefined,
      items: items.map(({ material_id, drops, grams, adj }) => ({
        material_id,
        drops: drops === '' ? null : drops,
        grams: grams as number,
        adj:   adj   === '' ? null : adj,
      })),
    }

    try {
      const res  = await fetch('/api/v1/public/workshop/formulations', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error?.message ?? 'Gagal menyimpan formulasi. Coba lagi.')
        return
      }
      router.push(`/workshop/result/${json.data.access_token}`)
    } catch {
      setSubmitError('Koneksi gagal. Periksa internet kamu dan coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render: Step 1 ─────────────────────────────────────────────────────────

  if (step === 'info') {
    return (
      <div className="flex-1 flex flex-col px-4 py-6 max-w-md mx-auto w-full">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-pine text-white text-xs font-semibold flex items-center justify-center">1</span>
            <span className="text-sm font-semibold text-ink-900">Info Kamu</span>
          </div>
          <div className="flex-1 h-px bg-line" />
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-sand-200 text-ink-400 text-xs font-semibold flex items-center justify-center">2</span>
            <span className="text-sm text-ink-400">Racik Parfum</span>
          </div>
        </div>

        {/* Slot banner */}
        {slotInfo && (
          <div className="mb-4 rounded-xl border border-line bg-white px-4 py-3 flex items-start gap-3">
            <svg className="w-4 h-4 text-pine mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <div>
              <p className="text-sm font-medium text-ink-900">{fmtDate(slotInfo.date)}</p>
              <p className="text-xs text-ink-500 mt-0.5">{fmtTime(slotInfo.start_time)} – {fmtTime(slotInfo.end_time)}</p>
            </div>
          </div>
        )}

        {/* Form fields */}
        <div className="space-y-4 flex-1">
          <div>
            <label htmlFor={nameId} className="block text-xs font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">
              Nama Lengkap <span className="text-danger">*</span>
            </label>
            <input
              id={nameId}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nama kamu"
              autoComplete="name"
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label htmlFor={phoneId} className="block text-xs font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">
              No. HP / WhatsApp
            </label>
            <input
              id={phoneId}
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              autoComplete="tel"
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label htmlFor={socialId} className="block text-xs font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">
              IG / Sosmed
            </label>
            <input
              id={socialId}
              type="text"
              value={social}
              onChange={e => setSocial(e.target.value)}
              placeholder="@username"
              autoComplete="off"
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label htmlFor={perfumeNameId} className="block text-xs font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">
              Nama Parfum <span className="text-danger">*</span>
            </label>
            <input
              id={perfumeNameId}
              type="text"
              value={perfumeName}
              onChange={e => setPerfumeName(e.target.value)}
              placeholder="Beri nama parfummu"
              autoComplete="off"
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label htmlFor={themeId} className="block text-xs font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">
              Tema Parfum
            </label>
            <input
              id={themeId}
              type="text"
              value={theme}
              onChange={e => setTheme(e.target.value)}
              placeholder="Contoh: Fresh & Sporty"
              autoComplete="off"
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label htmlFor={notesId} className="block text-xs font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">
              Catatan
            </label>
            <textarea
              id={notesId}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ada preferensi atau request khusus? (opsional)"
              rows={3}
              className={INPUT_CLS + ' resize-none'}
            />
          </div>
        </div>

        {/* CTA */}
        <div className="pt-6">
          <button
            onClick={() => setStep('formulation')}
            disabled={!canProceed}
            className="w-full py-4 rounded-2xl bg-pine text-white text-base font-semibold disabled:opacity-40 hover:bg-pine-700 active:scale-[0.98] transition-all"
          >
            Lanjut — Racik Parfum
          </button>
          {!canProceed && (
            <p className="text-xs text-ink-400 text-center mt-2">Isi Nama Lengkap dan Nama Parfum dulu ya</p>
          )}
        </div>
      </div>
    )
  }

  // ── Render: Step 2 ─────────────────────────────────────────────────────────

  return (
    <>
      {/* Sticky gram bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-line px-4 py-3">
        {/* Back + progress */}
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setStep('info')}
            aria-label="Kembali ke info peserta"
            className="p-1 -ml-1 rounded-md text-ink-400 hover:text-ink-700"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-sand-200 text-ink-400 text-xs font-semibold flex items-center justify-center">1</span>
            <div className="w-8 h-px bg-line" />
            <span className="w-6 h-6 rounded-full bg-pine text-white text-xs font-semibold flex items-center justify-center">2</span>
            <span className="text-sm font-semibold text-ink-900">Racik Parfum</span>
          </div>
        </div>

        {/* Gram counter */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-ink-500">Total</span>
          <span className={`text-sm font-semibold tabular-nums ${textColorClass}`}>
            {formatGram(totalGrams)} / 25g
          </span>
        </div>
        <div className="w-full h-2 bg-sand-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColorClass}`}
            style={{ width: `${barPct}%` }}
          />
        </div>
        {isOver && (
          <p className="text-xs text-danger mt-1 font-medium">
            Melebihi batas 25g — kurangi takaran dulu
          </p>
        )}
        {!isOver && (
          <p className="text-xs text-ink-400 mt-1">
            Sisa: <span className={`font-medium tabular-nums ${isNear ? 'text-amber-600' : 'text-ink-700'}`}>{formatGram(remainingGrams)}</span>
          </p>
        )}
      </div>

      {/* Item list */}
      <div className="flex-1 px-4 pt-4 pb-36 space-y-3 max-w-md mx-auto w-full">
        {materialsError && (
          <div className="rounded-xl border border-danger-bd bg-danger-bg px-4 py-3 text-sm text-danger">
            {materialsError}
          </div>
        )}

        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center">
            <p className="text-sm text-ink-500">Belum ada bahan dipilih</p>
            <p className="text-xs text-ink-400 mt-1">Tekan tombol di bawah untuk mulai meracik</p>
          </div>
        )}

        {items.map(item => {
          const material = materialMap.get(item.material_id)
          const gramsEmpty = item.grams === ''
          return (
            <div
              key={item._key}
              className="bg-white border border-line rounded-2xl p-4 space-y-3"
            >
              {/* Material header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-900 truncate">
                    {material?.name ?? item.material_id}
                  </p>
                  <div className="mt-1">
                    <CategoryPill category={material?.category ?? null} />
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveItem(item._key)}
                  aria-label="Hapus bahan"
                  className="w-7 h-7 rounded-lg border border-line text-ink-400 hover:border-danger-bd hover:text-danger hover:bg-danger-bg transition-colors flex items-center justify-center flex-shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Input row */}
              <div className="grid grid-cols-3 gap-2">
                {/* Drops */}
                <div>
                  <label className="block text-[10px] font-semibold text-ink-400 mb-1 uppercase tracking-wide">
                    Drops
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={item.drops === '' ? '' : item.drops}
                    onChange={e => handleUpdateItem(item._key, 'drops', parseNumInput(e.target.value))}
                    placeholder="—"
                    className="w-full rounded-xl px-3 py-2.5 text-sm border border-line outline-none focus:ring-2 focus:ring-pine-200 focus:border-pine text-ink-900 tabular-nums text-center"
                  />
                </div>

                {/* Grams (required) */}
                <div>
                  <label className="block text-[10px] font-semibold text-ink-400 mb-1 uppercase tracking-wide">
                    Grams <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.grams === '' ? '' : item.grams}
                    onChange={e => handleUpdateItem(item._key, 'grams', parseNumInput(e.target.value))}
                    placeholder="0.00"
                    className={[
                      'w-full rounded-xl px-3 py-2.5 text-sm border outline-none focus:ring-2 focus:ring-pine-200 focus:border-pine text-ink-900 tabular-nums text-center',
                      gramsEmpty ? 'border-danger bg-danger-bg' : 'border-line',
                    ].join(' ')}
                  />
                </div>

                {/* Adj */}
                <div>
                  <label className="block text-[10px] font-semibold text-ink-400 mb-1 uppercase tracking-wide">
                    Adj
                  </label>
                  <input
                    type="number"
                    step={0.01}
                    value={item.adj === '' ? '' : item.adj}
                    onChange={e => handleUpdateItem(item._key, 'adj', parseNumInput(e.target.value))}
                    placeholder="—"
                    className="w-full rounded-xl px-3 py-2.5 text-sm border border-line outline-none focus:ring-2 focus:ring-pine-200 focus:border-pine text-ink-900 tabular-nums text-center"
                  />
                </div>
              </div>
            </div>
          )
        })}

        {/* Add material button */}
        <button
          onClick={() => setShowPicker(true)}
          disabled={materialsLoading}
          className="w-full py-4 rounded-2xl border border-line bg-white text-sm font-semibold text-ink-700 hover:bg-sand-50 active:bg-sand-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {materialsLoading ? 'Memuat bahan...' : '+ Tambah Bahan'}
        </button>
      </div>

      {/* Sticky bottom submit */}
      <div className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-line px-4 py-4 pb-safe-bottom">
        <div className="max-w-md mx-auto space-y-2">
          {submitError && (
            <p className="text-xs text-danger bg-danger-bg border border-danger-bd rounded-xl px-3 py-2">
              {submitError}
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full py-4 rounded-2xl bg-pine text-white text-base font-semibold disabled:opacity-40 hover:bg-pine-700 active:scale-[0.98] transition-all"
          >
            {submitting ? 'Menyimpan...' : 'Simpan Formulasi'}
          </button>
          {items.length === 0 && (
            <p className="text-xs text-ink-400 text-center">Tambahkan minimal 1 bahan dulu</p>
          )}
          {hasEmptyGrams && items.length > 0 && (
            <p className="text-xs text-danger text-center">Isi kolom Grams yang kosong (warna merah)</p>
          )}
        </div>
      </div>

      {/* Material picker overlay */}
      {showPicker && (
        <MaterialPicker
          materials={materials}
          selectedIds={selectedMaterialIds}
          onSelect={handleAddMaterial}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}
