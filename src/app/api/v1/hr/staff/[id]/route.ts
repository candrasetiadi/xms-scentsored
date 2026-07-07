import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function requireManager() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: staff } = await supabase
    .from('staff').select('id, role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role)) return null
  return { supabase, staff }
}

// PATCH /api/v1/hr/staff/[id] — update name, role, branch_id, active
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireManager()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'id tidak valid.' }, { status: 400 })

  const body = await request.json() as {
    name?: string
    role?: string
    branch_id?: string | null
    active?: boolean
    sales_fee_pct?: number
  }

  const VALID_ROLES = ['owner', 'admin', 'cashier', 'perfumer', 'stock_keeper']
  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.role !== undefined) {
    if (!VALID_ROLES.includes(body.role))
      return NextResponse.json({ error: 'Role tidak valid.' }, { status: 400 })
    updates.role = body.role
  }
  if (body.branch_id !== undefined)    updates.branch_id    = body.branch_id || null
  if (body.active !== undefined)       updates.active       = body.active
  if (body.sales_fee_pct !== undefined) {
    if (body.sales_fee_pct < 0 || body.sales_fee_pct > 100)
      return NextResponse.json({ error: 'sales_fee_pct harus 0–100.' }, { status: 400 })
    updates.sales_fee_pct = body.sales_fee_pct
  }

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'Tidak ada field yang diupdate.' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('staff')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updates as any)
    .eq('id', id)
    .select('id, name, role, active, branch_id, branches(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE /api/v1/hr/staff/[id] — soft delete (nonaktifkan)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireManager()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'id tidak valid.' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('staff').update({ active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: { id } })
}
