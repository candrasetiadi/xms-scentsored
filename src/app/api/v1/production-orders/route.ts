import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/v1/production-orders?branch_id=&include_done=true
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
  }

  const { data: staff } = await supabase
    .from('staff')
    .select('id, role, branch_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()
  if (!staff) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
  }

  if (!['owner', 'admin', 'perfumer', 'cashier'].includes(staff.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Akses tidak diizinkan.' } },
      { status: 403 },
    )
  }

  const { searchParams } = new URL(request.url)
  const branchId    = searchParams.get('branch_id') ?? staff.branch_id
  const includeDone = searchParams.get('include_done') === 'true'

  if (!branchId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'branch_id wajib.' } },
      { status: 400 },
    )
  }

  // Verifikasi akses cabang
  const { data: canAccess } = await supabase.rpc('in_branch', { p_branch_id: branchId })
  if (!canAccess) {
    return NextResponse.json({ error: { code: 'FORBIDDEN_BRANCH' } }, { status: 403 })
  }

  let query = supabase
    .from('production_orders')
    .select(`
      id, status, notes, assigned_to, started_at, completed_at, created_at,
      order_id,
      orders!inner(order_number, queue_number),
      products!inner(name, sku)
    `)
    .eq('branch_id', branchId)
    .order('created_at', { ascending: true })

  if (!includeDone) {
    query = query.neq('status', 'diambil')
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  }

  const result = (data ?? []).map(row => ({
    id:           row.id,
    order_id:     row.order_id,
    order_number: (row.orders as any).order_number,
    queue_number: (row.orders as any).queue_number,
    product_name: (row.products as any).name,
    product_sku:  (row.products as any).sku,
    status:       row.status,
    notes:        row.notes,
    assigned_to:  row.assigned_to,
    started_at:   row.started_at,
    completed_at: row.completed_at,
    created_at:   row.created_at,
  }))

  return NextResponse.json({ data: result })
}
