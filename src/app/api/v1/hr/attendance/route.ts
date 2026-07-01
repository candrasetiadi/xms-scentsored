import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// GET /api/v1/hr/attendance?branch_id=&from=&to=&staff_id=
// Manager sees all; staff sees only their own records.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isManager = ['owner', 'admin'].includes(staff.role)
  const { searchParams } = new URL(request.url)
  const branchParam = searchParams.get('branch_id') ?? staff.branch_id
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const staffIdParam = searchParams.get('staff_id')

  // Non-manager must have a branch resolved from session
  if (!isManager && (!branchParam || !UUID_RE.test(branchParam)))
    return NextResponse.json({ error: 'branch_id wajib dan harus UUID valid.' }, { status: 400 })
  if (isManager && branchParam && !UUID_RE.test(branchParam))
    return NextResponse.json({ error: 'branch_id harus UUID valid.' }, { status: 400 })
  if (from && !DATE_RE.test(from)) return NextResponse.json({ error: 'from harus format YYYY-MM-DD.' }, { status: 400 })
  if (to && !DATE_RE.test(to)) return NextResponse.json({ error: 'to harus format YYYY-MM-DD.' }, { status: 400 })
  if (staffIdParam && !UUID_RE.test(staffIdParam))
    return NextResponse.json({ error: 'staff_id harus UUID valid.' }, { status: 400 })

  let query = supabase
    .from('attendances')
    .select('*, staff:staff_id (id, name, role)')
    .order('work_date', { ascending: false })

  if (!isManager) {
    query = query.eq('staff_id', staff.id)
    if (branchParam) query = query.eq('branch_id', branchParam)
  } else {
    if (branchParam) query = query.eq('branch_id', branchParam)
    if (staffIdParam) query = query.eq('staff_id', staffIdParam)
  }

  if (from) query = query.gte('work_date', from)
  if (to) query = query.lte('work_date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}
