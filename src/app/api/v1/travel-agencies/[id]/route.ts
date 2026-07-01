import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MANAGER_ROLES = ['owner', 'admin']

async function auth() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { err: NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 }) }
  const { data: staff } = await supabase.from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !MANAGER_ROLES.includes(staff.role))
    return { err: NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 }) }
  return { supabase }
}

// PATCH /api/v1/travel-agencies/:id
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { supabase, err } = await auth()
  if (err) return err
  const { id } = await params

  let body: { name?: string; phone?: string; fee_value?: number; active?: boolean }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Body tidak valid.' } }, { status: 400 })
  }

  if (body.fee_value !== undefined && (body.fee_value < 0 || body.fee_value > 100))
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Fee harus antara 0–100%.' } }, { status: 400 })

  const update: { name?: string; phone?: string | null; fee_value?: number; active?: boolean } = {}
  if (body.name      !== undefined) update.name      = body.name.trim()
  if (body.phone     !== undefined) update.phone     = body.phone || null
  if (body.fee_value !== undefined) update.fee_value = body.fee_value
  if (body.active    !== undefined) update.active    = body.active

  const { data, error } = await supabase!
    .from('travel_agencies')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  return NextResponse.json({ data })
}
