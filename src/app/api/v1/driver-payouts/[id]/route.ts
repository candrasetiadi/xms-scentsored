import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH /api/v1/driver-payouts/[id] — tandai payout sebagai paid
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { id } = await params

  const { data: payout } = await supabase
    .from('driver_payouts').select('status').eq('id', id).single()
  if (!payout)
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })
  if (payout.status === 'paid')
    return NextResponse.json({ error: { code: 'UNPROCESSABLE', message: 'Payout sudah dibayar.' } }, { status: 422 })

  const { error } = await supabase
    .from('driver_payouts')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  return NextResponse.json({ data: { id, status: 'paid' } })
}
