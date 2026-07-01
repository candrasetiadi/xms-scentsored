import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function currentMonthRange(): { from: string; to: string } {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() // 0-based
  const from  = new Date(year, month, 1)
  const to    = new Date(year, month + 1, 0) // last day of current month
  const fmt   = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(from), to: fmt(to) }
}

// GET /api/v1/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD&branch_id=<uuid>
// Hanya owner atau admin. Memanggil RPC get_dashboard_stats.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  if (!['owner', 'admin'].includes(staff.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Hanya owner atau admin yang dapat mengakses dashboard.' } },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const defaults = currentMonthRange()

  const fromParam = searchParams.get('from') ?? defaults.from
  const toParam   = searchParams.get('to')   ?? defaults.to

  if (!DATE_RE.test(fromParam) || isNaN(Date.parse(fromParam))) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'Parameter from harus format YYYY-MM-DD.' } },
      { status: 400 }
    )
  }
  if (!DATE_RE.test(toParam) || isNaN(Date.parse(toParam))) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'Parameter to harus format YYYY-MM-DD.' } },
      { status: 400 }
    )
  }
  if (fromParam > toParam) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'Parameter from tidak boleh lebih besar dari to.' } },
      { status: 400 }
    )
  }

  // Tentukan p_branch_id:
  // - Jika query param branch_id dikirim, gunakan itu.
  // - Jika tidak dikirim, gunakan staff.branch_id (null untuk owner/admin lintas cabang).
  const branchIdParam = searchParams.get('branch_id')
  const pBranchId: string | null = branchIdParam ?? staff.branch_id ?? null

  const { data, error } = await supabase.rpc('get_dashboard_stats', {
    p_branch_id: pBranchId,
    p_from:      fromParam,
    p_to:        toParam,
  })

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  return NextResponse.json({ data })
}
