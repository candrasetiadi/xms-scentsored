import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LabelPrintClient } from './LabelPrintClient'

// Cetak label parfum per order_item_id
// URL: /print/label/:order_item_id?qty=1
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item, error } = await (supabase as any)
    .from('order_items')
    .select('id, order_id, product_id, qty, size_ml, customization_notes')
    .eq('id', orderItemId)
    .single()

  if (error || !item) {
    console.error('[label] order_items fetch error:', error?.message, 'item_id:', orderItemId)
    redirect('/pos/history')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [productRes, orderRes] = await Promise.all([
    (supabase as any)
      .from('products')
      .select('name, concentration')
      .eq('id', item.product_id)
      .single(),
    supabase
      .from('orders')
      .select('created_at')
      .eq('id', item.order_id)
      .single(),
  ])

  if (!productRes.data) redirect('/pos/history')

  const product   = productRes.data
  const orderDate = orderRes.data?.created_at ?? new Date().toISOString()

  // perfume_size: dari size_ml variant, fallback ke customization_notes
  const perfumeSize: string = item.size_ml
    ? `${item.size_ml} ml`
    : (item.customization_notes ?? '')

  return (
    <LabelPrintClient
      perfumeName={product.name}
      perfumeSize={perfumeSize}
      perfumeType={product.concentration ?? 'EXTRAIT DE PARFUM'}
      printQty={Math.min(Math.max(1, parseInt(qtyParam ?? '1')), 20)}
      orderItemId={orderItemId}
      orderDate={orderDate}
    />
  )
}
