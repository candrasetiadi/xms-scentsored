import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/v1/hr/staff/[id]
// Detail satu staff. Manager only.
export async function GET(
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
    .from('staff')
    .select('id, name, role, branch_id, active, sales_fee_pct, created_at, updated_at, branch:branch_id(id, name)')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data })
}

// PATCH /api/v1/hr/staff/[id]
// Update staff fields. Manager only.
// Allowed fields: sales_fee_pct (and extendable to other non-auth fields as needed).
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
    sales_fee_pct?: number
  }

  const updates: Record<string, unknown> = {}

  if (body.sales_fee_pct !== undefined) {
    if (
      typeof body.sales_fee_pct !== 'number' ||
      !Number.isFinite(body.sales_fee_pct) ||
      body.sales_fee_pct < 0 ||
      body.sales_fee_pct > 100
    )
      return NextResponse.json({ error: 'sales_fee_pct harus angka antara 0 dan 100.' }, { status: 400 })
    updates.sales_fee_pct = body.sales_fee_pct
  }

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'Tidak ada field yang diupdate.' }, { status: 400 })

  const { data: existing } = await supabase.from('staff').select('id').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('staff')
    .update(updates)
    .eq('id', id)
    .select('id, name, role, branch_id, active, sales_fee_pct, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}
