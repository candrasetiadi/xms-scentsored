import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST /api/v1/inventory/batches
// M3 dasar: input batch manual tanpa PO (untuk bootstrap stok awal)
// Role: stock_keeper, admin, owner (harus berada di cabang yang dimaksud)
export async function POST(request: Request) {
  const supabase      = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  // Cek role
  const { data: staff } = await supabase
    .from('staff')
    .select('id, role, branch_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()

  if (!staff || !['owner', 'admin', 'stock_keeper'].includes(staff.role)) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Hanya stock keeper, admin, atau owner.' } }, { status: 403 })
  }

  const body = await request.json() as {
    branch_id: string
    raw_material_id: string
    qty_received: number
    unit_cost: number
    received_at?: string
    notes?: string
  }

  const { branch_id, raw_material_id, qty_received, unit_cost, received_at, notes } = body

  if (!branch_id || !raw_material_id || !qty_received || qty_received <= 0) {
    return NextResponse.json({
      error: { code: 'VALIDATION', message: 'branch_id, raw_material_id, dan qty_received > 0 wajib diisi.' }
    }, { status: 400 })
  }
  if (unit_cost == null || unit_cost < 0) {
    return NextResponse.json({
      error: { code: 'VALIDATION', message: 'unit_cost harus >= 0.' }
    }, { status: 400 })
  }

  // Verifikasi akses ke cabang
  const { data: canAccess } = await supabase.rpc('in_branch', { p_branch_id: branch_id })
  if (!canAccess) {
    return NextResponse.json({ error: { code: 'FORBIDDEN_BRANCH' } }, { status: 403 })
  }

  // Gunakan admin client agar bisa bypass RLS untuk insert batch + movement secara atomik
  const batchPayload = {
    branch_id,
    raw_material_id,
    qty_received,
    qty_remaining: qty_received,   // batch baru: qty_remaining = qty_received
    unit_cost,
    received_at: received_at ?? new Date().toISOString(),
  }

  const { data: batch, error: batchErr } = await adminSupabase
    .from('raw_material_batches')
    .insert(batchPayload)
    .select()
    .single()

  if (batchErr) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: batchErr.message } }, { status: 500 })
  }

  // Catat movement purchase_in
  const { error: movErr } = await adminSupabase.from('stock_movements').insert({
    branch_id,
    item_type:      'raw_material',
    item_id:        raw_material_id,
    batch_id:       batch.id,
    qty_change:     qty_received,
    unit_cost,
    movement_type:  'purchase_in',
    reference_type: 'raw_material_batches',
    reference_id:   batch.id,
    notes:          notes ?? 'Input manual',
    created_by:     staff.id,
  })

  if (movErr) {
    // Rollback batch (best effort) — idealnya pakai transaksi DB, tapi Supabase JS tidak support transaksi client-side
    await adminSupabase.from('raw_material_batches').delete().eq('id', batch.id)
    return NextResponse.json({ error: { code: 'DB_ERROR', message: movErr.message } }, { status: 500 })
  }

  return NextResponse.json({ data: batch }, { status: 201 })
}
