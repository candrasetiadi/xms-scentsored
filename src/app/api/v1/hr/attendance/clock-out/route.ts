import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// POST /api/v1/hr/attendance/clock-out
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff')
    .select('id, role, branch_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()
  if (!staff) return NextResponse.json({ error: 'Staff tidak ditemukan.' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { work_date?: string }
  const workDate = body.work_date ?? new Date().toISOString().slice(0, 10)
  if (!DATE_RE.test(workDate))
    return NextResponse.json({ error: 'work_date harus format YYYY-MM-DD.' }, { status: 400 })

  const { error } = await supabase.rpc('clock_out', {
    p_staff_id:  staff.id,
    p_work_date: workDate,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch the updated record so client gets the actual clock_out_at + worked_minutes
  const { data: att } = await supabase
    .from('attendances')
    .select('id, clock_in, clock_out, worked_minutes, status')
    .eq('staff_id', staff.id)
    .eq('work_date', workDate)
    .single()

  return NextResponse.json({
    data: {
      attendance_id:  att?.id              ?? null,
      clock_in_at:    att?.clock_in        ?? null,
      clock_out_at:   att?.clock_out       ?? null,
      worked_minutes: att?.worked_minutes  ?? null,
      status:         att?.status          ?? 'present',
    }
  })
}
