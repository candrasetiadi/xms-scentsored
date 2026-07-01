import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MANAGER_ROLES = ['owner', 'admin']

// GET /api/v1/commissions/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Returns:
//   total_sales       — total base_amount dari orders yang punya driver
//   total_driver_fee  — total komisi driver (accrued + paid)
//   total_agency_fee  — total komisi perusahaan (accrued + paid)
//   pending_driver    — komisi driver belum dibayar
//   pending_agency    — komisi perusahaan belum dibayar
//   top_drivers       — [{driver_id, driver_name, total_sales, total_fee}] top 5
//   top_agencies      — [{agency_id, agency_name, total_sales, total_fee}] top 5
//   agencies_with_advance — [{agency_id, agency_name, total_advance, total_paid_fee, balance}]

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !MANAGER_ROLES.includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  // Build driver_fees query with optional date filter
  let feesQuery = supabase
    .from('driver_fees')
    .select(`
      base_amount, fee_amount, status, agency_id, agency_fee_amount, agency_status,
      drivers!inner(id, name, travel_agency_id),
      travel_agencies(id, name)
    `)

  if (from) feesQuery = feesQuery.gte('accrued_at', from)
  if (to)   feesQuery = feesQuery.lte('accrued_at', to + 'T23:59:59')

  const { data: fees, error: feesErr } = await feesQuery
  if (feesErr) return NextResponse.json({ error: { code: 'DB_ERROR', message: feesErr.message } }, { status: 500 })

  // Aggregate totals
  let totalSales      = 0
  let totalDriverFee  = 0
  let totalAgencyFee  = 0
  let pendingDriver   = 0
  let pendingAgency   = 0

  const driverMap = new Map<string, { name: string; sales: number; fee: number }>()
  const agencyMap = new Map<string, { name: string; sales: number; fee: number }>()

  for (const f of fees ?? []) {
    const driver = f.drivers as unknown as { id: string; name: string }
    const agency = f.travel_agencies as unknown as { id: string; name: string } | null

    totalSales     += f.base_amount
    totalDriverFee += f.fee_amount
    if (f.status === 'accrued') pendingDriver += f.fee_amount

    // driver leaderboard
    const dm = driverMap.get(driver.id) ?? { name: driver.name, sales: 0, fee: 0 }
    dm.sales += f.base_amount
    dm.fee   += f.fee_amount
    driverMap.set(driver.id, dm)

    // agency aggregates
    if (f.agency_id && f.agency_fee_amount && agency) {
      totalAgencyFee += f.agency_fee_amount
      if (f.agency_status === 'accrued') pendingAgency += f.agency_fee_amount

      const am = agencyMap.get(f.agency_id) ?? { name: agency.name, sales: 0, fee: 0 }
      am.sales += f.base_amount
      am.fee   += f.agency_fee_amount
      agencyMap.set(f.agency_id, am)
    }
  }

  const topDrivers = [...driverMap.entries()]
    .sort((a, b) => b[1].sales - a[1].sales)
    .slice(0, 5)
    .map(([id, v]) => ({ driver_id: id, driver_name: v.name, total_sales: v.sales, total_fee: v.fee }))

  const topAgencies = [...agencyMap.entries()]
    .sort((a, b) => b[1].sales - a[1].sales)
    .slice(0, 5)
    .map(([id, v]) => ({ agency_id: id, agency_name: v.name, total_sales: v.sales, total_fee: v.fee }))

  // Advance fee balances — all agencies that ever appeared
  const agencyIds = [...agencyMap.keys()]
  let advanceRows: { travel_agency_id: string; amount: number }[] = []
  if (agencyIds.length > 0) {
    const { data: adv } = await supabase
      .from('agency_advance_fees')
      .select('travel_agency_id, amount')
      .in('travel_agency_id', agencyIds)
    advanceRows = adv ?? []
  }

  const advanceByAgency = new Map<string, number>()
  for (const a of advanceRows) {
    advanceByAgency.set(a.travel_agency_id, (advanceByAgency.get(a.travel_agency_id) ?? 0) + a.amount)
  }

  // Paid agency fees per agency (to compute saldo advance yang sudah "dikompensasi")
  const paidAgencyFeeByAgency = new Map<string, number>()
  for (const f of fees ?? []) {
    if (f.agency_id && f.agency_fee_amount && f.agency_status === 'paid') {
      paidAgencyFeeByAgency.set(f.agency_id, (paidAgencyFeeByAgency.get(f.agency_id) ?? 0) + f.agency_fee_amount)
    }
  }

  const agenciesWithAdvance = agencyIds
    .filter(id => advanceByAgency.has(id))
    .map(id => {
      const meta        = agencyMap.get(id)!
      const totalAdv    = advanceByAgency.get(id) ?? 0
      const totalPaid   = paidAgencyFeeByAgency.get(id) ?? 0
      return {
        agency_id:       id,
        agency_name:     meta.name,
        total_advance:   totalAdv,
        total_paid_fee:  totalPaid,
        balance:         totalAdv - totalPaid,
      }
    })

  return NextResponse.json({
    data: {
      total_sales:           totalSales,
      total_driver_fee:      totalDriverFee,
      total_agency_fee:      totalAgencyFee,
      pending_driver:        pendingDriver,
      pending_agency:        pendingAgency,
      top_drivers:           topDrivers,
      top_agencies:          topAgencies,
      agencies_with_advance: agenciesWithAdvance,
    },
  })
}
