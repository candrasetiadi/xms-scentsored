import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/v1/hr/leave/balances?year=&staff_id=
// Return leave_balances for the logged-in staff.
// Manager can pass ?staff_id= to view any staff's balances.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const yearParam = searchParams.get('year')
  const staffIdParam = searchParams.get('staff_id')

  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear()
  if (isNaN(year) || year < 2000 || year > 2100)
    return NextResponse.json({ error: 'year tidak valid.' }, { status: 400 })

  const isManager = ['owner', 'admin'].includes(staff.role)

  if (staffIdParam) {
    if (!UUID_RE.test(staffIdParam))
      return NextResponse.json({ error: 'staff_id harus UUID valid.' }, { status: 400 })
    if (!isManager && staffIdParam !== staff.id)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const targetStaffId = staffIdParam ?? staff.id

  const { data, error } = await supabase
    .from('leave_balances')
    .select('*')
    .eq('staff_id', targetStaffId)
    .eq('year', year)
    .order('type')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}
