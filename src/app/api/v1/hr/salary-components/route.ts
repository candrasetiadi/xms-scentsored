import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/v1/hr/salary-components?staff_id=
// Manager sees any staff's components; staff sees only their own.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const staffIdParam = searchParams.get('staff_id')

  if (staffIdParam && !UUID_RE.test(staffIdParam))
    return NextResponse.json({ error: 'staff_id harus UUID valid.' }, { status: 400 })

  const isManager = ['owner', 'admin'].includes(staff.role)

  if (staffIdParam && !isManager && staffIdParam !== staff.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const targetStaffId = staffIdParam ?? (isManager ? null : staff.id)

  let query = supabase
    .from('salary_components')
    .select('*, staff:staff_id (id, name)')
    .order('component_type')
    .order('name')

  if (targetStaffId) {
    query = query.eq('staff_id', targetStaffId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}

// POST /api/v1/hr/salary-components
// Create a salary component for a staff member. Manager only.
// Body: { staff_id, component_type, name, amount, recurring }
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
    component_type?: string
    name?: string
    amount?: number
    recurring?: boolean
  }

  if (!body.staff_id || !UUID_RE.test(body.staff_id))
    return NextResponse.json({ error: 'staff_id wajib dan harus UUID valid.' }, { status: 400 })
  if (!body.component_type?.trim())
    return NextResponse.json({ error: 'component_type wajib.' }, { status: 400 })
  if (!body.name?.trim())
    return NextResponse.json({ error: 'name wajib.' }, { status: 400 })
  if (body.amount == null || typeof body.amount !== 'number')
    return NextResponse.json({ error: 'amount wajib dan harus angka.' }, { status: 400 })

  const { data, error } = await supabase
    .from('salary_components')
    .insert({
      staff_id: body.staff_id,
      component_type: body.component_type.trim(),
      name: body.name.trim(),
      amount: body.amount,
      recurring: body.recurring ?? true,
      active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
