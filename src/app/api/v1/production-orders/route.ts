import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/v1/production-orders?branch_id=&include_done=true
export async function GET(request: Request) {
  try {
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
        order_id, order_item_id,
        orders!order_id(order_number, queue_number),
        products!product_id(name, sku)
      `)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: true })

    if (!includeDone) {
      query = query.neq('status', 'diambil')
    }

    const { data, error } = await query
    if (error) {
      console.error('[production-orders] db error:', error.message)
      return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
    }

    const result = (data ?? []).map(row => {
      const r      = row as any
      const orders  = r.orders   ?? {}
      const products = r.products ?? {}
      return {
        id:            row.id,
        order_id:      row.order_id,
        order_item_id: r.order_item_id ?? null,
        order_number:  orders.order_number  ?? '',
        queue_number:  orders.queue_number  ?? 0,
        product_name:  products.name ?? '—',
        product_sku:   products.sku  ?? '',
        status:        row.status,
        notes:         row.notes,
        assigned_to:   row.assigned_to,
        started_at:    row.started_at,
        completed_at:  row.completed_at,
        created_at:    row.created_at,
      }
    })

    return NextResponse.json({ data: result })
  } catch (err) {
    console.error('[production-orders] unexpected error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Terjadi kesalahan server.' } },
      { status: 500 },
    )
  }
}
