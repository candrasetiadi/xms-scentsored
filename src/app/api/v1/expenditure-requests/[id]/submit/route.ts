import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/v1/expenditure-requests/[id]/submit
// Draft → Pending + kirim notifikasi ke owner
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

    const { id } = await params

    const { error } = await (supabase as any).rpc('submit_expenditure_request', { p_request_id: id })
    if (error) {
      return NextResponse.json({ error: { code: 'RPC_ERROR', message: error.message } }, { status: 400 })
    }

    return NextResponse.json({ data: { success: true } })
  } catch (err) {
    console.error('[expenditure-requests/:id/submit]', err)
    return NextResponse.json({ error: { code: 'INTERNAL' } }, { status: 500 })
  }
}
