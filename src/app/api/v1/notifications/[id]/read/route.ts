import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/v1/notifications/[id]/read
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
  }

  const { data: staff } = await supabase
    .from('staff')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()
  if (!staff) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
  }

  const { id: notificationId } = await params

  const { error } = await supabase
    .from('notification_reads')
    .upsert(
      { notification_id: notificationId, staff_id: staff.id },
      { onConflict: 'notification_id,staff_id', ignoreDuplicates: true },
    )

  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  }

  return NextResponse.json({ data: { ok: true } })
}
