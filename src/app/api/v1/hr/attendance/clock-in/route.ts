import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// POST /api/v1/hr/attendance/clock-in
// Clock in for the authenticated staff. Calls RPC clock_in.
// Body: { work_date?: string (YYYY-MM-DD, defaults to today) }
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { work_date?: string }

  const workDate = body.work_date ?? new Date().toISOString().slice(0, 10)
  if (!DATE_RE.test(workDate))
    return NextResponse.json({ error: 'work_date harus format YYYY-MM-DD.' }, { status: 400 })

  const { error } = await supabase.rpc('clock_in', {
    p_staff_id: staff.id,
    p_work_date: workDate,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: { staff_id: staff.id, work_date: workDate, action: 'clock_in' } })
}
