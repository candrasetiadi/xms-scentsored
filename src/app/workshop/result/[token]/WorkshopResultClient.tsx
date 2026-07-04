'use client'

import { useState, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScentCategory { id: string; name: string; color_hex: string }
interface Material { id: string; name: string; dilution_percentage: number | null; scent_categories: ScentCategory | null }
interface Item { id: string; line_no: number; drops: number | null; grams: number; adj: number | null; workshop_materials: Material | null }
interface Slot { date: string; start_time: string; end_time: string }
interface Customer { name: string; phone: string | null; email: string | null }

export interface FormulationData {
  id: string
  access_token: string
  perfume_name: string | null
  theme: string | null
  contact_socmed: string | null
  notes: string | null
  total_grams: number
  status: 'draft' | 'finalized'
  created_at: string
  customers: Customer | null
  consultation_slots: Slot | null
  workshop_formulation_items: Item[]
}

interface Props { formulation: FormulationData }

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return `${DAYS[dt.getDay()]}, ${dt.getDate()} ${MONTHS[dt.getMonth()]}`
}
function fmtTime(t: string) { return t.slice(0, 5) }
const fmtGram = (n: number) => (n % 1 === 0 ? `${n}` : n.toFixed(2)) + 'g'

function CategoryPill({ cat }: { cat: ScentCategory | null }) {
  if (!cat) return null
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
      style={{ backgroundColor: cat.color_hex + '25', color: cat.color_hex }}
    >
      {cat.name}
    </span>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function WorkshopResultClient({ formulation: f }: Props) {
  const [finalizing, setFinalizing] = useState(false)
  const [status,     setStatus]     = useState(f.status)
  const [copied,     setCopied]     = useState(false)
  const [error,      setError]      = useState('')

  const items = [...(f.workshop_formulation_items ?? [])].sort((a, b) => a.line_no - b.line_no)
  const totalGrams = items.reduce((s, i) => s + Number(i.grams ?? 0), 0)

  const handleFinalize = useCallback(async () => {
    setFinalizing(true)
    setError('')
    try {
      const res  = await fetch(`/api/v1/public/workshop/formulations/${f.access_token}/finalize`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        if (res.status === 409) { setStatus('finalized'); return }
        setError(json.error ?? 'Failed to save. Please try again.')
        return
      }
      setStatus('finalized')
    } catch {
      setError('Connection failed. Please try again.')
    } finally {
      setFinalizing(false)
    }
  }, [f.access_token])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select text
    }
  }

  return (
    <div className="min-h-screen bg-sand-50">
      {/* Header brand */}
      <div className="bg-white border-b border-line px-4 py-3 text-center">
        <span className="text-sm font-bold tracking-widest text-ink-900 uppercase">Scentsored</span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Status banner */}
        {status === 'finalized' ? (
          <div className="bg-white border border-line rounded-2xl p-4 text-center space-y-1">
            <p className="text-2xl">✅</p>
            <p className="text-sm font-semibold text-ink-900">Formulation saved!</p>
            <p className="text-xs text-ink-500">Save this link to access your formulation anytime.</p>
          </div>
        ) : (
          <div className="bg-white border border-amber-200 rounded-2xl p-4 text-center space-y-1">
            <p className="text-sm font-medium text-amber-700">Formulation not yet confirmed</p>
            <p className="text-xs text-ink-500">Review your ingredients below and tap Confirm to save.</p>
          </div>
        )}

        {/* Participant info */}
        <div className="bg-white border border-line rounded-2xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-ink-500">Participant</p>
              <p className="text-base font-semibold text-ink-900">{f.customers?.name ?? '—'}</p>
            </div>
            {f.contact_socmed && (
              <div className="text-right">
                <p className="text-xs text-ink-500">Social</p>
                <p className="text-sm text-ink-900">{f.contact_socmed}</p>
              </div>
            )}
          </div>

          {f.consultation_slots && (
            <div className="pt-2 border-t border-line">
              <p className="text-xs text-ink-500 mb-0.5">Workshop Session</p>
              <p className="text-sm font-medium text-ink-900">
                {fmtDate(f.consultation_slots.date)} · {fmtTime(f.consultation_slots.start_time)} – {fmtTime(f.consultation_slots.end_time)}
              </p>
            </div>
          )}
        </div>

        {/* Perfume info */}
        <div className="bg-white border border-line rounded-2xl p-4 space-y-2">
          {f.perfume_name && (
            <div>
              <p className="text-xs text-ink-500">Perfume Name</p>
              <p className="text-xl font-bold text-ink-900">✨ {f.perfume_name}</p>
            </div>
          )}
          {f.theme && (
            <div>
              <p className="text-xs text-ink-500">Theme</p>
              <p className="text-sm text-ink-900">{f.theme}</p>
            </div>
          )}
          {f.notes && (
            <div className="pt-2 border-t border-line">
              <p className="text-xs text-ink-500 mb-0.5">Notes</p>
              <p className="text-sm text-ink-900 whitespace-pre-wrap">{f.notes}</p>
            </div>
          )}
        </div>

        {/* Ingredient table */}
        <div className="bg-white border border-line rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink-900">Ingredient Formulation</p>
            <span className="text-xs text-ink-500 tabular-nums">{fmtGram(totalGrams)} / 25g</span>
          </div>

          <div className="grid grid-cols-[2rem_1fr_auto_auto_auto] gap-x-3 px-4 py-2 bg-sand-50 text-xs text-ink-500 font-medium border-b border-line">
            <span>#</span>
            <span>Ingredient</span>
            <span className="text-right w-12">Drops</span>
            <span className="text-right w-12">Grams</span>
            <span className="text-right w-10">Adj</span>
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-400">No ingredients yet.</p>
          ) : (
            items.map(item => {
              const mat = item.workshop_materials
              const cat = mat?.scent_categories ?? null
              return (
                <div key={item.id} className="grid grid-cols-[2rem_1fr_auto_auto_auto] gap-x-3 px-4 py-3 border-b border-line last:border-0 items-start">
                  <span className="text-xs text-ink-400 tabular-nums pt-0.5">{item.line_no}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900 leading-tight">{mat?.name ?? '—'}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <CategoryPill cat={cat} />
                      {mat?.dilution_percentage != null && (
                        <span className="text-xs text-ink-400">{mat.dilution_percentage}%</span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm tabular-nums text-ink-700 text-right w-12 pt-0.5">{item.drops ?? '—'}</span>
                  <span className="text-sm tabular-nums text-ink-700 text-right w-12 pt-0.5">{item.grams ? fmtGram(item.grams) : '—'}</span>
                  <span className="text-sm tabular-nums text-ink-500 text-right w-10 pt-0.5">{item.adj != null ? item.adj : '—'}</span>
                </div>
              )
            })
          )}

          {/* Total grams footer */}
          <div className="grid grid-cols-[2rem_1fr_auto_auto_auto] gap-x-3 px-4 py-3 border-t border-line bg-sand-50">
            <span />
            <span className="text-xs font-semibold text-ink-700">Total</span>
            <span className="w-12" />
            <span className="text-sm font-semibold tabular-nums text-ink-900 text-right w-12">{fmtGram(totalGrams)}</span>
            <span className="w-10" />
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-danger text-center bg-danger/10 rounded-xl py-2 px-4">{error}</p>
        )}

        {/* Actions */}
        <div className="space-y-3 pb-8">
          {status === 'draft' && (
            <button
              onClick={handleFinalize}
              disabled={finalizing}
              className="w-full py-4 rounded-2xl bg-pine text-white text-base font-semibold hover:bg-pine-700 disabled:opacity-45 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {finalizing && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              ✅ Confirm &amp; Save Formulation
            </button>
          )}

          <button
            onClick={handleCopy}
            className="w-full py-3 rounded-2xl border border-line bg-white text-sm font-medium text-ink-700 hover:bg-sand-50 active:scale-[0.98] transition-all"
          >
            {copied ? '✓ Link copied!' : '🔗 Copy Result Link'}
          </button>
        </div>
      </div>
    </div>
  )
}
