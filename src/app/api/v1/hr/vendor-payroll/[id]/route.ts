import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/v1/hr/vendor-payroll/[id]
// Detail run + vendor_payslips dengan vendor info. Manager only.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isManager = ['owner', 'admin'].includes(staff.role)
  if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'id tidak valid.' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data, error } = await db
    .from('vendor_payroll_runs')
    .select(`
      *,
      branch:branch_id(id, name),
      vendor_payslips(*, vendors(name, phone))
    `)
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data })
}

// PATCH /api/v1/hr/vendor-payroll/[id]
// Update status run. Manager only.
// - status 'finalized': memanggil RPC finalize_vendor_payroll_run
// - status 'paid': hanya diperbolehkan jika run sudah finalized
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isManager = ['owner', 'admin'].includes(staff.role)
  if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'id tidak valid.' }, { status: 400 })

  const body = await request.json() as { status?: string }

  if (!body.status || !['finalized', 'paid'].includes(body.status))
    return NextResponse.json({ error: "status harus 'finalized' atau 'paid'." }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: existing } = await db
    .from('vendor_payroll_runs').select('id, status').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (body.status === 'finalized') {
    const { error: rpcErr } = await db.rpc('finalize_vendor_payroll_run', { p_run_id: id })
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 })

    const { data: updated, error: fetchErr } = await db
      .from('vendor_payroll_runs').select('*').eq('id', id).single()
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    return NextResponse.json({ data: updated })
  }

  // status === 'paid'
  if (existing.status !== 'finalized')
    return NextResponse.json({ error: 'Run harus berstatus finalized sebelum bisa dibayar.' }, { status: 400 })

  const { data, error } = await db
    .from('vendor_payroll_runs')
    .update({ status: 'paid' })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}
