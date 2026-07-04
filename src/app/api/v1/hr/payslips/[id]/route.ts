import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// PATCH /api/v1/hr/payslips/[id]
// Update tax_amount and recalculate net. Manager only. Only when status=draft.
// Body: { tax_amount }
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

  const body = await request.json() as { tax_amount?: number }

  if (body.tax_amount == null || typeof body.tax_amount !== 'number' || !Number.isFinite(body.tax_amount) || body.tax_amount < 0)
    return NextResponse.json({ error: 'tax_amount wajib dan harus angka >= 0.' }, { status: 400 })

  type PayslipRow = {
    status: string; gross: number; total_allowances: number
    total_deductions: number; overtime_amount: number; sales_fee_amount: number
  }
  const { data: existing } = await supabase
    .from('payslips')
    .select('status, gross, total_allowances, total_deductions, overtime_amount, sales_fee_amount')
    .eq('id', id)
    .single() as unknown as { data: PayslipRow | null; error: unknown }

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status !== 'draft')
    return NextResponse.json({ error: 'Payslip hanya bisa diubah saat status draft.' }, { status: 400 })

  // net = gross + overtime_amount + sales_fee_amount - total_deductions - tax_amount
  // gross already includes basic + allowances — do NOT add total_allowances again
  const net =
    (existing.gross ?? 0) +
    (existing.overtime_amount ?? 0) +
    (existing.sales_fee_amount ?? 0) -
    (existing.total_deductions ?? 0) -
    body.tax_amount

  const { data, error } = await supabase
    .from('payslips')
    .update({ tax_amount: body.tax_amount, net })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}
