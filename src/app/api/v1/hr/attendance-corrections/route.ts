import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

// GET /api/v1/hr/attendance-corrections?status=&branch_id=
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
  const branchId = searchParams.get('branch_id') ?? staff.branch_id

  if (branchId && !UUID_RE.test(branchId))
    return NextResponse.json({ error: 'branch_id harus UUID valid.' }, { status: 400 })

  const isManager = ['owner', 'admin'].includes(staff.role)

  let query = supabase
    .from('attendance_corrections')
    .select('*, staff:staff_id (id, name, role, branch_id)')
    .order('created_at', { ascending: false })

  if (!isManager) {
    query = query.eq('staff_id', staff.id)
  } else if (branchId) {
    // Join via staff to filter by branch
    query = query.eq('staff.branch_id', branchId)
  }

  if (statusParam) query = query.eq('status', statusParam)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}

// POST /api/v1/hr/attendance-corrections
// Submit a correction request for the authenticated staff.
// Body: { work_date, requested_clock_in?, requested_clock_out?, reason }
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    work_date?: string
    requested_clock_in?: string | null
    requested_clock_out?: string | null
    reason?: string
  }

  if (!body.work_date || !DATE_RE.test(body.work_date))
    return NextResponse.json({ error: 'work_date wajib (format YYYY-MM-DD).' }, { status: 400 })
  if (!body.reason?.trim())
    return NextResponse.json({ error: 'reason wajib.' }, { status: 400 })
  if (body.requested_clock_in != null && !DATETIME_RE.test(body.requested_clock_in))
    return NextResponse.json({ error: 'requested_clock_in harus format ISO datetime.' }, { status: 400 })
  if (body.requested_clock_out != null && !DATETIME_RE.test(body.requested_clock_out))
    return NextResponse.json({ error: 'requested_clock_out harus format ISO datetime.' }, { status: 400 })
  if (!body.requested_clock_in && !body.requested_clock_out)
    return NextResponse.json({ error: 'Minimal satu dari requested_clock_in atau requested_clock_out wajib diisi.' }, { status: 400 })

  const { data, error } = await supabase
    .from('attendance_corrections')
    .insert({
      staff_id: staff.id,
      work_date: body.work_date,
      requested_clock_in: body.requested_clock_in ?? null,
      requested_clock_out: body.requested_clock_out ?? null,
      reason: body.reason.trim(),
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
