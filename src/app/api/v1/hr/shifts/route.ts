import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/

// GET /api/v1/hr/shifts?branch_id=<uuid>
// List active shifts: global (branch_id IS NULL) + branch-specific.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branch_id') ?? staff.branch_id

  if (!branchId || !UUID_RE.test(branchId))
    return NextResponse.json({ error: 'branch_id wajib dan harus UUID valid.' }, { status: 400 })

  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('active', true)
    .or(`branch_id.is.null,branch_id.eq.${branchId}`)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}

// POST /api/v1/hr/shifts
// Create a shift. Manager only.
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
    branch_id?: string | null
    name?: string
    start_time?: string
    end_time?: string
    break_minutes?: number
  }

  if (!body.name?.trim()) return NextResponse.json({ error: 'name wajib.' }, { status: 400 })
  if (!body.start_time || !TIME_RE.test(body.start_time))
    return NextResponse.json({ error: 'start_time wajib (format HH:MM).' }, { status: 400 })
  if (!body.end_time || !TIME_RE.test(body.end_time))
    return NextResponse.json({ error: 'end_time wajib (format HH:MM).' }, { status: 400 })
  if (body.branch_id != null && !UUID_RE.test(body.branch_id))
    return NextResponse.json({ error: 'branch_id harus UUID valid.' }, { status: 400 })

  const { data, error } = await supabase
    .from('shifts')
    .insert({
      branch_id: body.branch_id ?? null,
      name: body.name.trim(),
      start_time: body.start_time,
      end_time: body.end_time,
      break_minutes: body.break_minutes ?? 0,
      active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
