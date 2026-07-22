import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/v1/finance/income?branch_id=&from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const sp        = new URL(request.url).searchParams
  const branchId  = sp.get('branch_id')
  const from      = sp.get('from')
  const to        = sp.get('to')

  if (!branchId) return NextResponse.json({ error: { code: 'MISSING_BRANCH' } }, { status: 400 })

  let q = (supabase as any)
    .from('finance_income')
    .select('*')
    .eq('branch_id', branchId)
    .order('date', { ascending: false })

  if (from) q = q.gte('date', from)
  if (to)   q = q.lte('date', to)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}

// POST /api/v1/finance/income — upsert by (branch_id, date)
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await (supabase as any)
    .from('staff').select('id, role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const body = await request.json()
  const { branch_id, date, gopay = 0, bca = 0, mandiri = 0, cash = 0, note } = body

  if (!branch_id || !date)
    return NextResponse.json({ error: { code: 'MISSING_FIELDS' } }, { status: 400 })

  const { data, error } = await (supabase as any)
    .from('finance_income')
    .upsert(
      { branch_id, date, gopay, bca, mandiri, cash, note: note || null, created_by: staff.id, updated_at: new Date().toISOString() },
      { onConflict: 'branch_id,date' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 })

  return NextResponse.json({ data })
}
