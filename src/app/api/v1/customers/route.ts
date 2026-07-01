import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/v1/customers?q=&limit=8
// Search existing customers by name or phone (case-insensitive).
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user)
    return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q     = (searchParams.get('q') ?? '').trim()
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '8'), 20)

  if (q.length < 2)
    return NextResponse.json({ data: [] })

  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone')
    .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
    .order('name')
    .limit(limit)

  if (error)
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}
