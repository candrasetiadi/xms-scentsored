import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MANAGER_ROLES = ['owner', 'admin']

// POST /api/v1/agency-advance-fees — tambah advance fee untuk perusahaan
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !MANAGER_ROLES.includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  let body: { travel_agency_id: string; amount: number; note?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Body tidak valid.' } }, { status: 400 })
  }

  if (!body.travel_agency_id)
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'travel_agency_id wajib.' } }, { status: 400 })
  if (!body.amount || body.amount <= 0)
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Amount harus lebih dari 0.' } }, { status: 400 })

  const { data, error } = await supabase
    .from('agency_advance_fees')
    .insert({
      travel_agency_id: body.travel_agency_id,
      amount:           body.amount,
      note:             body.note ?? null,
      created_by:       staff.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

// GET /api/v1/agency-advance-fees?travel_agency_id=
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !MANAGER_ROLES.includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const agencyId = searchParams.get('travel_agency_id')
  if (!agencyId)
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'travel_agency_id wajib.' } }, { status: 400 })

  const { data, error } = await supabase
    .from('agency_advance_fees')
    .select('*')
    .eq('travel_agency_id', agencyId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  return NextResponse.json({ data })
}
