import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type RawCategory = { name: string; color_hex: string } | null
type RawMaterial = {
  name: string
  display_name: string | null
  dilution_percentage: number
  scent_categories: RawCategory
} | null
type RawItem = {
  id: string
  line_no: number
  drops: number | null
  grams: number
  adj: number | null
  material_id: string
  workshop_materials: RawMaterial
}
type RawCustomer = { name: string; phone: string | null; email: string | null } | null
type RawSlot    = { id: string; date: string; start_time: string; end_time: string } | null

// GET /api/v1/public/workshop/formulations/[token]
// Kembalikan detail formulasi berdasarkan access_token. Tidak memerlukan auth.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  if (!UUID_RE.test(token))
    return NextResponse.json({ error: 'Token tidak valid.' }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  const { data, error } = await db
    .from('workshop_formulations')
    .select(`
      id, access_token, perfume_name, theme, contact_socmed, notes,
      target_grams, total_grams, status, created_at, slot_id,
      customers(name, phone, email),
      consultation_slots(id, date, start_time, end_time),
      workshop_formulation_items(
        id, line_no, drops, grams, material_id,
        workshop_materials(
          name, display_name, dilution_percentage,
          scent_categories(name, color_hex)
        )
      )
    `)
    .eq('access_token', token)
    .single()

  if (error || !data)
    return NextResponse.json({ error: 'Formulasi tidak ditemukan.' }, { status: 404 })

  const customer = data.customers         as RawCustomer
  const slot     = data.consultation_slots as RawSlot
  const items    = (data.workshop_formulation_items as RawItem[]) ?? []

  return NextResponse.json({
    data: {
      id:             data.id,
      access_token:   data.access_token,
      perfume_name:   data.perfume_name,
      theme:          data.theme,
      contact_socmed: data.contact_socmed,
      notes:          data.notes,
      target_grams:   data.target_grams,
      total_grams:    data.total_grams,
      status:         data.status,
      created_at:     data.created_at,
      slot_id:        data.slot_id ?? null,
      customer:       customer ?? null,
      slot:           slot
        ? { id: slot.id, date: slot.date, start_time: slot.start_time, end_time: slot.end_time }
        : null,
      items: items
        .sort((a, b) => a.line_no - b.line_no)
        .map(item => {
          const mat = item.workshop_materials
          const cat = mat?.scent_categories ?? null
          return {
            material_id: item.material_id,
            line_no:     item.line_no,
            drops:       item.drops,
            grams:       item.grams,
            material: mat
              ? {
                  name:                mat.name,
                  display_name:        mat.display_name ?? null,
                  dilution_percentage: mat.dilution_percentage,
                  category:            cat ? { name: cat.name, color_hex: cat.color_hex } : null,
                }
              : null,
          }
        }),
    },
  })
}

// PATCH /api/v1/public/workshop/formulations/[token]
// Update a draft formulation. Rejected if already finalized.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  if (!UUID_RE.test(token))
    return NextResponse.json({ error: 'Token tidak valid.' }, { status: 400 })

  const body = await request.json().catch(() => null)
  if (!body)
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  // Fetch existing formulation
  const { data: existing, error: fetchErr } = await db
    .from('workshop_formulations')
    .select('id, status, target_grams')
    .eq('access_token', token)
    .single()

  if (fetchErr || !existing)
    return NextResponse.json({ error: 'Formulasi tidak ditemukan.' }, { status: 404 })

  if (existing.status === 'finalized')
    return NextResponse.json({ error: 'Formulation already confirmed and cannot be edited.' }, { status: 409 })

  const items: { material_id: string; drops: number }[] = body.items ?? []
  if (!Array.isArray(items) || items.length === 0)
    return NextResponse.json({ error: 'At least 1 ingredient is required.' }, { status: 422 })

  const targetGrams: number = typeof body.target_grams === 'number' && body.target_grams > 0
    ? Math.min(body.target_grams, 500)
    : existing.target_grams

  // Recompute grams
  const totalDrops = items.reduce((s, i) => s + (i.drops ?? 0), 0)
  const gramPerDrop = totalDrops > 0 ? targetGrams / totalDrops : 0

  // Delete existing items
  await db.from('workshop_formulation_items').delete().eq('formulation_id', existing.id)

  // Insert updated items
  const itemRows = items.map((item, idx) => ({
    formulation_id: existing.id,
    material_id:    item.material_id,
    line_no:        idx + 1,
    drops:          item.drops ?? 0,
    grams:          totalDrops > 0 ? Math.round(gramPerDrop * (item.drops ?? 0) * 10000) / 10000 : 0,
  }))
  const { error: insertErr } = await db.from('workshop_formulation_items').insert(itemRows)
  if (insertErr)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })

  // Update formulation fields
  const { error: updateErr } = await db
    .from('workshop_formulations')
    .update({
      perfume_name:   body.perfume_name   ?? null,
      theme:          body.theme          ?? null,
      notes:          body.notes          ?? null,
      contact_socmed: body.contact_socmed ?? null,
      target_grams:   targetGrams,
      total_grams:    totalDrops > 0 ? targetGrams : 0,
    })
    .eq('id', existing.id)

  if (updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ data: { access_token: token } })
}
