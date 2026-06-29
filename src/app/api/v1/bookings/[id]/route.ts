import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH /api/v1/bookings/:id — update status (manager only: cancel booking)
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

  const { data, error } = await supabase
    .from('consultation_bookings')
    .update({ status: body.status })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  if (!data)  return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })

  return NextResponse.json({ data })
}
