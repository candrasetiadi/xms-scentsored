import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// PATCH /api/v1/bookings/:id
// action: 'confirm' | 'cancel'
export async function PATCH(
  request: Request,
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
  const body = await request.json() as { action: 'confirm' | 'cancel' }

  if (!body.action || !['confirm', 'cancel'].includes(body.action))
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'action harus confirm atau cancel.' } }, { status: 400 })

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('consultation_bookings')
    .select('slot_id, status, amount')
    .eq('id', id)
    .single()

  if (!booking) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })

  if (body.action === 'confirm' && !['pending_payment', 'expired'].includes(booking.status))
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Hanya booking pending atau expired yang bisa dikonfirmasi.' } }, { status: 400 })

  if (body.action === 'cancel' && booking.status === 'cancelled')
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Booking sudah dibatalkan.' } }, { status: 400 })

  const newStatus  = body.action === 'confirm' ? 'confirmed' as const : 'cancelled' as const
  const updateData = newStatus === 'confirmed'
    ? { status: newStatus, paid_at: new Date().toISOString() }
    : { status: newStatus }

  const { data, error } = await admin
    .from('consultation_bookings')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  return NextResponse.json({ data })
}
