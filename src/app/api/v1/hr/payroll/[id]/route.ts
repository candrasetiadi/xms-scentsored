import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// PATCH /api/v1/hr/payroll/[id]
// Update payroll run status to paid. Owner only.
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (staff.role !== 'owner')
    return NextResponse.json({ error: 'Forbidden — hanya owner yang bisa menandai payroll sebagai paid.' }, { status: 403 })

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'id tidak valid.' }, { status: 400 })

  const { data: existing } = await supabase
    .from('payroll_runs').select('status').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status !== 'finalized')
    return NextResponse.json({ error: 'Payroll run harus berstatus finalized sebelum bisa dibayar.' }, { status: 400 })

  const { data, error } = await supabase
    .from('payroll_runs')
    .update({ status: 'paid' })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}
