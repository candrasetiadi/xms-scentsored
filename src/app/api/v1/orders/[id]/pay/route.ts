import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendInvoiceWa } from '@/lib/messaging'

const VALID_METHODS = ['cash', 'debit_card', 'credit_card', 'bank_transfer', 'qris'] as const
type PaymentMethod = typeof VALID_METHODS[number]

// POST /api/v1/orders/:id/pay
// Body: { method: PaymentMethod, edc_machine_id?: string }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  if (!['owner', 'admin', 'cashier'].includes(staff.role)) {
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })
  }

  const body = await request.json() as { method?: PaymentMethod; edc_machine_id?: string }
  const { id } = await params

  if (!body.method || !VALID_METHODS.includes(body.method)) {
    return NextResponse.json({
      error: { code: 'VALIDATION', message: `method harus salah satu dari: ${VALID_METHODS.join(', ')}` }
    }, { status: 400 })
  }

  if (['debit_card', 'credit_card'].includes(body.method) && !body.edc_machine_id) {
    return NextResponse.json({
      error: { code: 'VALIDATION', message: 'Pilih mesin EDC untuk pembayaran kartu.' }
    }, { status: 400 })
  }

  const { error } = await supabase.rpc('finalize_payment', {
    p_order_id:       id,
    p_staff_id:       staff.id,
    p_method:         body.method,
    p_edc_machine_id: body.edc_machine_id ?? null,
  })

  if (error) {
    const status = error.message.includes('tidak valid')
      || error.message.includes('tidak ditemukan')
      || error.message.includes('wajib') ? 422 : 500
    return NextResponse.json({ error: { code: 'PAYMENT_ERROR', message: error.message } }, { status })
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, queue_number, status, total, paid_at')
    .eq('id', id)
    .single()

  // Kirim invoice WA (non-blocking, tidak gagalkan response)
  sendInvoiceWa(id).catch(() => {})

  return NextResponse.json({ data: order })
}
