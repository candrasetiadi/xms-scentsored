import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const MAX_TOTAL_GRAMS = 25

interface FormulationItem {
  material_id: string
  drops?: number
  grams: number
  adj?: number
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
  items?: FormulationItem[]
}

// POST /api/v1/public/workshop/formulations
// Buat formulasi baru via halaman publik. Tidak memerlukan auth.
// Body: { customer_name, customer_phone?, customer_email?, contact_socmed?,
//         perfume_name?, theme?, notes?, slot_id?, branch_id?,
//         items: [{ material_id, drops?, grams, adj? }] }
// Response 201: { data: { formulation_id, access_token, result_url } }
export async function POST(request: Request) {
  let body: FormulationBody
  try {
    body = await request.json() as FormulationBody
  } catch {
    return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 })
  }

  if (!body.customer_name?.trim())
    return NextResponse.json({ error: 'customer_name wajib diisi.' }, { status: 400 })

  if (!Array.isArray(body.items) || body.items.length < 1)
    return NextResponse.json({ error: 'items harus berisi minimal 1 bahan.' }, { status: 400 })

  for (const item of body.items) {
    if (typeof item.grams !== 'number' || item.grams < 0)
      return NextResponse.json({ error: 'Setiap item harus memiliki grams >= 0.' }, { status: 400 })
  }

  const totalGrams = body.items.reduce((sum, item) => sum + item.grams, 0)
  if (totalGrams > MAX_TOTAL_GRAMS)
    return NextResponse.json(
      { error: `Total grams tidak boleh melebihi ${MAX_TOTAL_GRAMS}g. Total saat ini: ${totalGrams}g.` },
      { status: 400 },
    )

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
