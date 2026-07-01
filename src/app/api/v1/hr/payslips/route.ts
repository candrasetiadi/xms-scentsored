import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/v1/hr/payslips?payroll_run_id=&staff_id=
// Manager sees any run; staff sees only their own payslips.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const payrollRunId = searchParams.get('payroll_run_id')
  const staffIdParam = searchParams.get('staff_id')

  if (payrollRunId && !UUID_RE.test(payrollRunId))
    return NextResponse.json({ error: 'payroll_run_id harus UUID valid.' }, { status: 400 })
  if (staffIdParam && !UUID_RE.test(staffIdParam))
    return NextResponse.json({ error: 'staff_id harus UUID valid.' }, { status: 400 })

  const isManager = ['owner', 'admin'].includes(staff.role)

  let query = supabase
    .from('payslips')
    .select(`
      id, status, gross, total_allowances, total_deductions, overtime_amount,
      tax_amount, net, components_snapshot,
      payroll_run:payroll_run_id (id, period_month, period_year, status),
      staff:staff_id (id, name, role)
    `)
    .order('created_at', { ascending: false })

  if (!isManager) {
    // Staff always sees only their own
    query = query.eq('staff_id', staff.id)
  } else if (staffIdParam) {
    query = query.eq('staff_id', staffIdParam)
  }

  if (payrollRunId) query = query.eq('payroll_run_id', payrollRunId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}
