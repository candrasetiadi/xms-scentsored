import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/v1/drivers/:id/fees?from=&to=&status=&limit=&offset=
// M7 — ledger fee driver. Role: owner/admin.

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role)) {
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })
  }

  const { id: driverId } = await params
  const { searchParams } = new URL(request.url)
  const from   = searchParams.get('from')
  const to     = searchParams.get('to')
  const status = searchParams.get('status')
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '25'), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  let query = supabase
    .from('driver_fees')
    .select('id, order_id, base_amount, fee_amount, fee_scheme_snapshot, status, payout_id, accrued_at', { count: 'exact' })
    .eq('driver_id', driverId)
    .order('accrued_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)
  if (from)   query = query.gte('accrued_at', from)
  if (to)     query = query.lte('accrued_at', to)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  // Summary: total accrued belum dibayar
  const { data: summary } = await supabase
    .from('driver_fees')
    .select('fee_amount')
    .eq('driver_id', driverId)
    .eq('status', 'accrued')

  const totalAccrued = (summary ?? []).reduce((s, r) => s + r.fee_amount, 0)

  return NextResponse.json({ data, meta: { total: count ?? 0, limit, offset, total_accrued: totalAccrued } })
}
