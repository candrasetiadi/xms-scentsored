import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MANAGER_ROLES = ['owner', 'admin']

// GET /api/v1/commission-tracker/recap
// Query params: type ('driver' | 'company'), from (YYYY-MM-DD), to (YYYY-MM-DD)
// Owner/admin only
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await (supabase as any).from('staff').select('role, can_access_commission').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || (!MANAGER_ROLES.includes(staff.role) && !(staff as any).can_access_commission))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  if (type !== 'driver' && type !== 'company')
    return NextResponse.json({ error: { code: 'VALIDATION', message: "type harus 'driver' atau 'company'." } }, { status: 400 })

  // Fetch all commission_transactions with date filter
  let txQuery = (supabase as any)
    .from('commission_transactions')
    .select('driver_id, company_id, sale_amount, driver_fee_amount, company_fee_amount, status')

  if (from) txQuery = txQuery.gte('tx_date', from)
  if (to)   txQuery = txQuery.lte('tx_date', to)

  const { data: txRows, error: txErr } = await txQuery
  if (txErr) return NextResponse.json({ error: { code: 'DB_ERROR', message: txErr.message } }, { status: 500 })

  const rows: {
    driver_id: string
    company_id: string | null
    sale_amount: number
    driver_fee_amount: number
    company_fee_amount: number
    status: string
  }[] = txRows ?? []

  if (type === 'driver') {
    // Aggregate per driver
    const agg = new Map<string, {
      tx_count: number
      total_sales: number
      total_driver_fee: number
      pending_fee: number
      paid_fee: number
    }>()

    for (const r of rows) {
      if (!r.driver_id) continue
      const prev = agg.get(r.driver_id) ?? {
        tx_count: 0, total_sales: 0, total_driver_fee: 0, pending_fee: 0, paid_fee: 0
      }
      const isPending = r.status === 'pending'
      agg.set(r.driver_id, {
        tx_count:         prev.tx_count + 1,
        total_sales:      prev.total_sales + (r.sale_amount ?? 0),
        total_driver_fee: prev.total_driver_fee + (r.driver_fee_amount ?? 0),
        pending_fee:      prev.pending_fee + (isPending ? (r.driver_fee_amount ?? 0) : 0),
        paid_fee:         prev.paid_fee + (!isPending ? (r.driver_fee_amount ?? 0) : 0),
      })
    }

    // Fetch driver names
    const driverIds = [...agg.keys()]
    const { data: driversData } = driverIds.length
      ? await supabase.from('drivers').select('id, name').in('id', driverIds)
      : { data: [] }

    const driverNameMap = new Map<string, string>(
      (driversData ?? []).map((d: { id: string; name: string }) => [d.id, d.name])
    )

    const items = [...agg.entries()]
      .map(([driver_id, stats]) => ({
        driver_id,
        driver_name: driverNameMap.get(driver_id) ?? null,
        ...stats,
      }))
      .sort((a, b) => b.total_driver_fee - a.total_driver_fee)

    return NextResponse.json({ data: { items } })
  }

  // type === 'company'
  const agg = new Map<string, {
    tx_count: number
    total_sales: number
    total_company_fee: number
    pending_fee: number
    paid_fee: number
  }>()

  for (const r of rows) {
    if (!r.company_id) continue
    const prev = agg.get(r.company_id) ?? {
      tx_count: 0, total_sales: 0, total_company_fee: 0, pending_fee: 0, paid_fee: 0
    }
    const isPending = r.status === 'pending'
    agg.set(r.company_id, {
      tx_count:          prev.tx_count + 1,
      total_sales:       prev.total_sales + (r.sale_amount ?? 0),
      total_company_fee: prev.total_company_fee + (r.company_fee_amount ?? 0),
      pending_fee:       prev.pending_fee + (isPending ? (r.company_fee_amount ?? 0) : 0),
      paid_fee:          prev.paid_fee + (!isPending ? (r.company_fee_amount ?? 0) : 0),
    })
  }

  // Fetch company names
  const companyIds = [...agg.keys()]
  const { data: companiesData } = companyIds.length
    ? await (supabase as any).from('driver_companies').select('id, name').in('id', companyIds)
    : { data: [] }

  const companyNameMap = new Map<string, string>(
    (companiesData ?? []).map((c: { id: string; name: string }) => [c.id, c.name])
  )

  const items = [...agg.entries()]
    .map(([company_id, stats]) => ({
      company_id,
      company_name: companyNameMap.get(company_id) ?? null,
      ...stats,
    }))
    .sort((a, b) => b.total_company_fee - a.total_company_fee)

  return NextResponse.json({ data: { items } })
}
