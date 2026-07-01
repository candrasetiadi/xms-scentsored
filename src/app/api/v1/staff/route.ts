import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/v1/staff?branch_id=<uuid>&active=true
// Dipakai POS untuk populate dropdown PIC/Sales picker.
// Semua role yang terautentikasi boleh mengakses.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const branchId  = searchParams.get('branch_id')
  const activeRaw = searchParams.get('active')

  if (!branchId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'branch_id wajib.' } },
      { status: 400 }
    )
  }

  // Verifikasi akses cabang sebelum query data
  const { data: canAccess } = await supabase.rpc('in_branch', { p_branch_id: branchId })
  if (!canAccess) return NextResponse.json({ error: { code: 'FORBIDDEN_BRANCH' } }, { status: 403 })

  // Default: hanya tampilkan staff aktif kecuali active=false eksplisit
  const filterActive = activeRaw !== 'false'

  let query = supabase
    .from('staff')
    .select('id, name, role')
    .eq('branch_id', branchId)
    .order('name', { ascending: true })

  if (filterActive) {
    query = query.eq('active', true)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  return NextResponse.json({ data })
}
