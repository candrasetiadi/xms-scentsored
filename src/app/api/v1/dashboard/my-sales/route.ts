import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// GET /api/v1/dashboard/my-sales?from=YYYY-MM-DD&to=YYYY-MM-DD
// Data penjualan milik staff yang sedang login (filter by sales_staff_id).
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const today    = new Date().toISOString().slice(0, 10)
  const fromDate = searchParams.get('from') ?? today
  const toDate   = searchParams.get('to')   ?? today

  if (!DATE_RE.test(fromDate) || !DATE_RE.test(toDate))
    return NextResponse.json({ error: 'Format tanggal harus YYYY-MM-DD.' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  // Query orders milik staff ini yang sudah paid dalam rentang tanggal
  const { data: orders, error } = await db
    .from('orders')
    .select(`
      id, order_number, total, subtotal, discount, paid_at, created_at, status,
      customers(name, phone),
      order_items(id, qty, unit_price, products(name))
    `)
    .eq('sales_staff_id', staff.id)
    .eq('status', 'paid')
    .gte('paid_at', `${fromDate}T00:00:00.000Z`)
    .lte('paid_at', `${toDate}T23:59:59.999Z`)
    .order('paid_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = orders ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const total_revenue = rows.reduce((sum: number, o: any) => sum + (o.total ?? 0), 0)
  const total_orders  = rows.length
  const avg_order_value = total_orders > 0 ? total_revenue / total_orders : 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderList = rows.map((o: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customer = Array.isArray(o.customers) ? (o.customers as any[])[0] : o.customers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (o.order_items ?? []) as unknown as any[]
    return {
      id:            o.id,
      order_number:  o.order_number,
      total:         o.total,
      subtotal:      o.subtotal,
      discount:      o.discount,
      paid_at:       o.paid_at,
      customer_name: customer?.name  ?? null,
      customer_phone: customer?.phone ?? null,
      item_count:    items.length,
      items:         items.map(i => ({
        qty:        i.qty,
        unit_price: i.unit_price,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        product_name: (Array.isArray(i.products) ? (i.products as any[])[0] : i.products)?.name ?? '—',
      })),
    }
  })

  return NextResponse.json({
    data: {
      summary: { total_revenue, total_orders, avg_order_value },
      orders:  orderList,
    },
  })
}
