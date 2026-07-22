import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/v1/finance/cash-flow?branch_id=&from=&to=
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const sp       = new URL(request.url).searchParams
  const branchId = sp.get('branch_id')
  const from     = sp.get('from')
  const to       = sp.get('to')

  if (!branchId) return NextResponse.json({ error: { code: 'MISSING_BRANCH' } }, { status: 400 })

  const [incRes, expRes] = await Promise.all([
    (supabase as any)
      .from('finance_income')
      .select('gopay, bca, mandiri, cash')
      .eq('branch_id', branchId)
      .gte('date', from ?? '1970-01-01')
      .lte('date', to   ?? '9999-12-31'),
    (supabase as any)
      .from('finance_expenses')
      .select('type, amount, method')
      .eq('branch_id', branchId)
      .gte('date', from ?? '1970-01-01')
      .lte('date', to   ?? '9999-12-31'),
  ])

  if (incRes.error) return NextResponse.json({ error: { message: incRes.error.message } }, { status: 500 })
  if (expRes.error) return NextResponse.json({ error: { message: expRes.error.message } }, { status: 500 })

  // Aggregate income by channel
  const masuk = { Gopay: 0, 'Bank BCA': 0, 'Bank Mandiri': 0, Cash: 0 }
  for (const x of incRes.data ?? []) {
    masuk['Gopay']        += +x.gopay
    masuk['Bank BCA']     += +x.bca
    masuk['Bank Mandiri'] += +x.mandiri
    masuk['Cash']         += +x.cash
  }
  const totalMasuk = Object.values(masuk).reduce((s, v) => s + v, 0)

  // Aggregate expenses by type
  const keluar = { toko: 0, bahan: 0, vendor: 0 }
  const keluarByMethod: Record<string, number> = {}
  for (const x of expRes.data ?? []) {
    keluar[x.type as keyof typeof keluar] = (keluar[x.type as keyof typeof keluar] ?? 0) + +x.amount
    keluarByMethod[x.method] = (keluarByMethod[x.method] ?? 0) + +x.amount
  }
  const totalKeluar = Object.values(keluar).reduce((s, v) => s + v, 0)

  return NextResponse.json({
    data: {
      masuk,
      total_masuk:   totalMasuk,
      keluar,
      keluar_by_method: keluarByMethod,
      total_keluar:  totalKeluar,
      net:           totalMasuk - totalKeluar,
    }
  })
}
