import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/

// PUT /api/v1/hr/shifts/[id]
// Update a shift. Manager only.
export async function PUT(
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
    name?: string
    start_time?: string
    end_time?: string
    break_minutes?: number
    active?: boolean
  }

  if (body.start_time != null && !TIME_RE.test(body.start_time))
    return NextResponse.json({ error: 'start_time harus format HH:MM.' }, { status: 400 })
  if (body.end_time != null && !TIME_RE.test(body.end_time))
    return NextResponse.json({ error: 'end_time harus format HH:MM.' }, { status: 400 })

  type ShiftUpdate = { name?: string; start_time?: string; end_time?: string; break_minutes?: number; active?: boolean }
  const patch: ShiftUpdate = {}
  if (body.name != null) patch.name = body.name.trim()
  if (body.start_time != null) patch.start_time = body.start_time
  if (body.end_time != null) patch.end_time = body.end_time
  if (body.break_minutes != null) patch.break_minutes = body.break_minutes
  if (body.active != null) patch.active = body.active

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: 'Tidak ada field yang diupdate.' }, { status: 400 })

  const { data, error } = await supabase
    .from('shifts')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data })
}

// DELETE /api/v1/hr/shifts/[id]
// Soft delete a shift (active=false). Manager only.
export async function DELETE(
  _request: Request,
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

  const { data, error } = await supabase
    .from('shifts')
    .update({ active: false })
    .eq('id', id)
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data: { id } })
}
