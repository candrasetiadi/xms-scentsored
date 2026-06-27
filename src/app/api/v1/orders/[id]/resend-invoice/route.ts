import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/v1/orders/:id/resend-invoice — M10
// Kirim ulang invoice WA. Role: admin/owner.
// enqueue_wa_invoice menghapus entry lama lalu insert ulang (override idempotency).

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role)) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Hanya admin/owner.' } }, { status: 403 })
  }

  const { id } = await params
  const { error } = await supabase.rpc('enqueue_wa_invoice', { p_order_id: id })

  if (error) {
    const isClient = error.message.includes('tidak ditemukan') || error.message.includes('nomor telepon')
    return NextResponse.json({ error: { code: 'RESEND_ERROR', message: error.message } }, { status: isClient ? 422 : 500 })
  }

  return NextResponse.json({ data: { queued: true } })
}
