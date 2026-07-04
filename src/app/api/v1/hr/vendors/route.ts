import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/v1/hr/vendors?branch_id=<uuid>
// List vendors. Manager only.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isManager = ['owner', 'admin'].includes(staff.role)
  if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const branchParam = searchParams.get('branch_id')

  if (branchParam && !UUID_RE.test(branchParam))
    return NextResponse.json({ error: 'branch_id harus UUID valid.' }, { status: 400 })

  const effectiveBranch = branchParam ?? (staff.role !== 'owner' ? staff.branch_id : null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  let query = db
    .from('vendors')
    .select('id, branch_id, name, phone, bank_account, notes, is_active, created_at, updated_at, branch:branch_id(id, name)')
    .order('name', { ascending: true })

  if (effectiveBranch) query = query.eq('branch_id', effectiveBranch)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}

// POST /api/v1/hr/vendors
// Create vendor. Manager only.
// Body: { name, branch_id, phone?, bank_account?, notes? }
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
    name?: string
    branch_id?: string
    phone?: string
    bank_account?: string
    notes?: string
  }

  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '')
    return NextResponse.json({ error: 'name wajib.' }, { status: 400 })

  const branchId = body.branch_id ?? staff.branch_id
  if (!branchId || !UUID_RE.test(branchId))
    return NextResponse.json({ error: 'branch_id wajib dan harus UUID valid.' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data, error } = await db
    .from('vendors')
    .insert({
      name: body.name.trim(),
      branch_id: branchId,
      phone: body.phone ?? null,
      bank_account: body.bank_account ?? null,
      notes: body.notes ?? null,
      is_active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
