import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/v1/reports/stock?branch_id=
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin', 'stock_keeper'].includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branch_id') ?? staff.branch_id

  if (!branchId)
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'branch_id wajib.' } }, { status: 400 })

  const admin = createAdminClient()
  // v_stock_valuation is a view not in generated types, cast via any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('v_stock_valuation')
    .select('raw_material_id, name, unit, total_qty, total_value')
    .eq('branch_id', branchId)
    .order('total_value', { ascending: false }) as { data: import('@/types/database').StockValuationRow[] | null; error: unknown }

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: (error as { message: string }).message } }, { status: 500 })

  const totalValue = (data ?? []).reduce((s, r) => s + Number(r.total_value), 0)

  return NextResponse.json({ data: data ?? [], meta: { total_value: totalValue } })
}
