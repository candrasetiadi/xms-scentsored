import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MANAGER_ROLES = ['owner', 'admin']

async function auth(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { err: NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 }) }
  const { data: staff } = await supabase.from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !MANAGER_ROLES.includes(staff.role))
    return { err: NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 }) }
  return { supabase, user, staff }
}

// GET /api/v1/travel-agencies?active=true
export async function GET(request: Request) {
  const { supabase, err } = await auth(request)
  if (err) return err

  const { searchParams } = new URL(request.url)
  const activeOnly = searchParams.get('active') !== 'false'

  let query = supabase!.from('travel_agencies').select('*').order('name')
  if (activeOnly) query = query.eq('active', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  return NextResponse.json({ data })
}

// POST /api/v1/travel-agencies
export async function POST(request: Request) {
  const { supabase, err } = await auth(request)
  if (err) return err

  let body: { name: string; phone?: string; fee_value?: number }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Body tidak valid.' } }, { status: 400 })
  }

  if (!body.name?.trim())
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Nama perusahaan wajib.' } }, { status: 400 })

  const feeValue = body.fee_value ?? 5
  if (feeValue < 0 || feeValue > 100)
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Fee harus antara 0–100%.' } }, { status: 400 })

  const { data, error } = await supabase!
    .from('travel_agencies')
    .insert({ name: body.name.trim(), phone: body.phone ?? null, fee_value: feeValue })
    .select()
    .single()

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
