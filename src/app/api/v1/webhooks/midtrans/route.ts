import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { sendInvoiceWa } from '@/lib/messaging'

// POST /api/v1/webhooks/midtrans  — publik, dikecualikan dari middleware auth
// Menangani settlement untuk POS order DAN booking konsultasi secara idempotent.

function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
  signatureKey: string,
): boolean {
  const expected = crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex')
  return expected === signatureKey
}

export async function POST(request: Request) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY
  if (!serverKey) {
    return NextResponse.json({ received: true, note: 'Midtrans not configured' })
  }

  let body: Record<string, string>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    order_id:           externalId,
    status_code:        statusCode,
    gross_amount:       grossAmount,
    transaction_status: transactionStatus,
    signature_key:      signatureKey,
    transaction_id:     transactionId,
    fraud_status:       fraudStatus,
  } = body

  if (!verifyMidtransSignature(externalId, statusCode, grossAmount, serverKey, signatureKey)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const admin     = createAdminClient()
  const isSettled = transactionStatus === 'settlement' ||
    (transactionStatus === 'capture' && fraudStatus === 'accept')
  const isExpired = ['expire', 'cancel', 'deny', 'failure'].includes(transactionStatus)

  // ── Cek apakah ini payment untuk booking konsultasi ───────────────────────
  // external_id untuk booking = booking UUID (dari check_and_create_booking)
  const { data: booking } = await admin
    .from('consultation_bookings')
    .select('id, slot_id, status, amount')
    .eq('payment_external_id', externalId)
    .maybeSingle()

  if (booking) {
    // Idempotent: skip jika sudah diproses
    if (booking.status !== 'pending_payment') {
      return NextResponse.json({ received: true, note: 'already processed' })
    }

    if (isSettled) {
      const paidAt = new Date().toISOString()
      await admin
        .from('consultation_bookings')
        .update({ status: 'confirmed', paid_at: paidAt })
        .eq('id', booking.id)

      console.log(`[Midtrans] Booking ${booking.id} confirmed via webhook`)
    }

    if (isExpired) {
      await admin
        .from('consultation_bookings')
        .update({ status: 'expired' })
        .eq('id', booking.id)

      console.log(`[Midtrans] Booking ${booking.id} expired via webhook`)
    }

    return NextResponse.json({ received: true })
  }

  // ── POS order payment ──────────────────────────────────────────────────────
  if (!isSettled) {
    if (isExpired) {
      await admin
        .from('payments')
        .update({ status: transactionStatus === 'expire' ? 'expired' : 'failed' })
        .eq('external_id', externalId)
        .in('status', ['pending'])
    }
    return NextResponse.json({ received: true })
  }

  const { data: result, error } = await admin.rpc('process_midtrans_settlement', {
    p_external_id: externalId,
    p_amount:      parseFloat(grossAmount),
    p_gateway_ref: transactionId ?? '',
  })

  if (error) {
    console.error('[Midtrans webhook] process_midtrans_settlement error:', error)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  if (result) {
    const orderId = result as string
    sendInvoiceWa(orderId).catch(() => {})
  }

  return NextResponse.json({ received: true, result })
}
