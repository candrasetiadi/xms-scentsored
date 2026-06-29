import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { isGoogleCalendarConfigured, updateEventDescription } from '@/lib/google-calendar'

// PATCH /api/v1/bookings/:id — update status (manager only)
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
  const body = await request.json() as { status?: 'confirmed' | 'cancelled' }

  if (!body.status || !['confirmed', 'cancelled'].includes(body.status))
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'status harus confirmed atau cancelled.' } }, { status: 400 })

  // Ambil booking sebelum update (perlu email + slot_id untuk hapus dari Calendar)
  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('consultation_bookings')
    .select('customer_email, slot_id, status')
    .eq('id', id)
    .single()

  const { data, error } = await supabase
    .from('consultation_bookings')
    .update({ status: body.status })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  if (!data)  return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })

  // Update deskripsi Calendar jika booking dibatalkan
  if (body.status === 'cancelled' && booking?.status === 'confirmed' && isGoogleCalendarConfigured()) {
    updateCalendarAfterCancel(admin, booking.slot_id).catch(err =>
      console.error('[Calendar] cancel update error:', err)
    )
  }

  return NextResponse.json({ data })
}

async function updateCalendarAfterCancel(
  admin: ReturnType<typeof createAdminClient>,
  slotId: string,
) {
  const { data: slot } = await admin
    .from('consultation_slots')
    .select('calendar_event_id, max_bookings, branches!inner(name)')
    .eq('id', slotId)
    .single()

  if (!slot?.calendar_event_id) return

  const { data: bookings } = await admin
    .from('consultation_bookings')
    .select('queue_number, customer_name, customer_phone')
    .eq('slot_id', slotId)
    .eq('status', 'confirmed')
    .order('queue_number')

  await updateEventDescription({
    eventId:     slot.calendar_event_id as string,
    branchName:  ((slot.branches as unknown) as { name: string }).name,
    maxBookings: slot.max_bookings,
    bookings:    (bookings ?? []).map(b => ({
      queueNumber: b.queue_number,
      name:        b.customer_name,
      phone:       b.customer_phone,
    })),
  })
}
