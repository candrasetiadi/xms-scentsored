import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface PayrollRunRow {
  id: string
  branch_id: string
  period_month: number
  period_year: number
  status: string
  branch: { name: string } | null
}

interface PayslipRow {
  id: string
  status: string
  gross: number
  total_allowances: number
  total_deductions: number
  overtime_amount: number
  tax_amount: number
  net: number
  components_snapshot: Record<string, unknown> | null
  staff: { id: string; name: string; role: string } | null
}

// GET /api/v1/hr/payroll/[id]/export
// Return all payslips for the run as a flat JSON array suitable for CSV/XLSX conversion.
// Manager only.
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

  // Verify run exists
  const { data: runRaw } = await supabase
    .from('payroll_runs')
    .select('id, branch_id, period_month, period_year, status, branch:branch_id (name)')
    .eq('id', id)
    .single()
  if (!runRaw) return NextResponse.json({ error: 'Payroll run tidak ditemukan.' }, { status: 404 })
  const run = runRaw as unknown as PayrollRunRow

  const { data: payslipsRaw, error } = await supabase
    .from('payslips')
    .select(`
      id, status, gross, total_allowances, total_deductions, overtime_amount,
      tax_amount, net, components_snapshot,
      staff:staff_id (id, name, role)
    `)
    .eq('payroll_run_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const payslips = (payslipsRaw ?? []) as unknown as PayslipRow[]

  // Flatten for export
  const rows = payslips.map((p) => ({
    payslip_id: p.id,
    payroll_run_id: id,
    period: `${run.period_year}-${String(run.period_month).padStart(2, '0')}`,
    branch_name: run.branch?.name ?? '',
    staff_id: p.staff?.id ?? '',
    staff_name: p.staff?.name ?? '',
    staff_role: p.staff?.role ?? '',
    gross: p.gross,
    total_allowances: p.total_allowances,
    total_deductions: p.total_deductions,
    overtime_amount: p.overtime_amount,
    tax_amount: p.tax_amount,
    net: p.net,
    status: p.status,
  }))

  return NextResponse.json({ data: rows })
}
