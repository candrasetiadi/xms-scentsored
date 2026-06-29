import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST /api/v1/orders/:id/checkout
// M5 — buat transaksi QRIS dinamis via Midtrans Core API.
// Jika MIDTRANS_SERVER_KEY tidak dikonfigurasi, kembalikan error instruktif.

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin', 'cashier'].includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const serverKey = process.env.MIDTRANS_SERVER_KEY
  if (!serverKey) {
    return NextResponse.json({
      error: {
        code:    'MIDTRANS_NOT_CONFIGURED',
        message: 'MIDTRANS_SERVER_KEY belum dikonfigurasi. Hubungi admin.',
      }
    }, { status: 503 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({})) as { method?: string }
  if (body.method !== 'qris')
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'method harus qris.' } }, { status: 400 })

  const admin = createAdminClient()

  // Ambil order
  const { data: order } = await admin
    .from('orders').select('id, order_number, total, status').eq('id', id).single()
  if (!order) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })
  if (!['draft'].includes(order.status))
    return NextResponse.json({ error: { code: 'UNPROCESSABLE', message: 'Order tidak dalam status draft.' } }, { status: 422 })

  // Cek idempotency — kalau sudah ada payment pending untuk order ini, kembalikan yang ada
  const { data: existing } = await admin
    .from('payments')
    .select('id, external_id, qris_string, status')
    .eq('order_id', id)
    .eq('method', 'qris')
    .eq('status', 'pending')
    .maybeSingle()

  if (existing?.qris_string) {
    return NextResponse.json({
      data: {
        payment_id:  existing.id,
        qris_string: existing.qris_string,
        status:      'pending',
      }
    })
  }

  // Charge Midtrans QRIS
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'
  const midtransUrl  = isProduction
    ? 'https://api.midtrans.com/v2/charge'
    : 'https://api.sandbox.midtrans.com/v2/charge'

  const externalId = `${order.order_number}-${Date.now()}`
  const authToken  = Buffer.from(`${serverKey}:`).toString('base64')

  let chargeRes: Response
  try {
    chargeRes = await fetch(midtransUrl, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${authToken}`,
        'Accept':        'application/json',
      },
      body: JSON.stringify({
        payment_type:        'qris',
        transaction_details: {
          order_id:     externalId,
          gross_amount: Math.round(order.total),
        },
        qris: { acquirer: 'gopay' },
      }),
    })
  } catch (err) {
    return NextResponse.json({ error: { code: 'MIDTRANS_UNREACHABLE', message: String(err) } }, { status: 502 })
  }

  const charge = await chargeRes.json()

  if (!['200', '201'].includes(charge.status_code)) {
    return NextResponse.json({
      error: { code: 'MIDTRANS_ERROR', message: charge.status_message ?? 'Midtrans error' }
    }, { status: 502 })
  }

  const qrisString = charge.qr_string as string

  // Simpan payment record
  const { data: payment, error: payErr } = await admin
    .from('payments')
    .insert({
      order_id:    id,
      method:      'qris',
      amount:      order.total,
      gateway:     'midtrans',
      external_id: externalId,
      qris_string: qrisString,
      status:      'pending',
    })
    .select('id')
    .single()

  if (payErr)
    return NextResponse.json({ error: { code: 'DB_ERROR', message: payErr.message } }, { status: 500 })

  // Update order → awaiting_payment
  await admin.from('orders').update({ status: 'awaiting_payment' }).eq('id', id)

  return NextResponse.json({
    data: {
      payment_id:  payment.id,
      qris_string: qrisString,
      external_id: externalId,
      status:      'pending',
    }
  }, { status: 201 })
}
