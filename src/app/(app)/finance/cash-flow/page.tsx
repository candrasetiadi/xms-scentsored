import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CashFlowClient } from './CashFlowClient'

export const metadata = { title: 'Laporan Arus Kas — Finance' }

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await (supabase as any)
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role)) redirect('/dashboard')

  const { data: branches } = staff.role === 'owner'
    ? await (supabase as any).from('branches').select('id, name').eq('active', true).order('name')
    : { data: null }

  const p        = await searchParams
  const branchId = p.branch ?? staff.branch_id ?? branches?.[0]?.id
  if (!branchId) redirect('/dashboard')

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  const from  = p.from ?? today.slice(0, 8) + '01'
  const to    = p.to   ?? today

  const [incRes, expRes] = await Promise.all([
    (supabase as any)
      .from('finance_income').select('gopay, bca, mandiri, cash')
      .eq('branch_id', branchId).gte('date', from).lte('date', to),
    (supabase as any)
      .from('finance_expenses').select('type, amount, method')
      .eq('branch_id', branchId).gte('date', from).lte('date', to),
  ])

  const incomes  = incRes.data  ?? []
  const expenses = expRes.data  ?? []

  const masuk = { Gopay: 0, 'Bank BCA': 0, 'Bank Mandiri': 0, Cash: 0 }
  for (const x of incomes) {
    masuk['Gopay']        += +x.gopay
    masuk['Bank BCA']     += +x.bca
    masuk['Bank Mandiri'] += +x.mandiri
    masuk['Cash']         += +x.cash
  }
  const totalMasuk = Object.values(masuk).reduce((s, v) => s + v, 0)

  const keluar: Record<string, number> = { toko: 0, bahan: 0, vendor: 0 }
  const keluarByMethod: Record<string, number> = {}
  for (const x of expenses) {
    keluar[x.type] = (keluar[x.type] ?? 0) + +x.amount
    keluarByMethod[x.method] = (keluarByMethod[x.method] ?? 0) + +x.amount
  }
  const totalKeluar = Object.values(keluar).reduce((s, v) => s + v, 0)

  return (
    <CashFlowClient
      branchId={branchId}
      branches={branches ?? []}
      masuk={masuk}
      totalMasuk={totalMasuk}
      keluar={keluar}
      keluarByMethod={keluarByMethod}
      totalKeluar={totalKeluar}
      net={totalMasuk - totalKeluar}
      from={from}
      to={to}
    />
  )
}
