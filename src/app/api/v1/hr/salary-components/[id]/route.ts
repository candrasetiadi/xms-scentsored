import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// PUT /api/v1/hr/salary-components/[id]
// Update a salary component. Manager only.
// Body: { name?, amount?, recurring?, active? }
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
    amount?: number
    recurring?: boolean
    active?: boolean
  }

  type SalaryComponentUpdate = { name?: string; amount?: number; recurring?: boolean; active?: boolean }
  const patch: SalaryComponentUpdate = {}
  if (body.name != null) patch.name = body.name.trim()
  if (body.amount != null) patch.amount = body.amount
  if (body.recurring != null) patch.recurring = body.recurring
  if (body.active != null) patch.active = body.active

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: 'Tidak ada field yang diupdate.' }, { status: 400 })

  const { data, error } = await supabase
    .from('salary_components')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data })
}

// DELETE /api/v1/hr/salary-components/[id]
// Soft delete a salary component (active=false). Manager only.
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
    .from('salary_components')
    .update({ active: false })
    .eq('id', id)
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data: { id } })
}
