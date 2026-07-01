import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MANAGER_ROLES = ['owner', 'admin']

// GET /api/v1/commissions/transactions
// Query params: driver_id, agency_id, status (accrued|paid), from, to, limit, offset
// Returns driver_fees rows enriched with order date + driver + agency info
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !MANAGER_ROLES.includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const driverId = searchParams.get('driver_id')
  const agencyId = searchParams.get('agency_id')
  const status   = searchParams.get('status')
  const from     = searchParams.get('from')
  const to       = searchParams.get('to')
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const offset   = parseInt(searchParams.get('offset') ?? '0')

  let query = supabase
    .from('driver_fees')
    .select(`
      id, base_amount, fee_amount, fee_scheme_snapshot, status, payout_id,
      agency_id, agency_fee_amount, agency_fee_snapshot, agency_status, agency_payout_id,
      accrued_at,
      drivers!inner(id, name, phone, type),
      travel_agencies(id, name),
      orders!inner(id, order_number, paid_at, branch_id, branches(name))
    `, { count: 'exact' })
    .order('accrued_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (driverId) query = query.eq('driver_id', driverId)
  if (agencyId) query = query.eq('agency_id', agencyId)
  if (status && (status === 'accrued' || status === 'paid'))
    query = query.eq('status', status)
  if (from)     query = query.gte('accrued_at', from)
  if (to)       query = query.lte('accrued_at', to + 'T23:59:59')

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  return NextResponse.json({ data, meta: { total: count ?? 0, limit, offset } })
}
