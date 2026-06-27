import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST /api/v1/driver-payouts — buat payout periode, tandai fee accrued → paid
// Role: owner
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || staff.role !== 'owner') {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Hanya owner.' } }, { status: 403 })
  }

  const body = await request.json() as {
    driver_id: string
    period_start: string  // YYYY-MM-DD
    period_end:   string
  }

  if (!body.driver_id || !body.period_start || !body.period_end) {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'driver_id, period_start, period_end wajib.' } }, { status: 400 })
  }

  const admin = createAdminClient()

  // Hitung total fee accrued dalam periode
  const { data: fees, error: feesErr } = await admin
    .from('driver_fees')
    .select('id, fee_amount')
    .eq('driver_id', body.driver_id)
    .eq('status', 'accrued')
    .gte('accrued_at', `${body.period_start}T00:00:00Z`)
    .lte('accrued_at', `${body.period_end}T23:59:59Z`)

  if (feesErr) return NextResponse.json({ error: { code: 'DB_ERROR', message: feesErr.message } }, { status: 500 })
  if (!fees?.length) {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Tidak ada fee accrued dalam periode ini.' } }, { status: 400 })
  }

  const total = fees.reduce((s, f) => s + f.fee_amount, 0)
  const feeIds = fees.map(f => f.id)

  // Buat payout
  const { data: payout, error: payoutErr } = await admin
    .from('driver_payouts')
    .insert({
      driver_id:    body.driver_id,
      period_start: body.period_start,
      period_end:   body.period_end,
      total,
      status:       'pending',
    })
    .select()
    .single()

  if (payoutErr) return NextResponse.json({ error: { code: 'DB_ERROR', message: payoutErr.message } }, { status: 500 })

  // Tandai fee → paid + link ke payout
  const { error: updateErr } = await admin
    .from('driver_fees')
    .update({ status: 'paid', payout_id: payout.id })
    .in('id', feeIds)

  if (updateErr) return NextResponse.json({ error: { code: 'DB_ERROR', message: updateErr.message } }, { status: 500 })

  return NextResponse.json({ data: { ...payout, fee_count: feeIds.length } }, { status: 201 })
}

// GET /api/v1/driver-payouts?driver_id=&status=
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role)) {
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const driverId = searchParams.get('driver_id')
  const status   = searchParams.get('status')

  let query = supabase
    .from('driver_payouts')
    .select('id, driver_id, period_start, period_end, total, status, paid_at, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (driverId) query = query.eq('driver_id', driverId)
  if (status)   query = query.eq('status', status)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  return NextResponse.json({ data, meta: { total: count ?? 0 } })
}
