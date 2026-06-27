import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LabelPrintClient } from './LabelPrintClient'

// Cetak label parfum per order_item_id
// URL: /print/label/:order_item_id
export default async function LabelPrintPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ qty?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id: orderItemId } = await params
  const { qty: qtyParam }   = await searchParams

  // Ambil order item
  const { data: item, error } = await supabase
    .from('order_items')
    .select('id, order_id, product_id, qty, unit_price, is_custom, customization_notes')
    .eq('id', orderItemId)
    .single()

  if (error || !item) redirect('/pos/history')

  // Ambil order + product secara paralel
  const [orderRes, productRes] = await Promise.all([
    supabase.from('orders').select('order_number, queue_number, created_at, branch_id').eq('id', item.order_id).single(),
    supabase.from('products').select('name, sku, category').eq('id', item.product_id).single(),
  ])

  const order   = orderRes.data
  const product = productRes.data
  if (!order || !product) redirect('/pos/history')

  // Ambil nama branch
  const { data: branch } = await supabase
    .from('branches').select('name').eq('id', order.branch_id).single()

  const printQty = parseInt(qtyParam ?? '1')

  return (
    <LabelPrintClient
      item={{
        id:                  item.id,
        qty:                 item.qty,
        unit_price:          item.unit_price,
        is_custom:           item.is_custom,
        customization_notes: item.customization_notes ?? null,
      }}
      product={{ name: product.name, sku: product.sku, category: product.category ?? null }}
      order={{
        order_number: order.order_number,
        queue_number: order.queue_number,
        created_at:   order.created_at,
      }}
      branchName={branch?.name ?? 'Scentsored'}
      printQty={Math.min(Math.max(1, printQty), 20)}
    />
  )
}
