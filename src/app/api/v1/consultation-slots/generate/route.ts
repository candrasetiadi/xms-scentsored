import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const DEFAULT_SESSIONS = [
  { start_time: '09:00', end_time: '10:30' },
  { start_time: '12:00', end_time: '13:30' },
  { start_time: '15:00', end_time: '16:30' },
  { start_time: '18:00', end_time: '19:30' },
]

// POST /api/v1/consultation-slots/generate
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user)
    return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  let body: {
    branch_id?: string
    from: string
    to: string
    max_bookings?: number
    price?: number
    price_100ml?: number
    price_kids?: number
    sessions?: { start_time: string; end_time: string }[]
    skip_weekends?: boolean
  }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Body tidak valid.' } }, { status: 400 })
  }

  const branchId = body.branch_id ?? staff.branch_id
  if (!branchId)
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'branch_id wajib.' } }, { status: 400 })
  if (!body.from || !body.to)
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'from dan to wajib.' } }, { status: 400 })

  const fromDate = new Date(body.from)
  const toDate   = new Date(body.to)
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || fromDate > toDate)
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Rentang tanggal tidak valid.' } }, { status: 400 })

  const maxBookings  = body.max_bookings ?? 16
  const price        = body.price       ?? 0
  const price_100ml  = body.price_100ml ?? 0
  const price_kids   = body.price_kids  ?? 0
  const sessions     = body.sessions ?? DEFAULT_SESSIONS
  const skipWeekends = body.skip_weekends ?? false

  const admin = createAdminClient()

  // Ambil slot yang sudah ada agar bisa skip duplikat
  const { data: existingSlots } = await admin
    .from('consultation_slots')
    .select('date, start_time')
    .eq('branch_id', branchId)
    .gte('date', body.from)
    .lte('date', body.to)

  const existingSet = new Set(
    (existingSlots ?? []).map(s => `${s.date}|${s.start_time.slice(0, 5)}`)
  )

  // Build daftar slot baru
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toInsert: any[] = []

  const cur = new Date(fromDate)
  while (cur <= toDate) {
    const dow = cur.getDay()
    if (!skipWeekends || (dow !== 0 && dow !== 6)) {
      const dateStr = cur.toISOString().slice(0, 10)
      for (const session of sessions) {
        if (!existingSet.has(`${dateStr}|${session.start_time}`)) {
          toInsert.push({ branch_id: branchId, date: dateStr, start_time: session.start_time, end_time: session.end_time, max_bookings: maxBookings, price, price_100ml, price_kids, is_active: true })
        }
      }
    }
    cur.setDate(cur.getDate() + 1)
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ data: { created: 0, skipped: existingSlots?.length ?? 0 } })
  }

  const { data: inserted, error: insertErr } = await (admin as any)
    .from('consultation_slots')
    .insert(toInsert)
    .select('id, date, start_time, end_time, max_bookings')

  if (insertErr)
    return NextResponse.json({ error: { code: 'DB_ERROR', message: insertErr.message } }, { status: 500 })

  const totalDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86400_000) + 1
  const skipped   = totalDays * sessions.length - toInsert.length

  return NextResponse.json({ data: { created: toInsert.length, skipped } }, { status: 201 })
}
