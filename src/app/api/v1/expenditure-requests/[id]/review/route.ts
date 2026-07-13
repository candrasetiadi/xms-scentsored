import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/v1/expenditure-requests/[id]/review
// Body: { action: 'approved' | 'rejected' | 'hold', note?: string }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

    const { data: staff } = await supabase
      .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()
    if (!staff || !['owner', 'admin'].includes(staff.role)) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Hanya owner/admin yang bisa mereview.' } }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { action, note } = body as { action: string; note?: string }

    if (!['approved', 'rejected', 'hold'].includes(action)) {
      return NextResponse.json({ error: { code: 'VALIDATION', message: 'Action tidak valid.' } }, { status: 400 })
    }

    const { error } = await (supabase as any).rpc('review_expenditure_request', {
      p_request_id: id,
      p_action:     action,
      p_note:       note ?? null,
    })

    if (error) {
      return NextResponse.json({ error: { code: 'RPC_ERROR', message: error.message } }, { status: 400 })
    }

    return NextResponse.json({ data: { success: true } })
  } catch (err) {
    console.error('[expenditure-requests/:id/review]', err)
    return NextResponse.json({ error: { code: 'INTERNAL' } }, { status: 500 })
  }
}
