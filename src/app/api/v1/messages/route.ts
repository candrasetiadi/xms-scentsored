import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/v1/messages?reference_type=&reference_id=&status=&limit=&offset=
// M10 — log pesan keluar. Role: admin/owner.

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role)) {
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const refType  = searchParams.get('reference_type')
  const refId    = searchParams.get('reference_id')
  const status   = searchParams.get('status')
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '25'), 100)
  const offset   = parseInt(searchParams.get('offset') ?? '0')

  let query = supabase
    .from('outbound_messages')
    .select('id, channel, to_phone, purpose, reference_type, reference_id, status, provider_ref, sent_at, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (refType) query = query.eq('reference_type', refType)
  if (refId)   query = query.eq('reference_id', refId)
  if (status)  query = query.eq('status', status)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  return NextResponse.json({ data, meta: { total: count ?? 0, limit, offset } })
}
