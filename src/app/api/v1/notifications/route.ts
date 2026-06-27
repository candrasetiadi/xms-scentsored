import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/v1/notifications?branch_id=&unread_only=true&limit=30
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
  }

  const { data: staff } = await supabase
    .from('staff')
    .select('id, role, branch_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()
  if (!staff) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const branchId   = searchParams.get('branch_id') ?? staff.branch_id
  const unreadOnly = searchParams.get('unread_only') !== 'false'
  const limit      = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 100)

  if (!branchId) {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'branch_id wajib.' } }, { status: 400 })
  }

  // Query 1: notifications — filter oleh RLS + role
  const { data: notifs, error: nErr } = await supabase
    .from('notifications')
    .select('id, type, severity, title, body, target_roles, reference_type, reference_id, resolved_at, created_at')
    .eq('branch_id', branchId)
    .contains('target_roles', [staff.role])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (nErr) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: nErr.message } }, { status: 500 })
  }

  if (!notifs || notifs.length === 0) {
    return NextResponse.json({ data: [], unread_count: 0 })
  }

  // Query 2: status baca milik staff ini saja
  const notifIds = notifs.map(n => n.id)
  const { data: reads } = await supabase
    .from('notification_reads')
    .select('notification_id, read_at')
    .eq('staff_id', staff.id)
    .in('notification_id', notifIds)

  const readMap = new Map((reads ?? []).map(r => [r.notification_id, r.read_at]))

  const result = notifs.map(n => ({
    id:             n.id,
    type:           n.type,
    severity:       n.severity,
    title:          n.title,
    body:           n.body,
    reference_type: n.reference_type,
    reference_id:   n.reference_id,
    resolved_at:    n.resolved_at,
    created_at:     n.created_at,
    is_read:        readMap.has(n.id),
    read_at:        readMap.get(n.id) ?? null,
  }))

  const filtered    = unreadOnly ? result.filter(n => !n.is_read) : result
  const unreadCount = result.filter(n => !n.is_read).length

  return NextResponse.json({ data: filtered, unread_count: unreadCount })
}
