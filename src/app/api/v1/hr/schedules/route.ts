import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// GET /api/v1/hr/schedules?branch_id=&from=YYYY-MM-DD&to=YYYY-MM-DD
// Manager sees all staff in branch; staff sees only their own.
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

  if (!isManager && (!branchParam || !UUID_RE.test(branchParam)))
    return NextResponse.json({ error: 'branch_id wajib dan harus UUID valid.' }, { status: 400 })
  if (isManager && branchParam && !UUID_RE.test(branchParam))
    return NextResponse.json({ error: 'branch_id harus UUID valid.' }, { status: 400 })
  if (!from || !DATE_RE.test(from)) return NextResponse.json({ error: 'from wajib (format YYYY-MM-DD).' }, { status: 400 })
  if (!to || !DATE_RE.test(to)) return NextResponse.json({ error: 'to wajib (format YYYY-MM-DD).' }, { status: 400 })

  let query = supabase
    .from('staff_schedules')
    .select(`
      id, work_date, staff_id, branch_id,
      staff:staff_id (id, name, role),
      shift:shift_id (id, name, start_time, end_time, break_minutes)
    `)
    .gte('work_date', from)
    .lte('work_date', to)
    .order('work_date')

  if (!isManager) {
    query = query.eq('staff_id', staff.id)
    if (branchParam) query = query.eq('branch_id', branchParam)
  } else {
    if (branchParam) query = query.eq('branch_id', branchParam)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}

// POST /api/v1/hr/schedules
// Create (upsert) a schedule entry. Manager only.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isManager = ['owner', 'admin'].includes(staff.role)
  if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as {
    staff_id?: string
    shift_id?: string
    work_date?: string
  }

  if (!body.staff_id || !UUID_RE.test(body.staff_id))
    return NextResponse.json({ error: 'staff_id wajib dan harus UUID valid.' }, { status: 400 })
  if (!body.shift_id || !UUID_RE.test(body.shift_id))
    return NextResponse.json({ error: 'shift_id wajib dan harus UUID valid.' }, { status: 400 })
  if (!body.work_date || !DATE_RE.test(body.work_date))
    return NextResponse.json({ error: 'work_date wajib (format YYYY-MM-DD).' }, { status: 400 })

  // Resolve branch_id from the target staff
  const { data: targetStaff } = await supabase
    .from('staff').select('branch_id').eq('id', body.staff_id).single()
  if (!targetStaff) return NextResponse.json({ error: 'staff tidak ditemukan.' }, { status: 404 })

  if (!targetStaff.branch_id)
    return NextResponse.json({ error: 'Staff tidak memiliki branch_id.' }, { status: 400 })

  const { data, error } = await supabase
    .from('staff_schedules')
    .upsert(
      {
        staff_id: body.staff_id,
        shift_id: body.shift_id,
        work_date: body.work_date,
        branch_id: targetStaff.branch_id,
      },
      { onConflict: 'staff_id,work_date' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
