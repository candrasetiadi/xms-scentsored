import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/v1/edc-machines?branch_id=
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branch_id') ?? staff.branch_id
  if (!branchId) return NextResponse.json({ error: { code: 'VALIDATION', message: 'branch_id wajib.' } }, { status: 400 })

  const { data, error } = await supabase
    .from('edc_machines')
    .select('id, bank_name, terminal_id, label')
    .eq('branch_id', branchId)
    .eq('active', true)
    .order('bank_name')

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  return NextResponse.json({ data })
}
