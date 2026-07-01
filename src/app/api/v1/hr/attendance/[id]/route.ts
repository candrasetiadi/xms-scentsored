import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

// PATCH /api/v1/hr/attendance/[id]
// Direct correction of an attendance record. Manager only.
// Body: { clock_in?, clock_out?, status?, note? }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isManager = ['owner', 'admin'].includes(staff.role)
  if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'id tidak valid.' }, { status: 400 })

  const body = await request.json() as {
    clock_in?: string | null
    clock_out?: string | null
    status?: string
    note?: string | null
  }

  if (body.clock_in != null && !DATETIME_RE.test(body.clock_in))
    return NextResponse.json({ error: 'clock_in harus format ISO datetime.' }, { status: 400 })
  if (body.clock_out != null && !DATETIME_RE.test(body.clock_out))
    return NextResponse.json({ error: 'clock_out harus format ISO datetime.' }, { status: 400 })

  const VALID_STATUSES = ['present', 'absent', 'late', 'half_day', 'on_leave']
  if (body.status != null && !VALID_STATUSES.includes(body.status))
    return NextResponse.json({ error: `status harus salah satu: ${VALID_STATUSES.join(', ')}.` }, { status: 400 })

  type AttendanceUpdate = { clock_in?: string | null; clock_out?: string | null; status?: string; note?: string | null }
  const patch: AttendanceUpdate = {}
  if ('clock_in' in body) patch.clock_in = body.clock_in
  if ('clock_out' in body) patch.clock_out = body.clock_out
  if (body.status != null) patch.status = body.status
  if ('note' in body) patch.note = body.note

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: 'Tidak ada field yang diupdate.' }, { status: 400 })

  const { data, error } = await supabase
    .from('attendances')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data })
}
