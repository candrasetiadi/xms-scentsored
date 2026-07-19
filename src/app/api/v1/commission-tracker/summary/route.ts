import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MANAGER_ROLES = ['owner', 'admin']

// GET /api/v1/commission-tracker/summary
// Query params: from (YYYY-MM-DD), to (YYYY-MM-DD) — keduanya opsional
// Owner/admin only
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await (supabase as any).from('staff').select('role, can_access_commission').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || (!MANAGER_ROLES.includes(staff.role) && !(staff as any).can_access_commission))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  // --- Fetch all commission_transactions (with date filter) ---
  let txQuery = (supabase as any)
    .from('commission_transactions')
    .select('sale_amount, driver_fee_amount, company_fee_amount, status, driver_id, company_id')

  if (from) txQuery = txQuery.gte('tx_date', from)
  if (to)   txQuery = txQuery.lte('tx_date', to)

  const { data: txRows, error: txErr } = await txQuery
  if (txErr) return NextResponse.json({ error: { code: 'DB_ERROR', message: txErr.message } }, { status: 500 })

  const rows: {
    sale_amount: number
    driver_fee_amount: number
    company_fee_amount: number
    status: string
    driver_id: string
    company_id: string | null
  }[] = txRows ?? []

  // Aggregate totals
  let totalSales       = 0
  let totalDriverFee   = 0
  let totalCompanyFee  = 0
  let pendingDriver    = 0
  let pendingCompany   = 0
  const txCount        = rows.length

  const driverAgg  = new Map<string, { total_sales: number; total_fee: number }>()
  const companyAgg = new Map<string, { total_sales: number; total_fee: number }>()

  for (const r of rows) {
    totalSales      += r.sale_amount ?? 0
    totalDriverFee  += r.driver_fee_amount ?? 0
    totalCompanyFee += r.company_fee_amount ?? 0
    if (r.status === 'pending') {
      pendingDriver  += r.driver_fee_amount ?? 0
      pendingCompany += r.company_fee_amount ?? 0
    }

    // Per-driver aggregation
    if (r.driver_id) {
      const prev = driverAgg.get(r.driver_id) ?? { total_sales: 0, total_fee: 0 }
      driverAgg.set(r.driver_id, {
        total_sales: prev.total_sales + (r.sale_amount ?? 0),
        total_fee:   prev.total_fee + (r.driver_fee_amount ?? 0),
      })
    }

    // Per-company aggregation
    if (r.company_id) {
      const prev = companyAgg.get(r.company_id) ?? { total_sales: 0, total_fee: 0 }
      companyAgg.set(r.company_id, {
        total_sales: prev.total_sales + (r.sale_amount ?? 0),
        total_fee:   prev.total_fee + (r.company_fee_amount ?? 0),
      })
    }
  }

  // Fetch driver names for top 5
  const topDriverIds = [...driverAgg.entries()]
    .sort((a, b) => b[1].total_fee - a[1].total_fee)
    .slice(0, 5)
    .map(([id]) => id)

  const topCompanyIds = [...companyAgg.entries()]
    .sort((a, b) => b[1].total_fee - a[1].total_fee)
    .slice(0, 5)
    .map(([id]) => id)

  const [driversRes, companiesRes] = await Promise.all([
    topDriverIds.length
      ? supabase.from('drivers').select('id, name').in('id', topDriverIds)
      : { data: [] },
    topCompanyIds.length
      ? (supabase as any).from('driver_companies').select('id, name').in('id', topCompanyIds)
      : { data: [] },
  ])

  const driverNameMap  = new Map<string, string>((driversRes.data ?? []).map((d: { id: string; name: string }) => [d.id, d.name]))
  const companyNameMap = new Map<string, string>((companiesRes.data ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))

  const topDrivers = topDriverIds.map(id => ({
    driver_id:   id,
    driver_name: driverNameMap.get(id) ?? null,
    ...driverAgg.get(id)!,
  }))

  const topCompanies = topCompanyIds.map(id => ({
    company_id:   id,
    company_name: companyNameMap.get(id) ?? null,
    ...companyAgg.get(id)!,
  }))

  // --- Advance fee balances (date-filtered: same window as transactions) ---
  let advanceQuery = (supabase as any)
    .from('company_advance_fees')
    .select('company_id, amount')
  if (from) advanceQuery = advanceQuery.gte('given_at', from)
  if (to)   advanceQuery = advanceQuery.lte('given_at', to)

  let txFeeQuery = (supabase as any)
    .from('commission_transactions')
    .select('company_id, company_fee_amount')
    .not('company_id', 'is', null)
  if (from) txFeeQuery = txFeeQuery.gte('tx_date', from)
  if (to)   txFeeQuery = txFeeQuery.lte('tx_date', to)

  const [advanceRes, allTxFeeRes] = await Promise.all([advanceQuery, txFeeQuery])

  const advanceByCompany = new Map<string, number>()
  for (const row of (advanceRes.data ?? [])) {
    advanceByCompany.set(row.company_id, (advanceByCompany.get(row.company_id) ?? 0) + (row.amount ?? 0))
  }

  const usedFeeByCompany = new Map<string, number>()
  for (const row of (allTxFeeRes.data ?? [])) {
    if (row.company_id) {
      usedFeeByCompany.set(row.company_id, (usedFeeByCompany.get(row.company_id) ?? 0) + (row.company_fee_amount ?? 0))
    }
  }

  // Collect all company_ids that have any advance or fee
  const allCompanyIds = new Set<string>([
    ...advanceByCompany.keys(),
    ...usedFeeByCompany.keys(),
  ])

  let advanceCompanyNames: { id: string; name: string }[] = []
  if (allCompanyIds.size > 0) {
    const { data: cNames } = await (supabase as any)
      .from('driver_companies')
      .select('id, name')
      .in('id', [...allCompanyIds])
    advanceCompanyNames = cNames ?? []
  }

  const advanceCompanyNameMap = new Map<string, string>(advanceCompanyNames.map((c: { id: string; name: string }) => [c.id, c.name]))

  const advance_fee_balances = [...allCompanyIds].map(company_id => {
    const total_advance  = advanceByCompany.get(company_id) ?? 0
    const total_used_fee = usedFeeByCompany.get(company_id) ?? 0
    return {
      company_id,
      company_name: advanceCompanyNameMap.get(company_id) ?? null,
      total_advance,
      total_used_fee,
      balance: total_advance - total_used_fee,
    }
  })

  return NextResponse.json({
    data: {
      total_sales:      totalSales,
      total_driver_fee: totalDriverFee,
      total_company_fee: totalCompanyFee,
      pending_driver:   pendingDriver,
      pending_company:  pendingCompany,
      tx_count:         txCount,
      top_drivers:      topDrivers,
      top_companies:    topCompanies,
      advance_fee_balances,
    }
  })
}
