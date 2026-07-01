import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const MANAGER_ROLES = ['owner', 'admin']

// POST /api/v1/agency-payouts — buat payout komisi perusahaan
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !MANAGER_ROLES.includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  let body: { travel_agency_id: string; period_start: string; period_end: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Body tidak valid.' } }, { status: 400 })
  }

  if (!body.travel_agency_id || !body.period_start || !body.period_end)
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'travel_agency_id, period_start, period_end wajib.' } }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('create_agency_payout', {
    p_travel_agency_id: body.travel_agency_id,
    p_period_start:     body.period_start,
    p_period_end:       body.period_end,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('Tidak ada'))
      return NextResponse.json({ error: { code: 'VALIDATION', message: msg } }, { status: 400 })
    return NextResponse.json({ error: { code: 'DB_ERROR', message: msg } }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}

// GET /api/v1/agency-payouts?travel_agency_id=&status=
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !MANAGER_ROLES.includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const agencyId = searchParams.get('travel_agency_id')
  const status   = searchParams.get('status')

  let query = supabase
    .from('agency_payouts')
    .select('*, travel_agencies(name)', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (agencyId) query = query.eq('travel_agency_id', agencyId)
  if (status)   query = query.eq('status', status as 'pending' | 'paid')

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  return NextResponse.json({ data, meta: { total: count ?? 0 } })
}
