import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/v1/orders/:id/receipt
// JSON payload lengkap untuk render struk client-side (ESC/POS atau HTML print).

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { id } = await params

  // Order (RLS menjamin hanya cabang sendiri)
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single()

  if (orderErr || !order) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })

  // Items + product names (parallel)
  const [itemsRes, branchRes, paymentRes] = await Promise.all([
    supabase
      .from('order_items')
      .select('id, product_id, qty, unit_price, line_total, is_custom, customization_notes')
      .eq('order_id', id),
    supabase.from('branches').select('id, name, address, phone').eq('id', order.branch_id).single(),
    supabase.from('payments').select('method, status, paid_at').eq('order_id', id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const productIds = [...new Set((itemsRes.data ?? []).map(i => i.product_id))]
  const [productsRes, customerRes, driverRes, staffRes] = await Promise.all([
    productIds.length
      ? supabase.from('products').select('id, name, sku, type').in('id', productIds)
      : { data: [] },
    order.customer_id
      ? supabase.from('customers').select('id, name, phone').eq('id', order.customer_id).single()
      : { data: null },
    order.driver_id
      ? supabase.from('drivers').select('id, name, fee_value').eq('id', order.driver_id).single()
      : { data: null },
    order.staff_id
      ? supabase.from('staff').select('id, name').eq('id', order.staff_id).single()
      : { data: null },
  ])

  const productMap = new Map((productsRes.data ?? []).map(p => [p.id, p]))

  return NextResponse.json({
    data: {
      order: {
        id:           order.id,
        order_number: order.order_number,
        queue_number: order.queue_number,
        status:       order.status,
        subtotal:     order.subtotal,
        discount:     order.discount,
        total:        order.total,
        paid_at:      order.paid_at,
        created_at:   order.created_at,
      },
      branch:   branchRes.data,
      customer: customerRes.data ?? null,
      driver:   driverRes.data ?? null,
      staff:    staffRes.data ?? null,
      payment:  paymentRes.data ?? null,
      items: (itemsRes.data ?? []).map(item => ({
        ...item,
        product: productMap.get(item.product_id) ?? null,
      })),
    }
  })
}
