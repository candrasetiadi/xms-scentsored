import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// PATCH /api/v1/workshop/materials/[id]
// Update data bahan workshop. Manager only.
// Jika stock_gram berubah, otomatis insert movement type 'adjustment'.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['owner', 'admin'].includes(staff.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (!UUID_RE.test(id))
    return NextResponse.json({ error: 'id harus UUID valid.' }, { status: 400 })

  let body: Partial<{
    name: string
    dilution_percentage: number
    category_id: string
    stock_gram: number
    active: boolean
  }>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: current, error: fetchErr } = await db
    .from('workshop_materials')
    .select('stock_gram')
    .eq('id', id)
    .single()

  if (fetchErr || !current)
    return NextResponse.json({ error: 'Material tidak ditemukan.' }, { status: 404 })

  if (typeof body.stock_gram === 'number' && body.stock_gram !== current.stock_gram) {
    const qtyChange = body.stock_gram - current.stock_gram
    const { error: movErr } = await db
      .from('workshop_stock_movements')
      .insert({
        material_id:   id,
        qty_change:    qtyChange,
        movement_type: 'adjustment',
        created_by:    staff.id,
      })

    if (movErr) return NextResponse.json({ error: movErr.message }, { status: 500 })
  }

  const updatePayload: Record<string, unknown> = {}
  if (body.name                !== undefined) updatePayload.name                = body.name
  if (body.dilution_percentage !== undefined) updatePayload.dilution_percentage = body.dilution_percentage
  if (body.category_id         !== undefined) updatePayload.category_id         = body.category_id
  if (body.stock_gram          !== undefined) updatePayload.stock_gram          = body.stock_gram
  if (body.active              !== undefined) updatePayload.active              = body.active

  if (Object.keys(updatePayload).length === 0)
    return NextResponse.json({ error: 'Tidak ada field yang diubah.' }, { status: 400 })

  const { data, error } = await db
    .from('workshop_materials')
    .update(updatePayload)
    .eq('id', id)
    .select('*, scent_categories(id, name, color_hex, sort_order)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}
