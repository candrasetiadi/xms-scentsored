import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/v1/hr/settings?branch_id=<uuid>
// Returns hr_settings for the branch. Falls back to defaults if not set.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branch_id') ?? staff.branch_id

  if (!branchId || !UUID_RE.test(branchId))
    return NextResponse.json({ error: 'branch_id wajib dan harus UUID valid.' }, { status: 400 })

  const { data, error } = await supabase
    .from('hr_settings')
    .select('*')
    .eq('branch_id', branchId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data: data ?? {
      branch_id: branchId,
      late_tolerance_minutes: 15,
      overtime_rate_per_hour: 25000,
      vendor_fee_per_tx: 500,
    }
  })
}

// PUT /api/v1/hr/settings
// Upsert hr_settings. Manager only.
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isManager = ['owner', 'admin'].includes(staff.role)
  if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as {
    branch_id?: string
    late_tolerance_minutes?: number
    overtime_rate_per_hour?: number
    vendor_fee_per_tx?: number
  }

  const branchId = body.branch_id ?? staff.branch_id
  if (!branchId || !UUID_RE.test(branchId))
    return NextResponse.json({ error: 'branch_id wajib dan harus UUID valid.' }, { status: 400 })

  if (body.late_tolerance_minutes != null && (typeof body.late_tolerance_minutes !== 'number' || body.late_tolerance_minutes < 0))
    return NextResponse.json({ error: 'late_tolerance_minutes harus angka >= 0.' }, { status: 400 })

  if (body.overtime_rate_per_hour != null && (typeof body.overtime_rate_per_hour !== 'number' || body.overtime_rate_per_hour < 0))
    return NextResponse.json({ error: 'overtime_rate_per_hour harus angka >= 0.' }, { status: 400 })

  if (body.vendor_fee_per_tx != null && (typeof body.vendor_fee_per_tx !== 'number' || !Number.isInteger(body.vendor_fee_per_tx) || body.vendor_fee_per_tx < 0))
    return NextResponse.json({ error: 'vendor_fee_per_tx harus integer >= 0.' }, { status: 400 })

  const { data, error } = await supabase
    .from('hr_settings')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(
      {
        branch_id: branchId,
        ...(body.late_tolerance_minutes != null ? { late_tolerance_minutes: body.late_tolerance_minutes } : {}),
        ...(body.overtime_rate_per_hour != null ? { overtime_rate_per_hour: body.overtime_rate_per_hour } : {}),
        ...(body.vendor_fee_per_tx != null ? { vendor_fee_per_tx: body.vendor_fee_per_tx } : {}),
      } as any,
      { onConflict: 'branch_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}
