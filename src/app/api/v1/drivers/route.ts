import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/v1/drivers — list drivers + total accrued fee belum dibayar
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { data: drivers, error } = await supabase
    .from('drivers')
    .select('id, name, phone, type, fee_type, fee_value, referral_code, active')
    .order('name')

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

  const result = (drivers ?? []).map(d => ({
    ...d,
    total_accrued: accruedByDriver[d.id] ?? 0,
  }))

  return NextResponse.json({ data: result })
}
