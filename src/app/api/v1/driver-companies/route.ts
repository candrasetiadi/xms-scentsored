import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST /api/v1/driver-companies — create company baru (auto-create dari commission tracker)
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await (supabase as any)
    .from('staff').select('role, can_access_commission').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || (!['owner', 'admin'].includes(staff.role) && !(staff as any).can_access_commission))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  let body: { name: string; fee_value?: number }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Body tidak valid.' } }, { status: 400 })
  }

  if (!body.name?.trim())
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'name wajib.' } }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await (admin as any)
    .from('driver_companies')
    .insert({
      name:      body.name.trim(),
      fee_value: body.fee_value ?? 5,
      is_active: true,
    })
    .select('id, name, fee_value, is_active')
    .single()

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

// GET /api/v1/driver-companies?active_only=true
// List driver companies untuk dropdown Atribusi Driver. Hanya owner/admin.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff')
    .select('role')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()
  if (!staff) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  if (!['owner', 'admin'].includes(staff.role)) {
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  // Default: hanya tampilkan yang aktif
  const activeOnly = searchParams.get('active_only') !== 'false'

  let query = (supabase as any)
    .from('driver_companies')
    .select('id, name, phone, fee_value, is_active')
    .order('name')

  if (activeOnly) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  }

  return NextResponse.json({ data })
}
