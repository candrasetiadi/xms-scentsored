import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const VALID_TYPES   = ['toko', 'bahan', 'vendor'] as const
const VALID_METHODS = [
  'Rekening Gina', 'Rekening Dessy', 'Rekening Alina', 'Rekening Kevin',
  'BCA PT Scentsored', 'Mandiri PT Scentsored', 'Cash',
] as const

// GET /api/v1/finance/expenses?branch_id=&type=&from=&to=
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const sp       = new URL(request.url).searchParams
  const branchId = sp.get('branch_id')
  const type     = sp.get('type')
  const from     = sp.get('from')
  const to       = sp.get('to')

  if (!branchId) return NextResponse.json({ error: { code: 'MISSING_BRANCH' } }, { status: 400 })

  let q = (supabase as any)
    .from('finance_expenses')
    .select('*')
    .eq('branch_id', branchId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (type) q = q.eq('type', type)
  if (from) q = q.gte('date', from)
  if (to)   q = q.lte('date', to)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}

// POST /api/v1/finance/expenses
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await (supabase as any)
    .from('staff').select('id, role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const body = await request.json()
  const { branch_id, date, type, amount, method, cat, who, note } = body

  if (!branch_id || !date || !type || !amount || !method)
    return NextResponse.json({ error: { code: 'MISSING_FIELDS' } }, { status: 400 })

  if (!VALID_TYPES.includes(type))
    return NextResponse.json({ error: { code: 'INVALID_TYPE' } }, { status: 400 })

  if (!VALID_METHODS.includes(method))
    return NextResponse.json({ error: { code: 'INVALID_METHOD' } }, { status: 400 })

  const { data, error } = await (supabase as any)
    .from('finance_expenses')
    .insert({
      branch_id, date, type, amount: +amount, method,
      cat: cat || null, who: who || null, note: note || null,
      created_by: staff.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
