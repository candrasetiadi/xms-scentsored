import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { CreateOrderResult } from '@/types/database'

// POST /api/v1/orders — buat order baru (draft)
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  if (!['owner', 'admin', 'cashier'].includes(staff.role)) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Hanya kasir, admin, atau owner.' } }, { status: 403 })
  }

  const body = await request.json() as {
    branch_id?:        string
    driver_id?:        string | null
    customer_name?:    string
    customer_phone?:   string
    discount?:         number
    items: { product_id: string; qty: number; unit_price: number; is_custom?: boolean; customization_notes?: string }[]
  }

  const branchId = body.branch_id ?? staff.branch_id
  if (!branchId) return NextResponse.json({ error: { code: 'VALIDATION', message: 'branch_id wajib.' } }, { status: 400 })
  if (!body.items?.length) return NextResponse.json({ error: { code: 'VALIDATION', message: 'Minimal 1 item.' } }, { status: 400 })

  // Validasi sederhana per item
  for (const item of body.items) {
    if (!item.product_id || !item.qty || item.qty <= 0 || item.unit_price == null || item.unit_price < 0) {
      return NextResponse.json({ error: { code: 'VALIDATION', message: 'Item tidak valid.' } }, { status: 400 })
    }
  }

  // Verifikasi akses cabang
  const { data: canAccess } = await supabase.rpc('in_branch', { p_branch_id: branchId })
  if (!canAccess) return NextResponse.json({ error: { code: 'FORBIDDEN_BRANCH' } }, { status: 403 })

  const { data, error } = await supabase.rpc('create_order_tx', {
    p_branch_id:      branchId,
    p_staff_id:       staff.id,
    p_driver_id:      body.driver_id ?? null,
    p_customer_name:  body.customer_name ?? null,
    p_customer_phone: body.customer_phone ?? null,
    p_discount:       body.discount ?? 0,
    p_items:          body.items,
  })

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  return NextResponse.json({ data: data as CreateOrderResult }, { status: 201 })
}

// GET /api/v1/orders?branch_id=&status=&date=&limit=&offset=
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branch_id') ?? staff.branch_id
  const status   = searchParams.get('status')
  const date     = searchParams.get('date')
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '25'), 100)
  const offset   = parseInt(searchParams.get('offset') ?? '0')

  if (!branchId) return NextResponse.json({ error: { code: 'VALIDATION', message: 'branch_id wajib.' } }, { status: 400 })

  const { data: canAccess } = await supabase.rpc('in_branch', { p_branch_id: branchId })
  if (!canAccess) return NextResponse.json({ error: { code: 'FORBIDDEN_BRANCH' } }, { status: 403 })

  let query = supabase
    .from('orders')
    .select('id, order_number, queue_number, status, subtotal, discount, total, paid_at, created_at, customer_id, driver_id', { count: 'exact' })
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status as 'draft' | 'awaiting_payment' | 'paid' | 'in_production' | 'ready' | 'completed' | 'cancelled')
  if (date)   query = query.gte('created_at', `${date}T00:00:00`).lt('created_at', `${date}T23:59:59.999`)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  return NextResponse.json({ data, meta: { total: count ?? 0, limit, offset } })
}
