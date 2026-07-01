import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// GET /api/v1/hr/leave?status=&type=&branch_id=&staff_id=
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
  const typeParam = searchParams.get('type')
  const branchId = searchParams.get('branch_id')
  const staffIdParam = searchParams.get('staff_id')

  if (branchId && !UUID_RE.test(branchId))
    return NextResponse.json({ error: 'branch_id harus UUID valid.' }, { status: 400 })
  if (staffIdParam && !UUID_RE.test(staffIdParam))
    return NextResponse.json({ error: 'staff_id harus UUID valid.' }, { status: 400 })

  const isManager = ['owner', 'admin'].includes(staff.role)

  let query = supabase
    .from('leave_requests')
    .select('*, staff:staff_id (id, name, role, branch_id)')
    .order('created_at', { ascending: false })

  if (!isManager) {
    query = query.eq('staff_id', staff.id)
  } else {
    if (staffIdParam) query = query.eq('staff_id', staffIdParam)
    if (branchId) query = query.eq('staff.branch_id', branchId)
  }

  if (statusParam) query = query.eq('status', statusParam)
  if (typeParam) query = query.eq('type', typeParam)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}

// POST /api/v1/hr/leave
// Submit a leave request for the authenticated staff.
// Body: { type, start_date, end_date, days, reason }
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    type?: string
    start_date?: string
    end_date?: string
    days?: number
    reason?: string
  }

  if (!body.type?.trim())
    return NextResponse.json({ error: 'type wajib.' }, { status: 400 })
  if (!body.start_date || !DATE_RE.test(body.start_date))
    return NextResponse.json({ error: 'start_date wajib (format YYYY-MM-DD).' }, { status: 400 })
  if (!body.end_date || !DATE_RE.test(body.end_date))
    return NextResponse.json({ error: 'end_date wajib (format YYYY-MM-DD).' }, { status: 400 })
  if (body.end_date < body.start_date)
    return NextResponse.json({ error: 'end_date harus >= start_date.' }, { status: 400 })
  if (!body.days || typeof body.days !== 'number' || body.days <= 0)
    return NextResponse.json({ error: 'days wajib dan harus angka positif.' }, { status: 400 })
  if (!body.reason?.trim())
    return NextResponse.json({ error: 'reason wajib.' }, { status: 400 })

  const { data, error } = await supabase
    .from('leave_requests')
    .insert({
      staff_id: staff.id,
      type: body.type.trim(),
      start_date: body.start_date,
      end_date: body.end_date,
      days: body.days,
      reason: body.reason.trim(),
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
