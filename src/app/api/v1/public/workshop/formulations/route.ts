import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const DEFAULT_TARGET_GRAMS = 30

interface FormulationItem {
  material_id: string
  drops?: number
}

interface FormulationBody {
  customer_name?: string
  customer_phone?: string
  customer_email?: string
  contact_socmed?: string
  customer_social?: string  // alias dari form client
  perfume_name?: string
  theme?: string
  notes?: string
  slot_id?: string
  branch_id?: string
  target_grams?: number
  items?: FormulationItem[]
}

// POST /api/v1/public/workshop/formulations
// Body: { customer_name, customer_phone?, contact_socmed?,
//         perfume_name?, theme?, notes?, slot_id?, target_grams?,
//         items: [{ material_id, drops }] }
// Response 201: { data: { formulation_id, access_token, result_url } }
export async function POST(request: Request) {
  let body: FormulationBody
  try {
    body = await request.json() as FormulationBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!body.customer_name?.trim())
    return NextResponse.json({ error: 'customer_name is required.' }, { status: 400 })

  if (!Array.isArray(body.items) || body.items.length < 1)
    return NextResponse.json({ error: 'items must contain at least 1 ingredient.' }, { status: 400 })

  if (!body.items.every(i => i.material_id?.trim()))
    return NextResponse.json({ error: 'Each item must have a material_id.' }, { status: 400 })

  const targetGrams = typeof body.target_grams === 'number'
    && body.target_grams > 0
    && body.target_grams <= 500
    ? body.target_grams
    : DEFAULT_TARGET_GRAMS

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  const { data, error } = await db.rpc('submit_workshop_formulation', {
    p_customer_name:  body.customer_name.trim(),
    p_customer_phone: body.customer_phone ?? null,
    p_customer_email: body.customer_email ?? null,
    p_contact_socmed: body.contact_socmed ?? body.customer_social ?? null,
    p_perfume_name:   body.perfume_name   ?? null,
    p_theme:          body.theme          ?? null,
    p_notes:          body.notes          ?? null,
    p_slot_id:        body.slot_id        ?? null,
    p_branch_id:      body.branch_id      ?? null,
    p_target_grams:   targetGrams,
    p_items:          body.items,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = data as { formulation_id: string; access_token: string }

  return NextResponse.json(
    {
      data: {
        formulation_id: result.formulation_id,
        access_token:   result.access_token,
        result_url:     `/workshop/result/${result.access_token}`,
      },
    },
    { status: 201 },
  )
}
