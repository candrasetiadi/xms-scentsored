import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// GET /api/v1/hr/overtime?status=&branch_id=&staff_id=
// Manager sees all; staff sees only their own.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get('status')
  const branchId = searchParams.get('branch_id')
  const staffIdParam = searchParams.get('staff_id')

  if (branchId && !UUID_RE.test(branchId))
    return NextResponse.json({ error: 'branch_id harus UUID valid.' }, { status: 400 })
  if (staffIdParam && !UUID_RE.test(staffIdParam))
    return NextResponse.json({ error: 'staff_id harus UUID valid.' }, { status: 400 })

  const isManager = ['owner', 'admin'].includes(staff.role)

  let query = supabase
    .from('overtime_requests')
    .select('*, staff:staff_id (id, name, role, branch_id)')
    .order('work_date', { ascending: false })

  if (!isManager) {
    query = query.eq('staff_id', staff.id)
  } else {
    if (staffIdParam) query = query.eq('staff_id', staffIdParam)
    if (branchId) query = query.eq('staff.branch_id', branchId)
  }

  if (statusParam) query = query.eq('status', statusParam)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}

// POST /api/v1/hr/overtime
// Submit an overtime request for the authenticated staff.
// Body: { work_date, hours, reason }
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    work_date?: string
    hours?: number
    reason?: string
  }

  if (!body.work_date || !DATE_RE.test(body.work_date))
    return NextResponse.json({ error: 'work_date wajib (format YYYY-MM-DD).' }, { status: 400 })
  if (!body.hours || typeof body.hours !== 'number' || body.hours <= 0)
    return NextResponse.json({ error: 'hours wajib dan harus angka positif.' }, { status: 400 })
  if (!body.reason?.trim())
    return NextResponse.json({ error: 'reason wajib.' }, { status: 400 })

  const { data, error } = await supabase
    .from('overtime_requests')
    .insert({
      staff_id: staff.id,
      work_date: body.work_date,
      hours: body.hours,
      reason: body.reason.trim(),
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
