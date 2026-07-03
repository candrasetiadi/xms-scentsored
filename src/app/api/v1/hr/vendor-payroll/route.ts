import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const VALID_STATUSES = ['draft', 'finalized', 'paid'] as const
type RunStatus = typeof VALID_STATUSES[number]

// GET /api/v1/hr/vendor-payroll?branch_id=<uuid>&status=<status>
// List vendor payroll runs. Manager only.
// Owner tanpa branch_id → semua runs lintas cabang.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isManager = ['owner', 'admin'].includes(staff.role)
  if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const branchParam = searchParams.get('branch_id')
  const statusParam = searchParams.get('status')

  if (branchParam && !UUID_RE.test(branchParam))
    return NextResponse.json({ error: 'branch_id harus UUID valid.' }, { status: 400 })

  if (statusParam && !VALID_STATUSES.includes(statusParam as RunStatus))
    return NextResponse.json({ error: `status harus salah satu dari: ${VALID_STATUSES.join(', ')}.` }, { status: 400 })

  // Owner dengan branch_id null dan tanpa param → semua cabang
  const effectiveBranch = branchParam ?? (staff.role !== 'owner' ? staff.branch_id : null)

  let query = supabase
    .from('vendor_payroll_runs')
    .select('*, branch:branch_id(id, name)')
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })

  if (effectiveBranch) query = query.eq('branch_id', effectiveBranch)
  if (statusParam) query = query.eq('status', statusParam)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}

// POST /api/v1/hr/vendor-payroll
// Create vendor payroll run (status=draft). Manager only.
// Body: { branch_id, period_month, period_year }
export async function POST(request: Request) {
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
    period_month?: number
    period_year?: number
  }

  const branchId = body.branch_id ?? staff.branch_id
  if (!branchId || !UUID_RE.test(branchId))
    return NextResponse.json({ error: 'branch_id wajib dan harus UUID valid.' }, { status: 400 })

  if (!body.period_month || body.period_month < 1 || body.period_month > 12)
    return NextResponse.json({ error: 'period_month wajib (1-12).' }, { status: 400 })
  if (!body.period_year || body.period_year < 2000 || body.period_year > 2100)
    return NextResponse.json({ error: 'period_year wajib (2000-2100).' }, { status: 400 })

  const { data, error } = await supabase
    .from('vendor_payroll_runs')
    .insert({
      branch_id: branchId,
      period_month: body.period_month,
      period_year: body.period_year,
      status: 'draft',
      created_by: staff.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
