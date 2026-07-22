import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH /api/v1/orders/:id/items/:itemId/pic — update PIC per item
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { itemId } = await params
  const body = await request.json().catch(() => ({}))
  const pic_staff_id: string | null = body.pic_staff_id ?? null

  const { data, error } = await (supabase as any).rpc('update_order_item_pic', {
    p_item_id:      itemId,
    p_pic_staff_id: pic_staff_id,
  })

  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 })

  return NextResponse.json({ data })
}
