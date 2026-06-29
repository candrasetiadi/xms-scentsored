import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { isGoogleCalendarConfigured, createSlotEvent } from '@/lib/google-calendar'

// GET /api/v1/consultation-slots?branch_id=&from=&to=
// Publik (anon) — ambil slot aktif untuk halaman booking
export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branch_id')
  const from     = searchParams.get('from') ?? new Date().toISOString().slice(0, 10)
  const to       = searchParams.get('to')   ?? new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10)

  let query = supabase
    .from('consultation_slots')
    .select(`
      id, branch_id, date, start_time, end_time, max_bookings, price, notes, is_active,
      branches!inner(id, name),
      consultation_bookings(id, status, qty)
    `)
    .eq('is_active', true)
    .gte('date', from)
    .lte('date', to)
    .order('date')
    .order('start_time')

  if (branchId) query = query.eq('branch_id', branchId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  const result = (data ?? []).map(slot => {
    const bookings = ((slot.consultation_bookings ?? []) as unknown) as { status: string; qty: number }[]
    const filled   = bookings
      .filter(b => b.status === 'confirmed' || b.status === 'pending_payment')
      .reduce((sum, b) => sum + (b.qty ?? 1), 0)
    return {
      id:           slot.id,
      branch_id:    slot.branch_id,
      branch_name:  ((slot.branches as unknown) as { name: string }).name,
      date:         slot.date,
      start_time:   slot.start_time,
      end_time:     slot.end_time,
      max_bookings: slot.max_bookings,
      price:        slot.price,
      filled,
      available:    Math.max(0, slot.max_bookings - filled),
      notes:        slot.notes,
    }
  })

  return NextResponse.json({ data: result })
}

// POST /api/v1/consultation-slots — buat slot manual (manager only)
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  let body: {
    branch_id?: string; date: string; start_time: string; end_time: string
    max_bookings?: number; price?: number; notes?: string
  }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Body tidak valid.' } }, { status: 400 })
  }

  if (!body.date || !body.start_time || !body.end_time)
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'date, start_time, end_time wajib.' } }, { status: 400 })

  const branchId = body.branch_id ?? staff.branch_id
  if (!branchId)
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'branch_id wajib.' } }, { status: 400 })

  const admin = createAdminClient()

  const { data: slot, error } = await admin
    .from('consultation_slots')
    .insert({
      branch_id:    branchId,
      date:         body.date,
      start_time:   body.start_time,
      end_time:     body.end_time,
      max_bookings: body.max_bookings ?? 16,
      price:        body.price ?? 0,
      notes:        body.notes ?? null,
    })
    .select('id, date, start_time, end_time, max_bookings, price')
    .single()

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  // Buat Google Calendar event langsung
  if (isGoogleCalendarConfigured()) {
    createCalendarEventForSlot(admin, slot, branchId)
      .catch(err => console.error('[Calendar] gagal buat event untuk slot manual:', err))
  }

  return NextResponse.json({ data: slot }, { status: 201 })
}

async function createCalendarEventForSlot(
  admin: ReturnType<typeof createAdminClient>,
  slot: { id: string; date: string; start_time: string; end_time: string; max_bookings: number },
  branchId: string,
) {
  const { data: branch } = await admin
    .from('branches').select('name').eq('id', branchId).single()
  if (!branch) return

  const eventId = await createSlotEvent({
    slotDate:    slot.date,
    startTime:   slot.start_time.slice(0, 5),
    endTime:     slot.end_time.slice(0, 5),
    branchName:  branch.name,
    maxBookings: slot.max_bookings,
  })

  await admin
    .from('consultation_slots')
    .update({ calendar_event_id: eventId })
    .eq('id', slot.id)

  console.log(`[Calendar] Event dibuat untuk slot ${slot.id}: ${eventId}`)
}
