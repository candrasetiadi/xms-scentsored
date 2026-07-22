import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PUT /api/v1/finance/bank-statements/:id
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await (supabase as any)
    .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { rekening, date, jenis, nominal, keterangan } = body

  const { data, error } = await (supabase as any)
    .from('finance_bank_statements')
    .update({ rekening, date, jenis, nominal: +nominal, keterangan: keterangan || null })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 })

  return NextResponse.json({ data })
}

// DELETE /api/v1/finance/bank-statements/:id
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await (supabase as any)
    .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { id } = await params
  const { error } = await (supabase as any).from('finance_bank_statements').delete().eq('id', id)
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 })

  return NextResponse.json({ ok: true })
}
