import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { sendBookingConfirmWa } from '@/lib/messaging'
import { isGoogleCalendarConfigured, updateEventDescription } from '@/lib/google-calendar'

// ── CORS helpers ───────────────────────────────────────────────────────────────

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') ?? '*'
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Max-Age':       '86400',
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) })
}

// ── API key validation ─────────────────────────────────────────────────────────

function validateApiKey(request: Request): boolean {
  const expected = process.env.BOOKING_API_KEY
  if (!expected) return false
  const provided = request.headers.get('x-api-key') ?? ''
  if (provided.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  } catch {
    return false
  }
}

// ── POST /api/v1/public/bookings ───────────────────────────────────────────────
//
// Endpoint untuk website eksternal. Memerlukan header: X-API-Key: <secret>
//
// Request body:
//   slot_id        string  — wajib
//   customer_name  string  — wajib
//   customer_phone string  — wajib
//   customer_email string  — opsional (untuk notifikasi)
//   notes          string  — opsional
//
// Response 201:
//   { data: { booking_id, queue_number, slot_date, start_time, end_time } }
//
// Response errors:
//   401 — X-API-Key tidak valid
//   400 — field wajib kosong
//   422 — slot penuh / tidak tersedia / sudah lewat
//   500 — server error

export async function POST(request: Request) {
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'API key tidak valid.' } },
      { status: 401, headers: corsHeaders(request) },
    )
  }

  let body: {
    slot_id:         string
    customer_name:   string
    customer_phone:  string
    customer_email?: string
    notes?:          string
  }
  try { body = await request.json() } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'Body tidak valid.' } },
      { status: 400, headers: corsHeaders(request) },
    )
  }

  if (!body.slot_id || !body.customer_name || !body.customer_phone) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'slot_id, customer_name, customer_phone wajib.' } },
      { status: 400, headers: corsHeaders(request) },
    )
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('check_and_create_booking', {
    p_slot_id:        body.slot_id,
    p_customer_name:  body.customer_name,
    p_customer_phone: body.customer_phone,
    p_customer_email: body.customer_email ?? null,
    p_notes:          body.notes ?? null,
  })

  if (error) {
    const msg      = error.message
    const isClient = msg.includes('penuh') || msg.includes('tidak ditemukan') || msg.includes('tidak tersedia') || msg.includes('lewat')
    return NextResponse.json(
      { error: { code: 'BOOKING_ERROR', message: msg } },
      { status: isClient ? 422 : 500, headers: corsHeaders(request) },
    )
  }

  const result = data as {
    booking_id:   string
    queue_number: number
    slot_date:    string
    start_time:   string
    end_time:     string
    max_bookings: number
    filled:       number
  }

  // WA konfirmasi (non-blocking)
  sendBookingConfirmWa(result.booking_id).catch(() => {})

  // Google Calendar (non-blocking)
  if (isGoogleCalendarConfigured()) {
    syncCalendar({ slotId: body.slot_id, maxBookings: result.max_bookings })
      .catch(err => console.error('[Calendar/public] syncCalendar error:', err))
  }

  return NextResponse.json({ data: result }, { status: 201, headers: corsHeaders(request) })
}

async function syncCalendar(opts: { slotId: string; maxBookings: number }) {
  const admin = createAdminClient()

  const { data: slot } = await admin
    .from('consultation_slots')
    .select('calendar_event_id, branches!inner(name)')
    .eq('id', opts.slotId)
    .single()

  if (!slot?.calendar_event_id) return

  const { data: bookings } = await admin
    .from('consultation_bookings')
    .select('queue_number, customer_name, customer_phone')
    .eq('slot_id', opts.slotId)
    .eq('status', 'confirmed')
    .order('queue_number')

  await updateEventDescription({
    eventId:     slot.calendar_event_id as string,
    branchName:  ((slot.branches as unknown) as { name: string }).name,
    maxBookings: opts.maxBookings,
    bookings:    (bookings ?? []).map(b => ({
      queueNumber: b.queue_number,
      name:        b.customer_name,
      phone:       b.customer_phone,
    })),
  })
}
