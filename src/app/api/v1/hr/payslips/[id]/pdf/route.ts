import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface PayslipDetail {
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
  payroll_run: {
    id: string
    period_month: number
    period_year: number
    status: string
    branch: { id: string; name: string } | null
  } | null
}

// GET /api/v1/hr/payslips/[id]/pdf
// Return structured JSON for rendering a payslip PDF (generation happens client-side).
// Manager can access any payslip; staff can only access their own.
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

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'id tidak valid.' }, { status: 400 })

  const { data: raw, error } = await supabase
    .from('payslips')
    .select(`
      id, status, gross, total_allowances, total_deductions, overtime_amount,
      tax_amount, net, components_snapshot,
      staff:staff_id (id, name, role),
      payroll_run:payroll_run_id (
        id, period_month, period_year, status,
        branch:branch_id (id, name)
      )
    `)
    .eq('id', id)
    .single()

  if (error || !raw) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const payslip = raw as unknown as PayslipDetail

  const isManager = ['owner', 'admin'].includes(staff.role)
  if (!isManager && payslip.staff?.id !== staff.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json({
    data: {
      payslip_id: payslip.id,
      status: payslip.status,
      gross: payslip.gross,
      total_allowances: payslip.total_allowances,
      total_deductions: payslip.total_deductions,
      overtime_amount: payslip.overtime_amount,
      tax_amount: payslip.tax_amount,
      net: payslip.net,
      components_snapshot: payslip.components_snapshot,
      staff: payslip.staff,
      period_month: payslip.payroll_run?.period_month ?? null,
      period_year: payslip.payroll_run?.period_year ?? null,
      branch_name: payslip.payroll_run?.branch?.name ?? null,
      branch_id: payslip.payroll_run?.branch?.id ?? null,
    }
  })
}
