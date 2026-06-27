import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/v1/orders/:id — detail order + items + driver + customer
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { id } = await params

  // Ambil order (RLS memastikan hanya order di cabang user yang bisa diakses)
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !order) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })

  // Ambil items + product name
  const { data: items } = await supabase
    .from('order_items')
    .select('id, product_id, qty, unit_price, line_total, is_custom, customization_notes')
    .eq('order_id', id)

  // Ambil nama produk
  const productIds = [...new Set((items ?? []).map(i => i.product_id))]
  const { data: products } = productIds.length
    ? await supabase.from('products').select('id, name, sku, type').in('id', productIds)
    : { data: [] }

  const productMap = new Map((products ?? []).map(p => [p.id, p]))

  const enrichedItems = (items ?? []).map(item => ({
    ...item,
    product: productMap.get(item.product_id) ?? null,
  }))

  // Customer + driver (opsional)
  const [customerRes, driverRes] = await Promise.all([
    order.customer_id
      ? supabase.from('customers').select('id, name, phone').eq('id', order.customer_id).single()
      : { data: null },
    order.driver_id
      ? supabase.from('drivers').select('id, name, fee_value').eq('id', order.driver_id).single()
      : { data: null },
  ])

  return NextResponse.json({
    data: {
      ...order,
      items: enrichedItems,
      customer: customerRes.data ?? null,
      driver:   driverRes.data ?? null,
    }
  })
}
