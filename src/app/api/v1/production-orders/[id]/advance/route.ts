import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import type { AdvanceProductionResult } from '@/types/database'

type AdvanceBody = {
  status: 'diracik' | 'packing' | 'selesai' | 'diambil'
}

const VALID_STATUSES = new Set<string>(['diracik', 'packing', 'selesai', 'diambil'])

// POST /api/v1/production-orders/[id]/advance
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth: gunakan SSR client untuk verifikasi user & staff
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

  if (!['owner', 'admin', 'perfumer'].includes(staff.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Hanya perfumer, admin, atau owner yang dapat mengubah status produksi.' } },
      { status: 403 },
    )
  }

  // Validasi body
  let body: AdvanceBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'Body tidak valid.' } },
      { status: 400 },
    )
  }

  if (!body.status || !VALID_STATUSES.has(body.status)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'status harus salah satu dari: diracik, packing, selesai, diambil.' } },
      { status: 400 },
    )
  }

  const { id: productionOrderId } = await params

  // Admin client untuk RPC SECURITY DEFINER — agar consume_raw_material_fifo
  // bisa bypass RLS pada raw_material_batches & stock_movements.
  const adminClient = createAdminClient()

  const { data, error } = await adminClient.rpc('advance_production_status', {
    p_production_order_id: productionOrderId,
    p_new_status:          body.status,
    p_staff_id:            staff.id,
  })

  if (error) {
    const msg = error.message ?? ''

    // Status transition tidak valid atau record tidak ditemukan
    if (msg.includes('tidak valid') || msg.includes('tidak ditemukan')) {
      return NextResponse.json(
        { error: { code: 'UNPROCESSABLE', message: msg } },
        { status: 422 },
      )
    }

    // Stok bahan baku tidak mencukupi (FIFO consume gagal)
    if (msg.includes('stok') || msg.includes('FIFO') || msg.includes('tidak cukup')) {
      return NextResponse.json(
        { error: { code: 'INSUFFICIENT_STOCK', message: `Stok bahan baku tidak mencukupi: ${msg}` } },
        { status: 422 },
      )
    }

    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: msg } },
      { status: 500 },
    )
  }

  return NextResponse.json({ data: data as AdvanceProductionResult })
}
