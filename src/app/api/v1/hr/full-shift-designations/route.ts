import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }      from 'next/server'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any

async function getManagerStaff() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const admin = createAdminClient() as DB
  const { data: staff } = await admin
    .from('staff')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()

  if (!staff || (staff.role !== 'owner' && staff.role !== 'admin')) return null
  return staff as { id: string; role: string }
}

// GET /api/v1/hr/full-shift-designations?date=YYYY-MM-DD
// Returns all active staff with designation status and attendance info for the date.
export async function GET(request: Request) {
  const manager = await getManagerStaff()
  if (!manager) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)

  if (!DATE_RE.test(date))
    return NextResponse.json({ error: 'date harus format YYYY-MM-DD.' }, { status: 400 })

  const db = createAdminClient() as DB

  const [{ data: staffList }, { data: designations }, { data: attendances }] = await Promise.all([
    db.from('staff').select('id, name, role, branch_id').eq('active', true).order('name'),
    db.from('full_shift_designations').select('id, staff_id, designated_by').eq('date', date),
    db.from('attendances').select('staff_id, clock_in, clock_out, worked_minutes, is_full_shift, shift_bonus').eq('work_date', date),
  ])

  const designMap = new Map((designations ?? []).map((d: DB) => [d.staff_id, d]))
  const attendMap = new Map((attendances  ?? []).map((a: DB) => [a.staff_id, a]))

  const data = (staffList ?? []).map((s: DB) => ({
    id:             s.id,
    name:           s.name,
    role:           s.role,
    branch_id:      s.branch_id,
    designation_id: (designMap.get(s.id) as DB)?.id ?? null,
    is_designated:  designMap.has(s.id),
    attendance:     (attendMap.get(s.id) as DB) ?? null,
  }))

  return NextResponse.json({ data })
}

// POST /api/v1/hr/full-shift-designations
// Body: { date: string; staff_id: string }
export async function POST(request: Request) {
  const manager = await getManagerStaff()
  if (!manager) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 })

  const { date, staff_id } = body as { date?: string; staff_id?: string }

  if (!date     || !DATE_RE.test(date))
    return NextResponse.json({ error: 'date harus format YYYY-MM-DD.' }, { status: 400 })
  if (!staff_id || !UUID_RE.test(staff_id))
    return NextResponse.json({ error: 'staff_id harus UUID valid.' }, { status: 400 })

  const db = createAdminClient() as DB
  const { data, error } = await db
    .from('full_shift_designations')
    .insert({ date, staff_id, designated_by: manager.id })
    .select('id, date, staff_id')
    .single()

  if (error) {
    if (error.code === '23505')
      return NextResponse.json({ error: 'Staff sudah ditunjuk Full Shift pada tanggal ini.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
