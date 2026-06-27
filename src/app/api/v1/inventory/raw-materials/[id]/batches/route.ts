import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/v1/inventory/raw-materials/:id/batches?branch_id=<uuid>
// Daftar batch FIFO untuk satu bahan baku di satu cabang, urut received_at ASC
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { id: rawMaterialId } = await params
  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branch_id')

  if (!branchId) {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'branch_id wajib diisi.' } }, { status: 400 })
  }

  const { data: canAccess } = await supabase.rpc('in_branch', { p_branch_id: branchId })
  if (!canAccess) return NextResponse.json({ error: { code: 'FORBIDDEN_BRANCH' } }, { status: 403 })

  const { data, error } = await supabase
    .from('raw_material_batches')
    .select('id, qty_received, qty_remaining, unit_cost, received_at, po_item_id')
    .eq('branch_id', branchId)
    .eq('raw_material_id', rawMaterialId)
    .order('received_at', { ascending: true })

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  return NextResponse.json({ data })
}
