import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST /api/v1/orders/assign-driver
// Assign driver ke satu atau lebih order sekaligus. Hanya owner/admin.
// Delegasi ke Postgres function assign_driver_to_orders yang menangani:
//   - validasi order status = 'paid'
//   - update orders.driver_id
//   - upsert driver_fees + company_fees
//   - snapshot fee_scheme
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff')
    .select('role')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()
  if (!staff) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  if (!['owner', 'admin'].includes(staff.role)) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Hanya owner/admin yang dapat assign driver.' } }, { status: 403 })
  }

  let body: { order_ids?: unknown; driver_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Body request tidak valid JSON.' } }, { status: 400 })
  }

  // Validasi order_ids
  if (!Array.isArray(body.order_ids) || body.order_ids.length === 0) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'order_ids wajib berupa array minimal 1 elemen.' } },
      { status: 400 }
    )
  }

  const orderIds = body.order_ids as unknown[]
  const invalidId = orderIds.find((id) => typeof id !== 'string' || !UUID_RE.test(id))
  if (invalidId !== undefined) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: `order_ids berisi nilai bukan UUID valid: ${String(invalidId)}` } },
      { status: 400 }
    )
  }

  // Validasi driver_id
  if (typeof body.driver_id !== 'string' || !UUID_RE.test(body.driver_id)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'driver_id wajib dan harus UUID valid.' } },
      { status: 400 }
    )
  }

  const { data, error } = await (supabase as any).rpc('assign_driver_to_orders', {
    p_order_ids: orderIds as string[],
    p_driver_id: body.driver_id,
  })

  if (error) {
    // Pesan error dari DB function (mis. order bukan paid, driver tidak aktif) diteruskan ke client
    return NextResponse.json(
      { error: { code: 'ASSIGN_ERROR', message: error.message } },
      { status: 400 }
    )
  }

  return NextResponse.json({
    data: {
      updated_count:    (data as any).updated_count    as number,
      total_driver_fee: (data as any).total_driver_fee as number,
      total_company_fee:(data as any).total_company_fee as number,
    }
  })
}
