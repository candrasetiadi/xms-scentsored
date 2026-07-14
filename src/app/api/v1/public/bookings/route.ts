import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { isMidtransConfigured, createSnapToken } from '@/lib/midtrans'

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
//   customer_email string  — opsional
//   qty_50ml       number  — jumlah peserta 50ml, default 0
//   qty_100ml      number  — jumlah peserta 100ml, default 0
//   qty_kids       number  — jumlah peserta kids (35ml), default 0
//   notes          string  — opsional
//
// Response 201:
//   { data: { booking_id, queue_number, slot_date, start_time, end_time,
//             qty, qty_50ml, qty_100ml, qty_kids, amount, expires_at, snap_token, payment_url } }

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
    qty_50ml?:       number
    qty_100ml?:      number
    qty_kids?:       number
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

  const qty50ml  = Math.max(0, Math.floor(body.qty_50ml  ?? 0))
  const qty100ml = Math.max(0, Math.floor(body.qty_100ml ?? 0))
  const qtyKids  = Math.max(0, Math.floor(body.qty_kids  ?? 0))

  if (qty50ml + qty100ml + qtyKids < 1) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'Pilih minimal 1 peserta.' } },
      { status: 400, headers: corsHeaders(request) },
    )
  }

  const admin = createAdminClient()

  const { data, error } = await (admin as any).rpc('check_and_create_booking', {
    p_slot_id:        body.slot_id,
    p_customer_name:  body.customer_name,
    p_customer_phone: body.customer_phone,
    p_customer_email: body.customer_email ?? null,
    p_qty_50ml:       qty50ml,
    p_qty_100ml:      qty100ml,
    p_qty_kids:       qtyKids,
    p_notes:          body.notes ?? null,
  })

  if (error) {
    const msg      = error.message
    const isClient = msg.includes('penuh') || msg.includes('tidak ditemukan') || msg.includes('tidak tersedia') || msg.includes('lewat') || msg.includes('minimal')
    return NextResponse.json(
      { error: { code: 'BOOKING_ERROR', message: msg } },
      { status: isClient ? 422 : 500, headers: corsHeaders(request) },
    )
  }

  const result = (data as unknown) as {
    booking_id:   string
    queue_number: number
    slot_date:    string
    start_time:   string
    end_time:     string
    max_bookings: number
    qty:          number
    qty_50ml:     number
    qty_100ml:    number
    qty_kids:     number
    price:        number
    price_100ml:  number
    price_kids:   number
    amount:       number
    expires_at:   string
  }

  // Buat Midtrans Snap token untuk website eksternal
  let snapToken:    string | null = null
  let paymentUrl:   string | null = null

  if (isMidtransConfigured() && result.amount > 0) {
    try {
      const snap = await createSnapToken({
        orderId:       result.booking_id,
        amount:        result.amount,
        customerName:  body.customer_name,
        customerPhone: body.customer_phone,
        customerEmail: body.customer_email,
      })
      snapToken  = snap.token
      paymentUrl = snap.redirect_url

      await admin
        .from('consultation_bookings')
        .update({ payment_external_id: result.booking_id })
        .eq('id', result.booking_id)
    } catch (err) {
      console.error('[Midtrans/public] gagal buat Snap token:', err)
    }
  }

  return NextResponse.json({
    data: {
      booking_id:   result.booking_id,
      queue_number: result.queue_number,
      slot_date:    result.slot_date,
      start_time:   result.start_time,
      end_time:     result.end_time,
      qty:          result.qty,
      qty_50ml:     result.qty_50ml,
      qty_100ml:    result.qty_100ml,
      qty_kids:     result.qty_kids,
      amount:       result.amount,
      expires_at:   result.expires_at,
      snap_token:   snapToken,
      payment_url:  paymentUrl,
    },
  }, { status: 201, headers: corsHeaders(request) })
}
