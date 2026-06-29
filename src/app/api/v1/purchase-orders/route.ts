import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MANAGER_ROLES = ['owner', 'admin']
const ALLOWED_ROLES = ['owner', 'admin', 'stock_keeper']

// GET /api/v1/purchase-orders?branch_id=&status=&limit=30
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !ALLOWED_ROLES.includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branch_id') ?? staff.branch_id
  const status   = searchParams.get('status')
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 100)

  if (!branchId) return NextResponse.json({ error: { code: 'VALIDATION', message: 'branch_id wajib.' } }, { status: 400 })

  let query = supabase
    .from('purchase_orders')
    .select(`
      id, po_number, status, total, notes, ordered_at, received_at, created_at,
      suppliers!inner(id, name),
      purchase_order_items(id, qty_ordered, qty_received, unit_cost, raw_materials!inner(id, name, unit))
    `)
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status as 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}

// POST /api/v1/purchase-orders
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !MANAGER_ROLES.includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  let body: { branch_id?: string; supplier_id: string; notes?: string; items: { raw_material_id: string; qty_ordered: number; unit_cost: number; notes?: string }[] }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Body tidak valid.' } }, { status: 400 })
  }

  const branchId = body.branch_id ?? staff.branch_id
  if (!branchId || !body.supplier_id || !body.items?.length)
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'branch_id, supplier_id, dan items wajib.' } }, { status: 400 })

  // Generate PO number: PO-YYYYMMDD-XXXX
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randPart = Math.random().toString(36).slice(2, 6).toUpperCase()
  const poNumber = `PO-${datePart}-${randPart}`

  const total = body.items.reduce((sum, i) => sum + i.qty_ordered * i.unit_cost, 0)

  const { data: po, error: poErr } = await supabase
    .from('purchase_orders')
    .insert({ branch_id: branchId, supplier_id: body.supplier_id, po_number: poNumber, notes: body.notes ?? null, total, created_by: staff.id })
    .select('id, po_number')
    .single()

  if (poErr) return NextResponse.json({ error: { code: 'DB_ERROR', message: poErr.message } }, { status: 500 })

  const { error: itemsErr } = await supabase
    .from('purchase_order_items')
    .insert(body.items.map(i => ({ po_id: po.id, raw_material_id: i.raw_material_id, qty_ordered: i.qty_ordered, unit_cost: i.unit_cost, notes: i.notes ?? null })))

  if (itemsErr) return NextResponse.json({ error: { code: 'DB_ERROR', message: itemsErr.message } }, { status: 500 })

  return NextResponse.json({ data: { id: po.id, po_number: po.po_number } }, { status: 201 })
}
