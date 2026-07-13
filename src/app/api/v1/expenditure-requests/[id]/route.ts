import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/v1/expenditure-requests/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

    const { data: staff } = await supabase
      .from('staff').select('id, role').eq('auth_user_id', user.id).eq('active', true).single()
    if (!staff) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

    const { id } = await params

    const { data, error } = await (supabase as any)
      .from('expenditure_requests')
      .select(`
        id, title, description, total_estimated, status,
        submitted_at, reviewed_at, reviewer_note, created_at, updated_at,
        requester:requester_id(id, name, role, branch_id),
        reviewer:reviewer_id(id, name),
        expenditure_request_items(id, name, qty, unit_price, subtotal, note)
      `)
      .eq('id', id)
      .single()

    if (error || !data) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })

    // Non-manager hanya boleh akses milik sendiri
    if (!['owner', 'admin'].includes(staff.role) && data.requester?.id !== staff.id) {
      return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[expenditure-requests/:id GET]', err)
    return NextResponse.json({ error: { code: 'INTERNAL' } }, { status: 500 })
  }
}
