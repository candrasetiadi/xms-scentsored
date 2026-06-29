import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { isGoogleCalendarConfigured, deleteSlotEvent } from '@/lib/google-calendar'

// PATCH /api/v1/consultation-slots/:id — update slot (manager only)
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
  const body = await request.json() as Partial<{
    date: string; start_time: string; end_time: string
    max_bookings: number; notes: string; is_active: boolean
  }>

  const { data, error } = await supabase
    .from('consultation_slots')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  if (!data)  return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })

  return NextResponse.json({ data })
}

// DELETE /api/v1/consultation-slots/:id — nonaktifkan slot (soft delete) + hapus Calendar event
export async function DELETE(
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

  // Ambil calendar_event_id sebelum nonaktifkan
  const admin = createAdminClient()
  const { data: slot } = await admin
    .from('consultation_slots')
    .select('calendar_event_id')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('consultation_slots').update({ is_active: false }).eq('id', id)

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  // Hapus Calendar event (non-blocking)
  if (isGoogleCalendarConfigured() && slot?.calendar_event_id) {
    deleteSlotEvent(slot.calendar_event_id as string).catch(() => {})
  }

  return NextResponse.json({ data: { id, is_active: false } })
}
