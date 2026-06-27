import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/v1/orders/:id/pay-cash
// Tandai order lunas tunai + jalankan alur post-paid (potong stok, fee driver, invoice WA)
export async function POST(
  _request: Request,
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

  const { id } = await params

  const { error } = await supabase.rpc('finalize_cash_payment', {
    p_order_id: id,
    p_staff_id: staff.id,
  })

  if (error) {
    const status = error.message.includes('tidak valid') || error.message.includes('tidak ditemukan') ? 422 : 500
    return NextResponse.json({ error: { code: 'PAYMENT_ERROR', message: error.message } }, { status })
  }

  // Ambil order ter-update untuk dikembalikan ke client
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, queue_number, status, total, paid_at')
    .eq('id', id)
    .single()

  return NextResponse.json({ data: order })
}
