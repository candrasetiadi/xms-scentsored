import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }      from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type RawCustomer = { name: string; phone: string | null } | null
type RawSlot     = { date: string } | null
type RawItem     = { id: string }

// GET /api/v1/workshop/formulations
// List semua formulasi. Manager only.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: staff } = await admin
    .from('staff')
    .select('role, branch_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const slotId    = searchParams.get('slot_id')
  const branchId  = searchParams.get('branch_id')
  const status    = searchParams.get('status')
  const dateParam = searchParams.get('date')

  if (slotId   && !UUID_RE.test(slotId))
    return NextResponse.json({ error: 'slot_id harus UUID valid.' }, { status: 400 })
  if (branchId && !UUID_RE.test(branchId))
    return NextResponse.json({ error: 'branch_id harus UUID valid.' }, { status: 400 })
  if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam))
    return NextResponse.json({ error: 'date harus format YYYY-MM-DD.' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any
  let query = db
    .from('workshop_formulations')
    .select(`
      id, access_token, perfume_name, status, total_grams, created_at,
      customers(name, phone),
      consultation_slots(date),
      workshop_formulation_items(id)
    `)
    .order('created_at', { ascending: false })

  if (slotId)    query = query.eq('slot_id',   slotId)
  if (branchId)  query = query.eq('branch_id', branchId)
  if (status)    query = query.eq('status',    status)
  if (dateParam) {
    query = query
      .gte('created_at', `${dateParam}T00:00:00.000Z`)
      .lte('created_at', `${dateParam}T23:59:59.999Z`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = (data ?? []).map((f: any) => ({
    id:           f.id,
    access_token: f.access_token,
    perfume_name: f.perfume_name,
    status:       f.status,
    total_grams:  f.total_grams,
    created_at:   f.created_at,
    customer:     (f.customers         as RawCustomer) ?? null,
    slot:         (f.consultation_slots as RawSlot)    ?? null,
    item_count:   ((f.workshop_formulation_items as RawItem[]) ?? []).length,
  }))

  return NextResponse.json({ data: result })
}
