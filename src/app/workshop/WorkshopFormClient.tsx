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

interface FormulationItem {
  _key:        string
  material_id: string
  drops:       number | ''
}

interface SlotOption {
  id:         string
  date:       string
  start_time: string
  end_time:   string
}

// ── Constants & Helpers ───────────────────────────────────────────────────────

const TARGET_GRAMS = 30

interface CountryCode { dial: string; flag: string; name: string }
const COUNTRY_CODES: CountryCode[] = [
  { dial: '+62',  flag: '🇮🇩', name: 'Indonesia' },
  { dial: '+65',  flag: '🇸🇬', name: 'Singapore' },
  { dial: '+60',  flag: '🇲🇾', name: 'Malaysia' },
  { dial: '+61',  flag: '🇦🇺', name: 'Australia' },
  { dial: '+64',  flag: '🇳🇿', name: 'New Zealand' },
  { dial: '+1',   flag: '🇺🇸', name: 'United States' },
  { dial: '+44',  flag: '🇬🇧', name: 'United Kingdom' },
  { dial: '+49',  flag: '🇩🇪', name: 'Germany' },
  { dial: '+33',  flag: '🇫🇷', name: 'France' },
  { dial: '+31',  flag: '🇳🇱', name: 'Netherlands' },
  { dial: '+81',  flag: '🇯🇵', name: 'Japan' },
  { dial: '+82',  flag: '🇰🇷', name: 'South Korea' },
  { dial: '+86',  flag: '🇨🇳', name: 'China' },
  { dial: '+91',  flag: '🇮🇳', name: 'India' },
  { dial: '+63',  flag: '🇵🇭', name: 'Philippines' },
  { dial: '+66',  flag: '🇹🇭', name: 'Thailand' },
  { dial: '+84',  flag: '🇻🇳', name: 'Vietnam' },
  { dial: '+673', flag: '🇧🇳', name: 'Brunei' },
  { dial: '+971', flag: '🇦🇪', name: 'UAE' },
  { dial: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { dial: '+965', flag: '🇰🇼', name: 'Kuwait' },
  { dial: '+974', flag: '🇶🇦', name: 'Qatar' },
]
const DEFAULT_DIAL = '+62'

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return `${DAYS[dt.getDay()]}, ${dt.getDate()} ${MONTHS[dt.getMonth()]}`
}
function fmtTime(t: string) { return t.slice(0, 5) }
function fmtSlotLabel(slot: SlotOption) {
  return `${fmtDate(slot.date)}  ·  ${fmtTime(slot.start_time)} – ${fmtTime(slot.end_time)}`
}
const fmtGram = (n: number) => n % 1 === 0 ? `${n}g` : `${n.toFixed(2)}g`

// Rumus normalisasi: gram_per_drop = TARGET_GRAMS / total_drops (guard /0)
function computeGrams(drops: number | '', totalDrops: number): number {
  if (totalDrops === 0 || drops === '' || drops === 0) return 0
  return (TARGET_GRAMS / totalDrops) * (drops as number)
}

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
  materials:   WorkshopMaterial[]
  selectedIds: Set<string>
  onSelect:    (material: WorkshopMaterial) => void
  onClose:     () => void
}

function MaterialPicker({ materials, selectedIds, onSelect, onClose }: MaterialPickerProps) {
  const [search,         setSearch]         = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search, 300)
  const searchRef       = useRef<HTMLInputElement>(null)

  useEffect(() => { searchRef.current?.focus() }, [])

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
      const matchName   = !q || m.name.toLowerCase().includes(q)
      const matchCat    = !q || (m.category?.name.toLowerCase().includes(q) ?? false)
      const matchFilter = !categoryFilter || m.category?.id === categoryFilter
      return (matchName || matchCat) && matchFilter
    }).slice(0, 50)
  }, [materials, debouncedSearch, categoryFilter])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
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
            placeholder="Search ingredients..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-line bg-sand-50 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-pine-200 focus:border-pine"
          />
        </div>
        <button
          onClick={onClose}
          className="px-3 py-2 rounded-xl border border-line text-sm text-ink-600 hover:bg-sand-100 transition-colors"
        >
          Cancel
        </button>
      </div>

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
          All
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

      <div className="flex-1 overflow-y-auto divide-y divide-line">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-ink-400 text-sm">
            No ingredients found
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
            Showing first 50 results — type more to narrow down
          </p>
        )}
      </div>
    </div>
  )
}

// ── Draft persistence ─────────────────────────────────────────────────────────

const DRAFT_KEY = 'workshop_formulation_draft'

interface DraftData {
  savedAt:        number
  step:           'info' | 'formulation'
  name:           string
  phoneDialCode:  string
  phoneNumber:    string
  social:         string
  perfumeName:    string
  theme:          string
  notes:          string
  selectedSlotId: string
  items:          FormulationItem[]
}

function loadDraft(): DraftData | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as DraftData
    if (Date.now() - d.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(DRAFT_KEY)
      return null
    }
    return d
  } catch {
    return null
  }
}

function saveDraft(d: DraftData) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch { /* quota exceeded */ }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
}

function timeAgo(ts: number) {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins} min ago`
  return `${Math.floor(mins / 60)} hr ago`
}

// ── WorkshopFormClient ────────────────────────────────────────────────────────

interface Props { initialSlotId: string | null }

type Step = 'info' | 'formulation'

const INPUT_CLS =
  'w-full rounded-xl px-4 py-3.5 text-sm border outline-none focus:ring-2 focus:ring-pine-200 focus:border-pine border-line text-ink-900 bg-white placeholder:text-ink-300'

const SELECT_CLS =
  'w-full rounded-xl px-4 py-3.5 text-sm border outline-none focus:ring-2 focus:ring-pine-200 focus:border-pine border-line text-ink-900 bg-white'

export function WorkshopFormClient({ initialSlotId }: Props) {
  const router = useRouter()

  const [step, setStep] = useState<Step>('info')

  const [name,          setName]          = useState('')
  const [phoneDialCode, setPhoneDialCode] = useState(DEFAULT_DIAL)
  const [phoneNumber,   setPhoneNumber]   = useState('')
  const [social,        setSocial]        = useState('')
  const [perfumeName, setPerfumeName] = useState('')
  const [theme,       setTheme]       = useState('')
  const [notes,       setNotes]       = useState('')

  const [slots,          setSlots]          = useState<SlotOption[]>([])
  const [slotsLoading,   setSlotsLoading]   = useState(true)
  const [selectedSlotId, setSelectedSlotId] = useState<string>(initialSlotId ?? '')

  const [materials,        setMaterials]        = useState<WorkshopMaterial[]>([])
  const [materialsLoading, setMaterialsLoading] = useState(false)
  const [materialsError,   setMaterialsError]   = useState('')

  const [items,      setItems]      = useState<FormulationItem[]>([])
  const [showPicker, setShowPicker] = useState(false)

  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState('')

  const [hasDraft,     setHasDraft]     = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null)

  const nameId        = useId()
  const phoneId       = useId()
  const socialId      = useId()
  const perfumeNameId = useId()
  const themeId       = useId()
  const notesId       = useId()
  const slotId_       = useId()

  useEffect(() => {
    const draft = loadDraft()
    if (draft && (draft.name || draft.items.length > 0)) {
      setHasDraft(true)
      setDraftSavedAt(draft.savedAt)
    }
  }, [])

  function resumeDraft() {
    const draft = loadDraft()
    if (!draft) return
    setStep(draft.step)
    setName(draft.name)
    setPhoneDialCode(draft.phoneDialCode ?? DEFAULT_DIAL)
    setPhoneNumber(draft.phoneNumber ?? '')
    setSocial(draft.social)
    setPerfumeName(draft.perfumeName)
    setTheme(draft.theme)
    setNotes(draft.notes)
    setSelectedSlotId(draft.selectedSlotId || initialSlotId || '')
    setItems(draft.items)
    setHasDraft(false)
  }

  function discardDraft() {
    clearDraft()
    setHasDraft(false)
  }

  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (hasDraft) return
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(() => {
      const isEmpty = !name && !phoneNumber && !social && !perfumeName && !theme && !notes && items.length === 0
      if (isEmpty) return
      const now = Date.now()
      saveDraft({ savedAt: now, step, name, phoneDialCode, phoneNumber, social, perfumeName, theme, notes, selectedSlotId, items })
      setDraftSavedAt(now)
    }, 800)
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current) }
  }, [step, name, phoneDialCode, phoneNumber, social, perfumeName, theme, notes, selectedSlotId, items, hasDraft])

  const fetchSlots = useCallback(async () => {
    setSlotsLoading(true)
    try {
      const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const res   = await fetch(`/api/v1/public/workshop/slots?date=${today}`)
      const json  = await res.json()
      const list: SlotOption[] = json.data ?? []
      setSlots(list)
      if (!initialSlotId && list.length === 1) setSelectedSlotId(list[0].id)
    } catch {
      // silent — slot is optional
    } finally {
      setSlotsLoading(false)
    }
  }, [initialSlotId])

  useEffect(() => { fetchSlots() }, [fetchSlots])

  useEffect(() => {
    if (materials.length > 0) return
    setMaterialsLoading(true)
    setMaterialsError('')
    fetch('/api/v1/public/workshop/materials')
      .then(r => r.json())
      .then(j => setMaterials(j.data ?? []))
      .catch(() => setMaterialsError('Failed to load ingredients. Please reload the page.'))
      .finally(() => setMaterialsLoading(false))
  }, [materials.length])

  const materialMap = useMemo(() => {
    const m = new Map<string, WorkshopMaterial>()
    materials.forEach(mat => m.set(mat.id, mat))
    return m
  }, [materials])

  const selectedMaterialIds = useMemo(
    () => new Set(items.map(i => i.material_id)),
    [items],
  )

  // Computed grams (real-time, normalisasi proporsional)
  const totalDrops = useMemo(
    () => items.reduce((s, i) => s + (typeof i.drops === 'number' ? i.drops : 0), 0),
    [items],
  )
  const canSubmit  = items.length > 0 && totalDrops > 0
  const canProceed = name.trim() !== '' && perfumeName.trim() !== '' && phoneNumber.trim() !== '' && theme.trim() !== ''

  function handleAddMaterial(material: WorkshopMaterial) {
    setItems(prev => [...prev, { _key: nextKey(), material_id: material.id, drops: 0 }])
  }

  function handleRemoveItem(key: string) {
    setItems(prev => prev.filter(i => i._key !== key))
  }

  function handleDropsChange(key: string, value: number | '') {
    setItems(prev => prev.map(i => i._key === key ? { ...i, drops: value } : i))
  }

  async function handleSubmit() {
    setSubmitError('')
    setSubmitting(true)
    try {
      const res  = await fetch('/api/v1/public/workshop/formulations', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          customer_name:   name.trim(),
          customer_phone:  phoneNumber.trim()
            ? phoneDialCode + phoneNumber.trim().replace(/^0+/, '')
            : undefined,
          customer_social: social.trim() || undefined,
          perfume_name:    perfumeName.trim(),
          theme:           theme.trim()  || undefined,
          notes:           notes.trim()  || undefined,
          slot_id:         selectedSlotId || undefined,
          target_grams:    TARGET_GRAMS,
          items: items.map(({ material_id, drops }) => ({
            material_id,
            drops: typeof drops === 'number' ? drops : 0,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error?.message ?? json.error ?? 'Failed to save formulation. Please try again.')
        return
      }
      clearDraft()
      router.push(`/workshop/result/${json.data.access_token}`)
    } catch {
      setSubmitError('Connection failed. Check your internet and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Step 1: Info ───────────────────────────────────────────────────────────

  if (step === 'info') {
    return (
      <div className="flex-1 flex flex-col px-4 py-6 max-w-md mx-auto w-full">

        {hasDraft && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">You have an unfinished formulation</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Saved {draftSavedAt ? timeAgo(draftSavedAt) : ''}. Continue where you left off?
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={resumeDraft} className="flex-1 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors">
                Continue
              </button>
              <button onClick={discardDraft} className="flex-1 py-2 rounded-xl border border-amber-300 text-amber-700 text-sm font-medium hover:bg-amber-100 transition-colors">
                Start Fresh
              </button>
            </div>
          </div>
        )}

        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-pine text-white text-xs font-semibold flex items-center justify-center">1</span>
            <span className="text-sm font-semibold text-ink-900 uppercase tracking-wide">YOUR INFO</span>
          </div>
          <div className="flex-1 h-px bg-line" />
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-sand-200 text-ink-400 text-xs font-semibold flex items-center justify-center">2</span>
            <span className="text-sm text-ink-400 uppercase tracking-wide">PERFUME FORMULATION</span>
          </div>
        </div>

        <div className="space-y-4 flex-1">

          <div>
            <label htmlFor={slotId_} className="block text-xs font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">
              Workshop Session
            </label>
            {slotsLoading ? (
              <div className="w-full rounded-xl border border-line bg-sand-100 py-3.5 px-4 text-sm text-ink-400 animate-pulse">
                Loading sessions...
              </div>
            ) : slots.length === 0 ? (
              <div className="w-full rounded-xl border border-line bg-sand-50 py-3.5 px-4 text-sm text-ink-400">
                No sessions today
              </div>
            ) : (
              <select id={slotId_} value={selectedSlotId} onChange={e => setSelectedSlotId(e.target.value)} className={SELECT_CLS}>
                <option value="">— Select a session —</option>
                {slots.map(slot => (
                  <option key={slot.id} value={slot.id}>{fmtSlotLabel(slot)}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label htmlFor={nameId} className="block text-xs font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">
              Full Name <span className="text-danger">*</span>
            </label>
            <input id={nameId} type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Your name" autoComplete="name" maxLength={100} className={INPUT_CLS} />
          </div>

          <div>
            <label htmlFor={phoneId} className="block text-xs font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">
              WhatsApp <span className="text-danger">*</span>
            </label>
            <div className="flex gap-2">
              <select
                value={phoneDialCode}
                onChange={e => setPhoneDialCode(e.target.value)}
                className="flex-shrink-0 rounded-xl px-3 py-3.5 text-sm border border-line outline-none focus:ring-2 focus:ring-pine-200 focus:border-pine bg-white text-ink-900"
                style={{ width: '7rem' }}
              >
                {COUNTRY_CODES.map(c => (
                  <option key={c.dial + c.name} value={c.dial}>
                    {c.flag} {c.dial}
                  </option>
                ))}
              </select>
              <input
                id={phoneId}
                type="tel"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="812-3456-7890"
                autoComplete="tel-national"
                maxLength={15}
                className={INPUT_CLS}
              />
            </div>
            <p className="text-[11px] text-ink-400 mt-1">Enter number without leading zero — e.g. 812-3456-7890</p>
          </div>

          <div>
            <label htmlFor={socialId} className="block text-xs font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">
              Instagram
            </label>
            <input id={socialId} type="text" value={social} onChange={e => setSocial(e.target.value)}
              placeholder="@username" autoComplete="off" maxLength={30} className={INPUT_CLS} />
          </div>

          <div>
            <label htmlFor={perfumeNameId} className="block text-xs font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">
              Perfume Name <span className="text-danger">*</span>
            </label>
            <input id={perfumeNameId} type="text" value={perfumeName} onChange={e => setPerfumeName(e.target.value)}
              placeholder="Name your perfume" autoComplete="off" maxLength={80} className={INPUT_CLS} />
          </div>

          <div>
            <label htmlFor={themeId} className="block text-xs font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">
              Perfume Theme <span className="text-danger">*</span>
            </label>
            <input id={themeId} type="text" value={theme} onChange={e => setTheme(e.target.value)}
              placeholder="e.g. Fresh & Sporty" autoComplete="off" maxLength={80} className={INPUT_CLS} />
          </div>

          <div>
            <label htmlFor={notesId} className="block text-xs font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">
              Notes
            </label>
            <textarea id={notesId} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any preferences or special requests? (optional)"
              rows={3} maxLength={400} className={INPUT_CLS + ' resize-none'} />
            <p className="text-[11px] text-ink-400 mt-1 text-right">{notes.length}/400</p>
          </div>
        </div>

        <div className="pt-6">
          <button
            onClick={() => setStep('formulation')}
            disabled={!canProceed}
            className="w-full py-4 rounded-2xl bg-pine text-white text-base font-semibold disabled:opacity-40 hover:bg-pine-700 active:scale-[0.98] transition-all"
          >
            Next — Perfume Formulation
          </button>
          {!canProceed && (
            <p className="text-xs text-ink-400 text-center mt-2">Please fill in Full Name, WhatsApp Number, Perfume Name, and Perfume Theme first</p>
          )}
        </div>
      </div>
    )
  }

  // ── Step 2: Formulation ────────────────────────────────────────────────────

  return (
    <>
      {/* Sticky step header (no progress bar) */}
      <div className="sticky top-0 z-20 bg-white border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStep('info')}
            aria-label="Back to your info"
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
            <span className="text-sm font-semibold text-ink-900 uppercase tracking-wide">PERFUME FORMULATION</span>
          </div>
          {draftSavedAt && (
            <p className="ml-auto text-[10px] text-ink-300 flex items-center gap-1 flex-shrink-0">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Saved {timeAgo(draftSavedAt)}
            </p>
          )}
        </div>
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
            <p className="text-sm text-ink-500">No ingredients added yet</p>
            <p className="text-xs text-ink-400 mt-1">Tap the button below to start building your formula</p>
          </div>
        )}

        {items.map(item => {
          const material  = materialMap.get(item.material_id)
          const itemGrams = computeGrams(item.drops, totalDrops)
          return (
            <div key={item._key} className="bg-white border border-line rounded-2xl p-4 space-y-3">
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
                  aria-label="Remove ingredient"
                  className="w-7 h-7 rounded-lg border border-line text-ink-400 hover:border-danger-bd hover:text-danger hover:bg-danger-bg transition-colors flex items-center justify-center flex-shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Drops stepper + Grams read-only */}
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-ink-400 mb-1 uppercase tracking-wide">
                    Drops <span className="text-danger">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = typeof item.drops === 'number' ? item.drops : 0
                        handleDropsChange(item._key, Math.max(0, cur - 1))
                      }}
                      className="w-10 h-10 flex-shrink-0 rounded-xl border border-line bg-sand-50 text-ink-700 text-lg font-semibold flex items-center justify-center hover:bg-sand-100 active:scale-95 transition-all"
                      aria-label="Decrease drops"
                    >
                      −
                    </button>
                    <input
                      type="number" min={0} step={1}
                      value={item.drops === '' ? '' : item.drops}
                      onChange={e => {
                        const v = e.target.value
                        if (v === '') { handleDropsChange(item._key, ''); return }
                        const n = parseInt(v, 10)
                        if (!isNaN(n) && n >= 0) handleDropsChange(item._key, n)
                      }}
                      placeholder="0"
                      className="flex-1 rounded-xl px-3 py-2.5 text-sm border border-line outline-none focus:ring-2 focus:ring-pine-200 focus:border-pine text-ink-900 tabular-nums text-center"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const cur = typeof item.drops === 'number' ? item.drops : 0
                        handleDropsChange(item._key, cur + 1)
                      }}
                      className="w-10 h-10 flex-shrink-0 rounded-xl border border-line bg-sand-50 text-ink-700 text-lg font-semibold flex items-center justify-center hover:bg-sand-100 active:scale-95 transition-all"
                      aria-label="Increase drops"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Grams — read-only computed */}
                <div className="flex-shrink-0 text-right pb-0.5">
                  <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide mb-1">Grams</p>
                  <p className="text-sm font-semibold tabular-nums text-pine">
                    {itemGrams > 0 ? fmtGram(itemGrams) : '—'}
                  </p>
                </div>
              </div>
            </div>
          )
        })}

        <button
          onClick={() => setShowPicker(true)}
          disabled={materialsLoading}
          className="w-full py-4 rounded-2xl border border-line bg-white text-sm font-semibold text-ink-700 hover:bg-sand-50 active:bg-sand-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {materialsLoading ? 'Loading ingredients...' : 'Add Ingredient'}
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
            {submitting ? 'Saving...' : 'Save Formulation'}
          </button>
          {items.length === 0 && (
            <p className="text-xs text-ink-400 text-center">Add at least 1 ingredient first</p>
          )}
        </div>
      </div>

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
