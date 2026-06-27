import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ReceiptPrintClient } from './ReceiptPrintClient'

export default async function ReceiptPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  // Ambil semua data struk dalam satu pass
  const { data: order, error } = await supabase
    .from('orders').select('*').eq('id', id).single()

  if (error || !order) redirect('/pos/history')

  const [itemsRes, branchRes, paymentRes] = await Promise.all([
    supabase.from('order_items')
      .select('id, product_id, qty, unit_price, line_total, is_custom, customization_notes')
      .eq('order_id', id),
    supabase.from('branches').select('name, address, phone').eq('id', order.branch_id).single(),
    supabase.from('payments')
      .select('method, status, paid_at').eq('order_id', id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const productIds = [...new Set((itemsRes.data ?? []).map(i => i.product_id))]
  const [productsRes, customerRes, driverRes, staffRes] = await Promise.all([
    productIds.length
      ? supabase.from('products').select('id, name, type').in('id', productIds)
      : { data: [] },
    order.customer_id
      ? supabase.from('customers').select('name, phone').eq('id', order.customer_id).single()
      : { data: null },
    order.driver_id
      ? supabase.from('drivers').select('name, fee_value').eq('id', order.driver_id).single()
      : { data: null },
    order.staff_id
      ? supabase.from('staff').select('name').eq('id', order.staff_id).single()
      : { data: null },
  ])

  const productMap = new Map((productsRes.data ?? []).map(p => [p.id, p]))

  const receiptData = {
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
    branch:   branchRes.data   ?? { name: 'Scentsored', address: null, phone: null },
    customer: customerRes.data ?? null,
    driver:   driverRes.data   ?? null,
    staff:    staffRes.data    ?? null,
    payment:  paymentRes.data  ?? null,
    items: (itemsRes.data ?? []).map(item => ({
      ...item,
      product: productMap.get(item.product_id) ?? null,
    })),
  }

  return <ReceiptPrintClient data={receiptData} />
}
