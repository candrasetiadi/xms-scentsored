import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft:    ['ordered', 'cancelled'],
  ordered:  ['cancelled'],
  partial:  [],
  received: [],
  cancelled:[],
}

// PATCH /api/v1/purchase-orders/[id]/status
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  let body: { status: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Body tidak valid.' } }, { status: 400 })
  }

  const { id } = await params

  const { data: po } = await supabase.from('purchase_orders').select('status').eq('id', id).single()
  if (!po) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })

  const allowed = VALID_TRANSITIONS[po.status] ?? []
  if (!allowed.includes(body.status))
    return NextResponse.json({ error: { code: 'UNPROCESSABLE', message: `Tidak bisa ubah status dari ${po.status} ke ${body.status}.` } }, { status: 422 })

  const patch = body.status === 'ordered'
    ? { status: body.status as 'ordered', ordered_at: new Date().toISOString() }
    : { status: body.status as 'cancelled' }

  const { error } = await supabase.from('purchase_orders').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  return NextResponse.json({ data: { id, status: body.status } })
}
