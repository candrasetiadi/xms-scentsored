import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isGoogleCalendarConfigured, updateEventDescription } from '@/lib/google-calendar'
import { isMidtransConfigured, createQris } from '@/lib/midtrans'

// POST /api/v1/bookings — publik (anon), buat booking + QRIS pembayaran
export async function POST(request: Request) {
  let body: {
    slot_id:        string
    customer_name:  string
    customer_phone: string
    customer_email?: string
    qty?:           number
    notes?:         string
  }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Body tidak valid.' } }, { status: 400 })
  }

  if (!body.slot_id || !body.customer_name || !body.customer_phone)
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'slot_id, customer_name, customer_phone wajib.' } }, { status: 400 })

  const qty = Math.max(1, Math.floor(body.qty ?? 1))

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('check_and_create_booking', {
    p_slot_id:        body.slot_id,
    p_customer_name:  body.customer_name,
    p_customer_phone: body.customer_phone,
    p_customer_email: body.customer_email ?? null,
    p_qty:            qty,
    p_notes:          body.notes ?? null,
  })

  if (error) {
    const msg = error.message
    const isClient = msg.includes('penuh') || msg.includes('tidak ditemukan') || msg.includes('tidak tersedia') || msg.includes('lewat') || msg.includes('minimal')
    return NextResponse.json({ error: { code: 'BOOKING_ERROR', message: msg } }, { status: isClient ? 422 : 500 })
  }

  const result = data as {
    booking_id:   string
    queue_number: number
    slot_date:    string
    start_time:   string
    end_time:     string
    max_bookings: number
    price:        number
    qty:          number
    amount:       number
    expires_at:   string
    filled:       number
  }

  // Jika gratis (amount = 0), langsung confirm tanpa perlu pembayaran
  if (result.amount === 0) {
    await admin
      .from('consultation_bookings')
      .update({ status: 'confirmed', paid_at: new Date().toISOString() })
      .eq('id', result.booking_id)
    if (isGoogleCalendarConfigured()) {
      syncCalendar({ slotId: body.slot_id, maxBookings: result.max_bookings })
        .catch(() => {})
    }
    return NextResponse.json({
      data: {
        booking_id:   result.booking_id,
        queue_number: result.queue_number,
        slot_date:    result.slot_date,
        start_time:   result.start_time,
        end_time:     result.end_time,
        qty:          result.qty,
        price:        0,
        amount:       0,
        expires_at:   null,
        qris:         null,
      },
    }, { status: 201 })
  }

  // Buat QRIS (jika Midtrans terkonfigurasi dan ada nominal)
  let qris: { qr_string: string; expire_time: string } | null = null
  if (isMidtransConfigured() && result.amount > 0) {
    try {
      const qrisResult = await createQris({
        orderId:      result.booking_id,
        amount:       result.amount,
        customerName: body.customer_name,
      })
      qris = { qr_string: qrisResult.qr_string, expire_time: qrisResult.expire_time }

      // Simpan external_id ke booking
      await admin
        .from('consultation_bookings')
        .update({ payment_external_id: result.booking_id })
        .eq('id', result.booking_id)
    } catch (err) {
      console.error('[Midtrans] gagal buat QRIS:', err)
      // Lanjut tanpa QRIS — admin bisa confirm manual
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
      price:        result.price,
      amount:       result.amount,
      expires_at:   result.expires_at,
      qris,
    },
  }, { status: 201 })
}

// syncCalendar: update deskripsi event yang sudah ada dengan semua booking confirmed
async function syncCalendar(opts: { slotId: string; maxBookings: number }) {
  const admin = createAdminClient()

  const { data: slot, error: slotErr } = await admin
    .from('consultation_slots')
    .select('calendar_event_id, branches!inner(name)')
    .eq('id', opts.slotId)
    .single()

  if (slotErr) { console.error('[Calendar] gagal ambil slot:', slotErr.message); return }
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

  console.log(`[Calendar] Updated event ${slot.calendar_event_id} (${bookings?.length ?? 0} booking confirmed)`)
}

export { syncCalendar }

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
    .select('id, slot_id, customer_name, customer_phone, customer_email, qty, status, amount, expires_at, paid_at, notes, queue_number, created_at')
    .order('queue_number')

  if (slotId) query = query.eq('slot_id', slotId)
  if (status) query = query.eq('status', status as 'pending_payment' | 'confirmed' | 'cancelled' | 'expired')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}
