'use client'

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScentCategory { id: string; name: string; color_hex: string }
interface WorkshopMaterial {
  id: string
  name: string
  display_name: string | null
  dilution_percentage: number | null
  segment: 'regular' | 'kids'
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

const SIZE_OPTIONS = [
  { ml: 35,  grams: 21 },
  { ml: 50,  grams: 30 },
  { ml: 100, grams: 60 },
] as const

type Segment = 'adult' | 'kids'

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

function computeGrams(drops: number | '', totalDrops: number, targetGrams: number): number {
  if (totalDrops === 0 || drops === '' || drops === 0) return 0
  return (targetGrams / totalDrops) * (drops as number)
}

let _keyCounter = 0
function nextKey() { return String(++_keyCounter) }

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
      const matchName   = !q || (m.display_name ?? m.name).toLowerCase().includes(q)
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
            onClick={() => setCategoryFilter(f => f === cat.id ? null : cat.id)}
            className={[
              'flex-shrink-0 text-xs px-3 py-1 rounded-full font-medium border transition-colors',
              categoryFilter === cat.id
                ? 'text-white border-transparent'
                : 'bg-white text-ink-600 border-line hover:bg-sand-50',
            ].join(' ')}
            style={categoryFilter === cat.id ? { backgroundColor: cat.color_hex, borderColor: cat.color_hex } : {}}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-line">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-sm text-ink-400 text-center">No ingredients found</p>
        ) : (
          filtered.map(m => {
            const alreadyAdded = selectedIds.has(m.id)
            return (
              <button
                key={m.id}
                type="button"
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
                  <p className="text-sm font-medium text-ink-900 truncate">{m.display_name ?? m.name}</p>
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

// ── Participant model ─────────────────────────────────────────────────────────

interface Participant {
  _pid:          string
  step:          'info' | 'formulation'
  name:          string
  phoneDialCode: string
  phoneNumber:   string
  social:        string
  segment:       Segment
  selectedMl:    number
  perfumeName:   string
  theme:         string
  notes:         string
  items:         FormulationItem[]
  submitError:   string
}

function mkParticipant(): Participant {
  return {
    _pid:          nextKey(),
    step:          'info',
    name:          '',
    phoneDialCode: DEFAULT_DIAL,
    phoneNumber:   '',
    social:        '',
    segment:       'adult',
    selectedMl:    50,
    perfumeName:   '',
    theme:         '',
    notes:         '',
    items:         [],
    submitError:   '',
  }
}

// ── Draft persistence ─────────────────────────────────────────────────────────

const DRAFT_KEY = 'workshop_draft_v2'

interface DraftData {
  savedAt:        number
  selectedSlotId: string
  participants:   Omit<Participant, 'submitError'>[]
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
  } catch { return null }
}

function saveDraft(d: DraftData) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch { /* quota */ }
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

// ── Constants ─────────────────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full rounded-xl px-4 py-3.5 text-sm border outline-none focus:ring-2 focus:ring-pine-200 focus:border-pine border-line text-ink-900 bg-white placeholder:text-ink-300'

const SELECT_CLS =
  'w-full rounded-xl px-4 py-3.5 text-sm border outline-none focus:ring-2 focus:ring-pine-200 focus:border-pine border-line text-ink-900 bg-white'

const MAX_PARTICIPANTS = 6

// ── WorkshopFormClient ────────────────────────────────────────────────────────

interface Props { initialSlotId: string | null; editToken: string | null }

interface SubmitResult { name: string; token: string; url: string }

export function WorkshopFormClient({ initialSlotId, editToken }: Props) {
  const router = useRouter()
  const isEdit = !!editToken

  // ── Shared state ──
  const [selectedSlotId, setSelectedSlotId] = useState<string>(initialSlotId ?? '')
  const [slots,          setSlots]          = useState<SlotOption[]>([])
  const [slotsLoading,   setSlotsLoading]   = useState(true)
  const [materials,        setMaterials]        = useState<WorkshopMaterial[]>([])
  const [materialsLoading, setMaterialsLoading] = useState(false)
  const [materialsError,   setMaterialsError]   = useState('')

  // ── Participants ──
  const [participants, setParticipants] = useState<Participant[]>([mkParticipant()])
  const [activeTab,    setActiveTab]    = useState(0)

  // ── UI state ──
  const [showPicker,  setShowPicker]  = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [submitted,   setSubmitted]   = useState<SubmitResult[]>([])
  const [hasDraft,    setHasDraft]    = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null)
  const [editLoading, setEditLoading] = useState(isEdit)

  const p = participants[activeTab] ?? participants[0]

  function updateP(patch: Partial<Participant>) {
    setParticipants(prev => prev.map((pp, i) => i === activeTab ? { ...pp, ...patch } : pp))
  }

  // ── Draft ──
  useEffect(() => {
    if (isEdit) return
    const draft = loadDraft()
    if (draft && (draft.participants.some(pp => pp.name || pp.items.length > 0))) {
      setHasDraft(true)
      setDraftSavedAt(draft.savedAt)
    }
  }, [isEdit])

  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (isEdit || hasDraft || submitted.length > 0) return
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(() => {
      const isEmpty = participants.every(pp => !pp.name && pp.items.length === 0)
      if (isEmpty) return
      const now = Date.now()
      saveDraft({
        savedAt: now,
        selectedSlotId,
        participants: participants.map(({ submitError: _e, ...rest }) => rest),
      })
      setDraftSavedAt(now)
    }, 800)
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current) }
  }, [participants, selectedSlotId, hasDraft, isEdit, submitted.length])

  function resumeDraft() {
    const draft = loadDraft()
    if (!draft) return
    setSelectedSlotId(draft.selectedSlotId || initialSlotId || '')
    setParticipants(draft.participants.map(pp => ({ ...pp, submitError: '' })))
    setActiveTab(0)
    setHasDraft(false)
  }

  function discardDraft() {
    clearDraft()
    setHasDraft(false)
  }

  // ── Edit mode prefill ──
  useEffect(() => {
    if (!editToken) return
    setEditLoading(true)
    fetch(`/api/v1/public/workshop/formulations/${editToken}`)
      .then(r => r.json())
      .then(json => {
        const d = json.data
        if (!d) return
        const phone = d.customer?.phone ?? ''
        const matched = COUNTRY_CODES.find(c => phone.startsWith(c.dial))
        const dialCode  = matched ? matched.dial : DEFAULT_DIAL
        const numPart   = matched ? phone.slice(matched.dial.length) : phone
        setParticipants([{
          _pid:          nextKey(),
          step:          'formulation',
          name:          d.customer?.name ?? '',
          phoneDialCode: dialCode,
          phoneNumber:   numPart,
          social:        d.contact_socmed ?? '',
          segment:       'adult',
          selectedMl:    SIZE_OPTIONS.find(o => o.grams === d.target_grams)?.ml ?? 50,
          perfumeName:   d.perfume_name ?? '',
          theme:         d.theme ?? '',
          notes:         d.notes ?? '',
          items:         (d.items ?? []).map((item: { material_id: string; drops: number }) => ({
            _key:        nextKey(),
            material_id: item.material_id,
            drops:       item.drops ?? 1,
          })),
          submitError: '',
        }])
        if (d.slot_id) setSelectedSlotId(d.slot_id)
      })
      .catch(() => { /* silent */ })
      .finally(() => setEditLoading(false))
  }, [editToken]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch slots ──
  const fetchSlots = useCallback(async () => {
    setSlotsLoading(true)
    try {
      const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const res   = await fetch(`/api/v1/public/workshop/slots?date=${today}`)
      const json  = await res.json()
      const list: SlotOption[] = json.data ?? []
      setSlots(list)
      if (!initialSlotId && list.length === 1) setSelectedSlotId(list[0].id)
    } catch { /* silent */ }
    finally { setSlotsLoading(false) }
  }, [initialSlotId])

  useEffect(() => { fetchSlots() }, [fetchSlots])

  // ── Fetch materials ──
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

  // ── Derived values for active participant ──
  const materialMap = useMemo(() => {
    const m = new Map<string, WorkshopMaterial>()
    materials.forEach(mat => m.set(mat.id, mat))
    return m
  }, [materials])

  const filteredMaterials = useMemo(
    () => materials.filter(m => m.segment === (p.segment === 'kids' ? 'kids' : 'regular')),
    [materials, p.segment],
  )

  const selectedMaterialIds = useMemo(
    () => new Set(p.items.map(i => i.material_id)),
    [p.items],
  )

  const totalDrops   = useMemo(() => p.items.reduce((s, i) => s + (typeof i.drops === 'number' ? i.drops : 0), 0), [p.items])
  const targetGrams  = SIZE_OPTIONS.find(o => o.ml === p.selectedMl)?.grams ?? 30
  const canProceed   = p.name.trim() !== '' && p.phoneNumber.trim() !== '' && p.theme.trim() !== ''
  const canSubmitOne = p.items.length > 0 && totalDrops > 0
  const allReady     = participants.every(pp => pp.step === 'formulation' && pp.items.length > 0 && pp.items.reduce((s, i) => s + (typeof i.drops === 'number' ? i.drops : 0), 0) > 0)

  // ── Item handlers (active participant) ──
  function handleAddMaterial(material: WorkshopMaterial) {
    updateP({ items: [...p.items, { _key: nextKey(), material_id: material.id, drops: 1 }] })
  }

  function handleRemoveItem(key: string) {
    updateP({ items: p.items.filter(i => i._key !== key) })
  }

  function handleDropsChange(key: string, value: number | '') {
    updateP({ items: p.items.map(i => i._key === key ? { ...i, drops: value } : i) })
  }

  // ── Participant tabs ──
  function addParticipant() {
    if (participants.length >= MAX_PARTICIPANTS) return
    const newP = mkParticipant()
    setParticipants(prev => [...prev, newP])
    setActiveTab(participants.length)
  }

  function removeParticipant(idx: number) {
    if (participants.length <= 1) return
    setParticipants(prev => prev.filter((_, i) => i !== idx))
    setActiveTab(prev => Math.min(prev, participants.length - 2))
  }

  // ── Submit ──
  async function handleSubmitAll() {
    if (submitting) return
    setSubmitting(true)
    const results: SubmitResult[] = []
    const updatedParticipants = [...participants]

    for (let i = 0; i < participants.length; i++) {
      const pp = participants[i]
      updatedParticipants[i] = { ...pp, submitError: '' }

      const itemsPayload = pp.items.map(({ material_id, drops }) => ({
        material_id,
        drops: typeof drops === 'number' ? drops : 0,
      }))
      const tg = SIZE_OPTIONS.find(o => o.ml === pp.selectedMl)?.grams ?? 30

      try {
        let res: Response
        if (isEdit && editToken && i === 0) {
          res = await fetch(`/api/v1/public/workshop/formulations/${editToken}`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              contact_socmed: pp.social.trim() || null,
              perfume_name:   pp.perfumeName.trim() || null,
              theme:          pp.theme.trim()  || null,
              notes:          pp.notes.trim()  || null,
              target_grams:   tg,
              items:          itemsPayload,
            }),
          })
        } else {
          res = await fetch('/api/v1/public/workshop/formulations', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              customer_name:   pp.name.trim(),
              customer_phone:  pp.phoneNumber.trim()
                ? pp.phoneDialCode + pp.phoneNumber.trim().replace(/^0+/, '')
                : undefined,
              customer_social: pp.social.trim() || undefined,
              perfume_name:    pp.perfumeName.trim() || undefined,
              theme:           pp.theme.trim()  || undefined,
              notes:           pp.notes.trim()  || undefined,
              slot_id:         selectedSlotId   || undefined,
              target_grams:    tg,
              items:           itemsPayload,
            }),
          })
        }

        const json = await res.json()
        if (!res.ok) {
          updatedParticipants[i] = {
            ...updatedParticipants[i],
            submitError: json.error?.message ?? json.error ?? 'Failed to save. Please try again.',
          }
        } else {
          const token = isEdit && editToken && i === 0 ? editToken : json.data.access_token
          results.push({ name: pp.name, token, url: `/workshop/result/${token}` })
        }
      } catch {
        updatedParticipants[i] = {
          ...updatedParticipants[i],
          submitError: 'Connection failed. Check your internet and try again.',
        }
      }
    }

    setParticipants(updatedParticipants)
    setSubmitting(false)

    const hasErrors = updatedParticipants.some(pp => pp.submitError)
    if (hasErrors) return

    clearDraft()

    if (results.length === 1) {
      router.push(results[0].url)
    } else {
      setSubmitted(results)
    }
  }

  // ── Edit loading ──
  if (editLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-pine border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-ink-500">Loading formulation…</p>
        </div>
      </div>
    )
  }

  // ── Success screen (multi-participant) ──
  if (submitted.length > 0) {
    return (
      <div className="flex-1 flex flex-col px-4 py-8 max-w-md mx-auto w-full">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-pine-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-pine" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-ink-900">All formulations saved!</h2>
          <p className="text-sm text-ink-400 mt-1">Share each result link with the participant.</p>
        </div>

        <div className="space-y-3">
          {submitted.map((r, i) => (
            <a
              key={r.token}
              href={r.url}
              className="flex items-center gap-3 bg-white border border-line rounded-2xl px-4 py-3.5 hover:bg-sand-50 transition-colors"
            >
              <span className="w-8 h-8 rounded-full bg-pine-50 text-pine text-sm font-semibold flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-900 truncate">{r.name}</p>
                <p className="text-xs text-ink-400 truncate">{r.url}</p>
              </div>
              <svg className="w-4 h-4 text-ink-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </a>
          ))}
        </div>
      </div>
    )
  }

  // ── Draft banner ──
  const draftBanner = hasDraft && (
    <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
      <div className="flex items-start gap-2">
        <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800">You have an unfinished formulation</p>
          <p className="text-xs text-amber-700 mt-0.5">Saved {draftSavedAt ? timeAgo(draftSavedAt) : ''}. Continue where you left off?</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={resumeDraft} className="flex-1 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors">Continue</button>
        <button onClick={discardDraft} className="flex-1 py-2 rounded-xl border border-amber-300 text-amber-700 text-sm font-medium hover:bg-amber-100 transition-colors">Start Fresh</button>
      </div>
    </div>
  )

  // ── Shared tab row (used in both step 1 and step 2 sticky headers) ──
  function renderTabs() {
    if (isEdit) return null
    return (
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide px-4 pb-2 max-w-md mx-auto">
        {participants.map((pp, i) => {
          const done     = pp.step === 'formulation' && pp.items.length > 0
          const isActive = i === activeTab
          return (
            <div key={pp._pid} className="relative flex-shrink-0">
              <button
                onClick={() => setActiveTab(i)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border',
                  isActive ? 'bg-pine text-white border-pine' : 'bg-white text-ink-600 border-line hover:bg-sand-50',
                ].join(' ')}
              >
                {done && (
                  <svg className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-white' : 'text-pine'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {pp.name.trim() || `Participant ${i + 1}`}
              </button>
              {participants.length > 1 && (
                <button
                  onClick={() => removeParticipant(i)}
                  aria-label={`Remove Participant ${i + 1}`}
                  className={[
                    'absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold leading-none transition-colors',
                    isActive ? 'bg-pine-700 text-white' : 'bg-sand-300 text-ink-500 hover:bg-danger hover:text-white',
                  ].join(' ')}
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
        {participants.length < MAX_PARTICIPANTS && (
          <button
            onClick={addParticipant}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-ink-400 border border-dashed border-line hover:border-pine hover:text-pine transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
        )}
      </div>
    )
  }

  // ── Step 1 sticky header ──
  const step1Header = (
    <div className="sticky top-0 z-20 bg-white border-b border-line">
      <div className="flex items-center gap-2 px-4 py-3 max-w-md mx-auto">
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded-full bg-pine text-white text-xs font-semibold flex items-center justify-center">1</span>
          <span className="text-sm font-semibold text-ink-900 uppercase tracking-wide">YOUR INFO</span>
        </div>
        <div className="flex-1 h-px bg-line" />
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded-full bg-sand-200 text-ink-400 text-xs font-semibold flex items-center justify-center">2</span>
          <span className="text-sm text-ink-400 uppercase tracking-wide">FORMULATION</span>
        </div>
      </div>
      {renderTabs()}
    </div>
  )

  // ── Step 1: Info ──────────────────────────────────────────────────────────

  if (p.step === 'info') {
    return (
      <>
        {step1Header}
        {draftBanner}

        <div className="flex-1 flex flex-col px-4 py-4 max-w-md mx-auto w-full pb-32">
          <div className="space-y-4">

            {!isEdit && (
              <div>
                <label className="block text-xs font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">
                  Raw Mat Experience Session
                </label>
                {slotsLoading ? (
                  <div className="w-full rounded-xl border border-line bg-sand-100 py-3.5 px-4 text-sm text-ink-400 animate-pulse">Loading sessions...</div>
                ) : slots.length === 0 ? (
                  <div className="w-full rounded-xl border border-line bg-sand-50 py-3.5 px-4 text-sm text-ink-400">No sessions today</div>
                ) : (
                  <select value={selectedSlotId} onChange={e => setSelectedSlotId(e.target.value)} className={SELECT_CLS}>
                    <option value="">— Select a session —</option>
                    {slots.map(slot => (
                      <option key={slot.id} value={slot.id}>{fmtSlotLabel(slot)}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">
                Full Name <span className="text-danger">*</span>
              </label>
              <input type="text" value={p.name} onChange={e => updateP({ name: e.target.value })}
                placeholder="Your name" autoComplete="name" maxLength={100} className={INPUT_CLS} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">
                WhatsApp <span className="text-danger">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={p.phoneDialCode}
                  onChange={e => updateP({ phoneDialCode: e.target.value })}
                  className="flex-shrink-0 rounded-xl px-3 py-3.5 text-sm border border-line outline-none focus:ring-2 focus:ring-pine-200 focus:border-pine bg-white text-ink-900"
                  style={{ width: '7rem' }}
                >
                  {COUNTRY_CODES.map(c => (
                    <option key={c.dial + c.name} value={c.dial}>{c.flag} {c.dial}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={p.phoneNumber}
                  onChange={e => updateP({ phoneNumber: e.target.value })}
                  placeholder="812-3456-7890"
                  autoComplete="tel-national"
                  maxLength={15}
                  className={INPUT_CLS}
                />
              </div>
              <p className="text-[11px] text-ink-400 mt-1">Enter number without leading zero — e.g. 812-3456-7890</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">Instagram</label>
              <input type="text" value={p.social} onChange={e => updateP({ social: e.target.value })}
                placeholder="@username" autoComplete="off" maxLength={30} className={INPUT_CLS} />
            </div>

            {/* Segment selector — moved from step 2 */}
            <div>
              <label className="block text-xs font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">For</label>
              <div className="flex gap-2">
                {(['adult', 'kids'] as const).map(seg => (
                  <button
                    key={seg}
                    type="button"
                    onClick={() => {
                      if (seg === p.segment) return
                      updateP({ segment: seg, items: [], selectedMl: seg === 'kids' ? 35 : p.selectedMl })
                    }}
                    className={[
                      'flex-1 rounded-xl py-3 text-center border-2 transition-all',
                      p.segment === seg ? 'border-pine bg-pine-50' : 'border-line bg-sand-50 hover:border-pine-200',
                    ].join(' ')}
                  >
                    <p className={`text-sm font-bold ${p.segment === seg ? 'text-pine' : 'text-ink-700'}`}>
                      {seg === 'adult' ? 'Adult' : 'Kids'}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${p.segment === seg ? 'text-pine-600' : 'text-ink-400'}`}>
                      {seg === 'adult' ? '35 / 50 / 100 ml' : '35 ml only'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Bottle size — moved from step 2 */}
            <div>
              <label className="block text-xs font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">Bottle Size</label>
              <div className="flex gap-2">
                {SIZE_OPTIONS.filter(opt => p.segment === 'kids' ? opt.ml === 35 : true).map(opt => (
                  <button
                    key={opt.ml}
                    type="button"
                    onClick={() => updateP({ selectedMl: opt.ml })}
                    className={[
                      'flex-1 rounded-xl py-3 text-center border-2 transition-all',
                      p.selectedMl === opt.ml ? 'border-pine bg-pine-50' : 'border-line bg-sand-50 hover:border-pine-200',
                    ].join(' ')}
                  >
                    <p className={`text-sm font-bold ${p.selectedMl === opt.ml ? 'text-pine' : 'text-ink-700'}`}>{opt.ml} ml</p>
                    <p className={`text-[10px] mt-0.5 ${p.selectedMl === opt.ml ? 'text-pine-600' : 'text-ink-400'}`}>{opt.grams} gram</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">
                Perfume Theme <span className="text-danger">*</span>
              </label>
              <input type="text" value={p.theme} onChange={e => updateP({ theme: e.target.value })}
                placeholder="e.g. Fresh & Sporty" autoComplete="off" maxLength={80} className={INPUT_CLS} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">Notes</label>
              <textarea
                value={p.notes}
                onChange={e => updateP({ notes: e.target.value })}
                placeholder="Any preferences or special requests? (optional)"
                rows={3} maxLength={400}
                className={INPUT_CLS + ' resize-none'}
              />
              <p className="text-[11px] text-ink-400 mt-1 text-right">{p.notes.length}/400</p>
            </div>

          </div>

          <div className="pt-6">
            <button
              onClick={() => updateP({ step: 'formulation' })}
              disabled={!canProceed}
              className="w-full py-4 rounded-2xl bg-pine text-white text-base font-semibold disabled:opacity-40 hover:bg-pine-700 active:scale-[0.98] transition-all"
            >
              Next — Perfume Formulation
            </button>
            {!canProceed && (
              <p className="text-xs text-ink-400 text-center mt-2">Please fill in Full Name, WhatsApp Number, and Perfume Theme first</p>
            )}
          </div>
        </div>
      </>
    )
  }

  // ── Step 2: Formulation ───────────────────────────────────────────────────

  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b border-line">
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 max-w-md mx-auto">
          <button
            onClick={() => updateP({ step: 'info' })}
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
            <span className="text-sm font-semibold text-ink-900 uppercase tracking-wide">FORMULATION</span>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-ink-400">{p.name.trim() || `Participant ${activeTab + 1}`}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sand-100 text-ink-500">
              {p.selectedMl}ml · {p.segment === 'kids' ? 'Kids' : 'Adult'}
            </span>
            {draftSavedAt && (
              <p className="text-[10px] text-ink-300 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Saved {timeAgo(draftSavedAt)}
              </p>
            )}
          </div>
        </div>
        {renderTabs()}
      </div>

      {/* Item list */}
      <div className="flex-1 px-4 pt-4 pb-36 space-y-3 max-w-md mx-auto w-full">

        {materialsError && (
          <div className="rounded-xl border border-danger-bd bg-danger-bg px-4 py-3 text-sm text-danger">{materialsError}</div>
        )}

        {p.items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center">
            <p className="text-sm text-ink-500">No ingredients added yet</p>
            <p className="text-xs text-ink-400 mt-1">Tap the button below to start building your formula</p>
          </div>
        )}

        {p.items.map(item => {
          const material  = materialMap.get(item.material_id)
          const itemGrams = computeGrams(item.drops, totalDrops, targetGrams)
          return (
            <div key={item._key} className="bg-white border border-line rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-900 truncate">
                    {material ? (material.display_name ?? material.name) : item.material_id}
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

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">
                    Drops <span className="text-danger">*</span>
                  </label>
                  <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">
                    Grams: <span className="text-pine tabular-nums">{itemGrams > 0 ? fmtGram(itemGrams) : '—'}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const cur = typeof item.drops === 'number' ? item.drops : 0
                      handleDropsChange(item._key, Math.max(0, cur - 1))
                    }}
                    className="w-10 h-10 flex-shrink-0 rounded-xl border border-line bg-sand-50 text-ink-700 text-lg font-semibold flex items-center justify-center hover:bg-sand-100 active:scale-95 transition-all"
                    aria-label="Decrease drops"
                  >−</button>
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
                  >+</button>
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

        {/* Perfume name (optional) */}
        <div className="bg-white border border-line rounded-2xl p-4">
          <label className="block text-xs font-semibold text-ink-500 mb-2 uppercase tracking-wide">
            Perfume Name <span className="text-ink-300 font-normal normal-case">(optional, max 15 chars)</span>
          </label>
          <input
            type="text"
            value={p.perfumeName}
            onChange={e => updateP({ perfumeName: e.target.value.slice(0, 15) })}
            placeholder="e.g. Sunset at Dago"
            maxLength={15}
            className={INPUT_CLS}
          />
          <p className={`text-[11px] mt-1 text-right ${p.perfumeName.length >= 15 ? 'text-danger' : 'text-ink-300'}`}>
            {p.perfumeName.length}/15
          </p>
        </div>

        {/* Per-participant submit error */}
        {p.submitError && (
          <div className="rounded-xl border border-danger-bd bg-danger-bg px-4 py-3 text-sm text-danger">{p.submitError}</div>
        )}

        {/* Hint: other participants not ready */}
        {!allReady && participants.length > 1 && canSubmitOne && (
          <p className="text-xs text-ink-400 text-center">
            {participants.filter(pp => !(pp.step === 'formulation' && pp.items.length > 0)).length} participant(s) haven&apos;t completed their formulation yet
          </p>
        )}
      </div>

      {/* Sticky bottom */}
      <div className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-line px-4 py-4 pb-safe-bottom">
        <div className="max-w-md mx-auto space-y-2">
          <button
            onClick={handleSubmitAll}
            disabled={!allReady || submitting}
            className="w-full py-4 rounded-2xl bg-pine text-white text-base font-semibold disabled:opacity-40 hover:bg-pine-700 active:scale-[0.98] transition-all"
          >
            {submitting
              ? 'Saving…'
              : isEdit
                ? 'Update Formulation'
                : participants.length > 1
                  ? `Save All (${participants.length} Participants)`
                  : 'Save Formulation'}
          </button>
          {!allReady && (
            <p className="text-xs text-ink-400 text-center">
              {!canSubmitOne
                ? 'Add at least 1 ingredient first'
                : 'Complete all participants\' formulations to submit'}
            </p>
          )}
        </div>
      </div>

      {showPicker && (
        <MaterialPicker
          materials={filteredMaterials}
          selectedIds={selectedMaterialIds}
          onSelect={handleAddMaterial}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}
