import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const MANAGER_ROLES = ['owner', 'admin']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// POST /api/v1/commission-tracker/payout
// Body: { tx_ids: string[], transfer_date: string, transfer_photo_url?: string, notes?: string }
// Owner/admin only
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await (supabase as any).from('staff').select('role, can_access_commission').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || (!MANAGER_ROLES.includes(staff.role) && !(staff as any).can_access_commission))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  let body: {
    tx_ids: string[]
    transfer_date: string
    transfer_photo_url?: string
    notes?: string
  }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Body tidak valid.' } }, { status: 400 })
  }

  if (!Array.isArray(body.tx_ids) || body.tx_ids.length === 0)
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'tx_ids harus array UUID non-kosong.' } }, { status: 400 })

  const invalidId = body.tx_ids.find(id => !UUID_RE.test(id))
  if (invalidId)
    return NextResponse.json({ error: { code: 'VALIDATION', message: `tx_id tidak valid: ${invalidId}` } }, { status: 400 })

  if (!body.transfer_date || !DATE_RE.test(body.transfer_date))
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'transfer_date harus format YYYY-MM-DD.' } }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await (admin as any).rpc('mark_commission_transactions_paid', {
    p_tx_ids:           body.tx_ids,
    p_transfer_date:    body.transfer_date,
    p_photo_url:        body.transfer_photo_url ?? null,
    p_notes:            body.notes ?? null,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('tidak ditemukan'))
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: msg } }, { status: 404 })
    if (msg.toLowerCase().includes('already paid') || msg.toLowerCase().includes('sudah paid'))
      return NextResponse.json({ error: { code: 'CONFLICT', message: msg } }, { status: 409 })
    return NextResponse.json({ error: { code: 'DB_ERROR', message: msg } }, { status: 500 })
  }

  // data = { updated_count, total_driver_fee, total_company_fee }
  return NextResponse.json({ data }, { status: 200 })
}
