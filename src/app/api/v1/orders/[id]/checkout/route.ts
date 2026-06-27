import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST /api/v1/orders/:id/checkout
// M5 — Buat pembayaran QRIS via Midtrans.
// MVP: stub — kembalikan error instruktif jika MIDTRANS_SERVER_KEY belum dikonfigurasi.

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin', 'cashier'].includes(staff.role)) {
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })
  }

  // Validasi Midtrans dikonfigurasi
  if (!process.env.MIDTRANS_SERVER_KEY) {
    return NextResponse.json({
      error: {
        code: 'MIDTRANS_NOT_CONFIGURED',
        message: 'Akun Midtrans belum dikonfigurasi. Gunakan pembayaran cash untuk saat ini.',
      }
    }, { status: 503 })
  }

  const { id } = await params
  const body = await request.json() as { method?: string }
  if (body.method !== 'qris') {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'method harus qris.' } }, { status: 400 })
  }

  // Ambil order
  const { data: order } = await supabase
    .from('orders').select('id, order_number, total, status, branch_id').eq('id', id).single()
  if (!order) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })
  if (order.status !== 'draft') {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Order sudah tidak dalam status draft.' } }, { status: 422 })
  }

  // ── TODO: Integrasi Midtrans ──────────────────────────────────────────────
  // const midtransClient = new MidtransClient.Snap({ serverKey: process.env.MIDTRANS_SERVER_KEY, isProduction: false })
  // const transaction = await midtransClient.createTransaction({ transaction_details: { order_id: order.order_number, gross_amount: order.total }, payment_type: 'qris' })
  // const externalId = order.order_number
  // const qrisString = transaction.qr_string
  //
  // Insert ke payments:
  // await adminSupabase.from('payments').insert({ order_id: id, method: 'qris', amount: order.total, gateway: 'midtrans', external_id: externalId, qris_string: qrisString, status: 'pending' })
  // Update order status → awaiting_payment
  // return NextResponse.json({ data: { payment_id, qris_string, expires_at, status: 'pending' } })
  // ──────────────────────────────────────────────────────────────────────────

  // Placeholder response untuk development
  void createAdminClient() // touch import agar tidak di-tree-shake
  return NextResponse.json({
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Integrasi Midtrans QRIS belum diimplementasikan. Lihat komentar TODO di route handler ini.',
    }
  }, { status: 501 })
}
