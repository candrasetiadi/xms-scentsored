import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const VALID_REKENINGS = ['BCA PT Scentsored', 'Mandiri PT Scentsored'] as const
const VALID_JENIS     = ['kredit', 'debit', 'saldo'] as const

// GET /api/v1/finance/bank-statements?branch_id=&rekening=&from=&to=
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const sp        = new URL(request.url).searchParams
  const branchId  = sp.get('branch_id')
  const rekening  = sp.get('rekening')
  const from      = sp.get('from')
  const to        = sp.get('to')

  if (!branchId) return NextResponse.json({ error: { code: 'MISSING_BRANCH' } }, { status: 400 })

  let q = (supabase as any)
    .from('finance_bank_statements')
    .select('*')
    .eq('branch_id', branchId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (rekening) q = q.eq('rekening', rekening)
  if (from)     q = q.gte('date', from)
  if (to)       q = q.lte('date', to)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}

// POST /api/v1/finance/bank-statements — single row
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await (supabase as any)
    .from('staff').select('id, role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const body = await request.json()
  const { branch_id, rekening, date, jenis, nominal, keterangan } = body

  if (!branch_id || !rekening || !date || !jenis || nominal == null)
    return NextResponse.json({ error: { code: 'MISSING_FIELDS' } }, { status: 400 })

  if (!VALID_REKENINGS.includes(rekening))
    return NextResponse.json({ error: { code: 'INVALID_REKENING' } }, { status: 400 })

  if (!VALID_JENIS.includes(jenis))
    return NextResponse.json({ error: { code: 'INVALID_JENIS' } }, { status: 400 })

  const { data, error } = await (supabase as any)
    .from('finance_bank_statements')
    .insert({ branch_id, rekening, date, jenis, nominal: +nominal, keterangan: keterangan || null, created_by: staff.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
