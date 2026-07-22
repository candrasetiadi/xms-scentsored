import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const VALID_METHODS = [
  'Rekening Gina', 'Rekening Dessy', 'Rekening Alina', 'Rekening Kevin',
  'BCA PT Scentsored', 'Mandiri PT Scentsored', 'Cash',
] as const

async function getStaff(supabase: any, userId: string) {
  const { data } = await supabase
    .from('staff').select('id, role').eq('auth_user_id', userId).eq('active', true).single()
  return data
}

// PUT /api/v1/finance/expenses/:id
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const staff = await getStaff(supabase as any, user.id)
  if (!staff || !['owner', 'admin'].includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { date, amount, method, cat, who, note } = body

  if (!date || !amount || !method)
    return NextResponse.json({ error: { code: 'MISSING_FIELDS' } }, { status: 400 })

  if (!VALID_METHODS.includes(method))
    return NextResponse.json({ error: { code: 'INVALID_METHOD' } }, { status: 400 })

  const { data, error } = await (supabase as any)
    .from('finance_expenses')
    .update({ date, amount: +amount, method, cat: cat || null, who: who || null, note: note || null })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 })

  return NextResponse.json({ data })
}

// DELETE /api/v1/finance/expenses/:id
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const staff = await getStaff(supabase as any, user.id)
  if (!staff || !['owner', 'admin'].includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { id } = await params

  // Hapus foto dari storage jika ada
  const { data: row } = await (supabase as any)
    .from('finance_expenses').select('photo_url').eq('id', id).single()
  if (row?.photo_url) {
    const path = row.photo_url.split('/finance-receipts/')[1]
    if (path) await (supabase as any).storage.from('finance-receipts').remove([path])
  }

  const { error } = await (supabase as any).from('finance_expenses').delete().eq('id', id)
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 })

  return NextResponse.json({ ok: true })
}
