import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST /api/v1/hr/payroll/[id]/generate
// Generate payslips for the payroll run. Manager only. Run must be in draft status.
// Calls RPC generate_payslips.
export async function POST(
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

  const { data: run } = await supabase
    .from('payroll_runs').select('id, status').eq('id', id).single()
  if (!run) return NextResponse.json({ error: 'Payroll run tidak ditemukan.' }, { status: 404 })
  if (run.status !== 'draft')
    return NextResponse.json({ error: 'generate hanya bisa dilakukan saat status draft.' }, { status: 400 })

  const { error } = await supabase.rpc('generate_payslips', {
    p_payroll_run_id: id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: { id, action: 'generate_payslips' } })
}
