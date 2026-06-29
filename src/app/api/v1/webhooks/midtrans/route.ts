import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { sendInvoiceWa } from '@/lib/messaging'

// POST /api/v1/webhooks/midtrans  — publik, dikecualikan dari middleware auth
// Menerima notifikasi payment dari Midtrans dan memproses settlement secara idempotent.

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
    // Jika belum dikonfigurasi, balas 200 agar Midtrans tidak retry terus
    return NextResponse.json({ received: true, note: 'Midtrans not configured' })
  }

  let body: Record<string, string>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    order_id: externalId,
    status_code: statusCode,
    gross_amount: grossAmount,
    transaction_status: transactionStatus,
    signature_key: signatureKey,
    transaction_id: transactionId,
    fraud_status: fraudStatus,
  } = body

  // Verifikasi signature Midtrans
  if (!verifyMidtransSignature(externalId, statusCode, grossAmount, serverKey, signatureKey)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Hanya proses settlement yang bersih
  const isSettled = transactionStatus === 'settlement' ||
    (transactionStatus === 'capture' && fraudStatus === 'accept')

  if (!isSettled) {
    // Untuk expired/failed, update status payment saja
    if (['expire', 'cancel', 'deny', 'failure'].includes(transactionStatus)) {
      const admin = createAdminClient()
      await admin
        .from('payments')
        .update({ status: transactionStatus === 'expire' ? 'expired' : 'failed' })
        .eq('external_id', externalId)
        .in('status', ['pending'])
    }
    return NextResponse.json({ received: true })
  }

  // Proses settlement via SECURITY DEFINER function (idempotent)
  const admin = createAdminClient()
  const { data: result, error } = await admin.rpc('process_midtrans_settlement', {
    p_external_id:  externalId,
    p_amount:       parseFloat(grossAmount),
    p_gateway_ref:  transactionId ?? '',
  })

  if (error) {
    console.error('[Midtrans webhook] process_midtrans_settlement error:', error)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  // Kirim invoice WA setelah settlement (non-blocking)
  if (result) {
    const orderId = result as string
    sendInvoiceWa(orderId).catch(() => {})
  }

  return NextResponse.json({ received: true, result })
}
