import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST /api/v1/purchase-orders/[id]/receive
// Body: { items: [{ po_item_id, qty_received, unit_cost }] }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin', 'stock_keeper'].includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  let body: { items: { po_item_id: string; qty_received: number; unit_cost: number }[] }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Body tidak valid.' } }, { status: 400 })
  }

  if (!body.items?.length)
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'items wajib dan tidak boleh kosong.' } }, { status: 400 })

  const { id: poId } = await params
  const adminClient  = createAdminClient()

  const { data, error } = await adminClient.rpc('receive_po_items', {
    p_po_id:    poId,
    p_staff_id: staff.id,
    p_items:    body.items,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('tidak ditemukan'))
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: msg } }, { status: 404 })
    if (msg.includes('tidak bisa') || msg.includes('sudah'))
      return NextResponse.json({ error: { code: 'UNPROCESSABLE', message: msg } }, { status: 422 })
    return NextResponse.json({ error: { code: 'DB_ERROR', message: msg } }, { status: 500 })
  }

  return NextResponse.json({ data })
}
