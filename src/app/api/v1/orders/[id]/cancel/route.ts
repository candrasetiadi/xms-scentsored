import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/v1/orders/:id/cancel
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { id } = await params

  const { error } = await supabase.rpc('cancel_order_tx', {
    p_order_id: id,
    p_staff_id: staff.id,
  })

  if (error) {
    const isClient = error.message.includes('tidak bisa') || error.message.includes('sudah dibatalkan')
    return NextResponse.json({ error: { code: 'CANCEL_ERROR', message: error.message } }, { status: isClient ? 422 : 500 })
  }

  return NextResponse.json({ data: { id, status: 'cancelled' } })
}
