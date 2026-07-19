import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const MANAGER_ROLES = ['owner', 'admin']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// GET /api/v1/commission-tracker/advance-fees?company_id=
// Owner/admin only
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await (supabase as any).from('staff').select('role, can_access_commission').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || (!MANAGER_ROLES.includes(staff.role) && !(staff as any).can_access_commission))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('company_id')

  if (companyId && !UUID_RE.test(companyId))
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'company_id harus UUID valid.' } }, { status: 400 })

  let query = (supabase as any)
    .from('company_advance_fees')
    .select('id, company_id, amount, given_at, notes, created_at, driver_companies(name)')
    .order('given_at', { ascending: false })

  if (companyId) query = query.eq('company_id', companyId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  const advance_fees = (data ?? []).map((row: any) => ({
    id:           row.id,
    company_id:   row.company_id,
    company_name: row.driver_companies?.name ?? null,
    amount:       row.amount,
    given_at:     row.given_at,
    notes:        row.notes,
    created_at:   row.created_at,
  }))

  return NextResponse.json({ data: { advance_fees } })
}

// POST /api/v1/commission-tracker/advance-fees
// Body: { company_id, amount, given_at, notes? }
// Owner/admin only
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await (supabase as any).from('staff').select('id, role, can_access_commission').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || (!MANAGER_ROLES.includes(staff.role) && !(staff as any).can_access_commission))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  let body: { company_id: string; amount: number; given_at: string; notes?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Body tidak valid.' } }, { status: 400 })
  }

  if (!body.company_id || !UUID_RE.test(body.company_id))
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'company_id harus UUID valid.' } }, { status: 400 })
  if (!body.amount || body.amount <= 0)
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'amount harus lebih dari 0.' } }, { status: 400 })
  if (!body.given_at || !DATE_RE.test(body.given_at))
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'given_at harus format YYYY-MM-DD.' } }, { status: 400 })

  // Use admin client to bypass RLS write restriction
  const admin = createAdminClient()
  const { data, error } = await (admin as any)
    .from('company_advance_fees')
    .insert({
      company_id:    body.company_id,
      amount:        body.amount,
      given_at:      body.given_at,
      notes:         body.notes ?? null,
      created_by_id: staff.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
