import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendBookingConfirmWa } from '@/lib/messaging'

// POST /api/v1/bookings — publik (anon), buat booking via DB function (anti-overbooking)
export async function POST(request: Request) {
  let body: {
    slot_id:        string
    customer_name:  string
    customer_phone: string
    customer_email?: string
    notes?:         string
  }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Body tidak valid.' } }, { status: 400 })
  }

  if (!body.slot_id || !body.customer_name || !body.customer_phone)
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'slot_id, customer_name, customer_phone wajib.' } }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('check_and_create_booking', {
    p_slot_id:       body.slot_id,
    p_customer_name:  body.customer_name,
    p_customer_phone: body.customer_phone,
    p_customer_email: body.customer_email ?? null,
    p_notes:          body.notes ?? null,
  })

  if (error) {
    const msg = error.message
    const isClient = msg.includes('penuh') || msg.includes('tidak ditemukan') || msg.includes('tidak tersedia') || msg.includes('lewat')
    return NextResponse.json({ error: { code: 'BOOKING_ERROR', message: msg } }, { status: isClient ? 422 : 500 })
  }

  const result = data as {
    booking_id:   string
    queue_number: number
    slot_date:    string
    start_time:   string
    end_time:     string
  }

  // Kirim WA konfirmasi (non-blocking)
  sendBookingConfirmWa(result.booking_id).catch(() => {})

  return NextResponse.json({ data: result }, { status: 201 })
}

// GET /api/v1/bookings?slot_id=&status= — manager only
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const slotId = searchParams.get('slot_id')
  const status = searchParams.get('status')

  let query = supabase
    .from('consultation_bookings')
    .select('id, slot_id, customer_name, customer_phone, customer_email, status, notes, queue_number, created_at')
    .order('queue_number')

  if (slotId) query = query.eq('slot_id', slotId)
  if (status) query = query.eq('status', status as 'confirmed' | 'cancelled')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}
