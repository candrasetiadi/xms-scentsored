import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST /api/v1/drivers — create driver baru (untuk auto-create dari commission tracker)
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await (supabase as any)
    .from('staff').select('role, can_access_commission').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || (!['owner', 'admin'].includes(staff.role) && !(staff as any).can_access_commission))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  let body: { name: string; fee_value?: number; fee_type?: string; company_id?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Body tidak valid.' } }, { status: 400 })
  }

  if (!body.name?.trim())
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'name wajib.' } }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await (admin as any)
    .from('drivers')
    .insert({
      name:       body.name.trim(),
      type:       'travel_driver',
      fee_value:  body.fee_value ?? 15,
      fee_type:   body.fee_type ?? 'percentage',
      company_id: body.company_id ?? null,
      active:     true,
    })
    .select('id, name, fee_value, fee_type, active, company_id')
    .single()

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

// GET /api/v1/drivers?active_only=true — list drivers + company + total accrued fee belum dibayar
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await (supabase as any)
    .from('staff').select('role, can_access_commission').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || (!['owner', 'admin'].includes(staff.role) && !(staff as any).can_access_commission))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const activeOnly = searchParams.get('active_only') !== 'false'

  // JOIN ke driver_companies untuk ambil company_name sekaligus
  let driversQuery = (supabase as any)
    .from('drivers')
    .select('id, name, phone, type, fee_type, fee_value, referral_code, active, company_id, driver_companies(name)')
    .order('name')

  if (activeOnly) {
    driversQuery = driversQuery.eq('active', true)
  }

  const { data: drivers, error } = await driversQuery
  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  // Fee accrued per driver (semua, tanpa filter tanggal)
  const { data: fees } = await supabase
    .from('driver_fees')
    .select('driver_id, fee_amount')
    .eq('status', 'accrued')

  const accruedByDriver: Record<string, number> = {}
  for (const f of fees ?? []) {
    accruedByDriver[f.driver_id] = (accruedByDriver[f.driver_id] ?? 0) + f.fee_amount
  }

  const result = (drivers ?? []).map((d: any) => ({
    id:            d.id,
    name:          d.name,
    phone:         d.phone,
    type:          d.type,
    fee_type:      d.fee_type,
    fee_value:     d.fee_value,
    referral_code: d.referral_code,
    active:        d.active,
    company_id:    d.company_id ?? null,
    company_name:  (d.driver_companies as any)?.name ?? null,
    total_accrued: accruedByDriver[d.id] ?? 0,
  }))

  return NextResponse.json({ data: result })
}
