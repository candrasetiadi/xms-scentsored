import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST /api/v1/workshop/materials/[id]/restock
// Tambah stok bahan workshop. Manager only.
// Body: { qty_gram: number (> 0), notes?: string }
export async function POST(
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

  let body: { qty_gram?: unknown; notes?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 })
  }

  const qtyGram = body.qty_gram
  if (typeof qtyGram !== 'number' || qtyGram <= 0)
    return NextResponse.json({ error: 'qty_gram wajib diisi dan harus > 0.' }, { status: 400 })

  const notes = typeof body.notes === 'string' ? body.notes : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: current, error: fetchErr } = await db
    .from('workshop_materials')
    .select('stock_gram')
    .eq('id', id)
    .single()

  if (fetchErr || !current)
    return NextResponse.json({ error: 'Material tidak ditemukan.' }, { status: 404 })

  const { error: movErr } = await db
    .from('workshop_stock_movements')
    .insert({
      material_id:   id,
      qty_change:    qtyGram,
      movement_type: 'restock',
      notes,
      created_by:    staff.id,
    })

  if (movErr) return NextResponse.json({ error: movErr.message }, { status: 500 })

  const newStockGram = current.stock_gram + qtyGram
  const { error: updateErr } = await db
    .from('workshop_materials')
    .update({ stock_gram: newStockGram })
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ data: { new_stock_gram: newStockGram } })
}
