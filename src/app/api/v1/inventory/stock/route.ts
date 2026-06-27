import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { RawStockRow } from '@/types/database'

// GET /api/v1/inventory/stock?branch_id=<uuid>&type=raw_material|product
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branch_id')
  const type     = searchParams.get('type') ?? 'raw_material'

  if (!branchId) {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'branch_id wajib diisi.' } }, { status: 400 })
  }

  // Verifikasi akses ke cabang
  const { data: canAccess } = await supabase.rpc('in_branch', { p_branch_id: branchId })
  if (!canAccess) {
    return NextResponse.json({ error: { code: 'FORBIDDEN_BRANCH' } }, { status: 403 })
  }

  if (type === 'raw_material') {
    const { data, error } = await supabase.rpc('get_branch_raw_stock', { p_branch_id: branchId })
    if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
    return NextResponse.json({ data: data as RawStockRow[] })
  }

  if (type === 'product') {
    const { data, error } = await supabase
      .from('product_stock')
      .select('product_id, current_stock, updated_at')
      .eq('branch_id', branchId)
    if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
    return NextResponse.json({ data })
  }

  return NextResponse.json({ error: { code: 'VALIDATION', message: 'type harus raw_material atau product.' } }, { status: 400 })
}
