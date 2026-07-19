import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MANAGER_ROLES = ['owner', 'admin'] as const

// GET /api/v1/orders/search?q=&branch_id=&limit=
// Cari order dengan status 'paid' berdasarkan nomor order.
// RBAC: owner/admin → semua cabang (atau filter branch_id opsional); role lain → cabang sendiri saja.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff')
    .select('id, role, branch_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()
  if (!staff) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q             = searchParams.get('q')?.trim() ?? ''
  const branchIdParam = searchParams.get('branch_id')?.trim() ?? null
  const limit         = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)

  if (q.length < 2) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'Parameter q minimal 2 karakter.' } },
      { status: 400 }
    )
  }

  if (branchIdParam != null && !UUID_RE.test(branchIdParam)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'branch_id harus UUID valid.' } },
      { status: 400 }
    )
  }

  const isManager = MANAGER_ROLES.includes(staff.role as typeof MANAGER_ROLES[number])

  // Tentukan branch scope efektif:
  // - Non-manager: selalu terikat ke cabang sendiri; tolak jika request branch lain
  // - Manager + branch_id param: filter ke branch tersebut
  // - Manager tanpa branch_id param: semua cabang (null = no filter)
  let effectiveBranchId: string | null

  if (!isManager) {
    if (branchIdParam != null && branchIdParam !== staff.branch_id) {
      return NextResponse.json({ error: { code: 'FORBIDDEN_BRANCH' } }, { status: 403 })
    }
    effectiveBranchId = staff.branch_id
  } else {
    effectiveBranchId = branchIdParam
  }

  // Ambil orders + JOIN branches (name). Tidak gunakan JOIN customer/driver agar tidak inflate rows.
  let ordersQuery = (supabase as any)
    .from('orders')
    .select('id, order_number, created_at, total, customer_id, driver_id, branch_id, branches!inner(name)')
    .eq('status', 'paid')
    .ilike('order_number', `%${q}%`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (effectiveBranchId) {
    ordersQuery = ordersQuery.eq('branch_id', effectiveBranchId)
  }

  const { data: orders, error: ordersErr } = await ordersQuery
  if (ordersErr) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: ordersErr.message } }, { status: 500 })
  }

  if (!orders || orders.length === 0) {
    return NextResponse.json({ data: [] })
  }

  const orderIds    = orders.map((o: any) => o.id as string)
  const customerIds = [...new Set(orders.map((o: any) => o.customer_id).filter(Boolean) as string[])]
  const driverIds   = [...new Set(orders.map((o: any) => o.driver_id).filter(Boolean) as string[])]

  // Fetch semua data pendukung secara paralel (items, customers, drivers, fees)
  const [itemsRes, customersRes, driversRes, driverFeesRes, companyFeesRes] = await Promise.all([
    supabase
      .from('order_items')
      .select('order_id, qty, line_total, product_id')
      .in('order_id', orderIds),

    customerIds.length
      ? supabase.from('customers').select('id, name').in('id', customerIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null }[], error: null }),

    driverIds.length
      ? supabase.from('drivers').select('id, name').in('id', driverIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),

    supabase
      .from('driver_fees')
      .select('order_id, fee_amount')
      .in('order_id', orderIds),

    (supabase as any)
      .from('company_fees')
      .select('order_id, fee_amount, driver_companies!inner(name)')
      .in('order_id', orderIds),
  ])

  if (itemsRes.error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: itemsRes.error.message } }, { status: 500 })
  }

  // Resolve product names
  const productIds = [...new Set((itemsRes.data ?? []).map((i: any) => i.product_id as string))]
  const { data: products } = productIds.length
    ? await supabase.from('products').select('id, name').in('id', productIds)
    : { data: [] as { id: string; name: string }[] }

  // Build lookup maps
  const customerMap = new Map((customersRes.data ?? []).map((c: any) => [c.id as string, c.name as string | null]))
  const driverMap   = new Map((driversRes.data ?? []).map((d: any) => [d.id as string, d.name as string]))
  const productMap  = new Map((products ?? []).map((p: any) => [p.id as string, p.name as string]))

  // items per order
  const itemsByOrder = new Map<string, { product_name: string; qty: number; line_total: number }[]>()
  for (const item of (itemsRes.data ?? []) as any[]) {
    const list = itemsByOrder.get(item.order_id) ?? []
    list.push({
      product_name: productMap.get(item.product_id) ?? '',
      qty:          item.qty as number,
      line_total:   item.line_total as number,
    })
    itemsByOrder.set(item.order_id, list)
  }

  // driver_fee per order (1 baris per order dari driver_fees)
  const driverFeeByOrder = new Map<string, number>()
  for (const df of (driverFeesRes.data ?? []) as any[]) {
    driverFeeByOrder.set(df.order_id as string, df.fee_amount as number)
  }

  // company_fee per order
  const companyFeeByOrder = new Map<string, { fee_amount: number; company_name: string }>()
  for (const cf of (companyFeesRes.data ?? []) as any[]) {
    companyFeeByOrder.set(cf.order_id as string, {
      fee_amount:   cf.fee_amount as number,
      company_name: (cf.driver_companies as any)?.name ?? '',
    })
  }

  const result = orders.map((o: any) => {
    const cf = companyFeeByOrder.get(o.id as string)

    return {
      id:            o.id as string,
      order_number:  o.order_number as string,
      created_at:    o.created_at as string,
      total:         o.total as number,
      customer_name: o.customer_id ? (customerMap.get(o.customer_id) ?? null) : null,
      branch_name:   (o.branches as any)?.name ?? '',
      driver_id:     o.driver_id as string | null,
      driver_name:   o.driver_id ? (driverMap.get(o.driver_id) ?? null) : null,
      driver_fee:    o.driver_id ? (driverFeeByOrder.get(o.id) ?? null) : null,
      company_name:  cf?.company_name ?? null,
      company_fee:   cf != null ? cf.fee_amount : null,
      items:         itemsByOrder.get(o.id) ?? [],
    }
  })

  return NextResponse.json({ data: result })
}
