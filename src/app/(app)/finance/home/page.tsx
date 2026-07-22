import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FinanceHomeClient } from './FinanceHomeClient'

export const metadata = { title: 'Beranda Finance — Scentsored' }

export default async function FinanceHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await (supabase as any)
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role)) redirect('/dashboard')

  const { data: branches } = staff.role === 'owner'
    ? await (supabase as any).from('branches').select('id, name').eq('active', true).order('name')
    : { data: null }

  const branchId = staff.branch_id ?? branches?.[0]?.id
  if (!branchId) redirect('/dashboard')

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  const firstOfMonth = today.slice(0, 8) + '01'

  const [incRes, expRes] = await Promise.all([
    (supabase as any)
      .from('finance_income')
      .select('gopay, bca, mandiri, cash, date, note')
      .eq('branch_id', branchId)
      .gte('date', firstOfMonth)
      .lte('date', today)
      .order('date', { ascending: false }),
    (supabase as any)
      .from('finance_expenses')
      .select('type, amount, method, date')
      .eq('branch_id', branchId)
      .gte('date', firstOfMonth)
      .lte('date', today),
  ])

  const incomes   = incRes.data  ?? []
  const expenses  = expRes.data  ?? []
  const todayInc  = incomes.find((x: any) => x.date === today)
  const todayExps = expenses.filter((x: any) => x.date === today)

  const totalIncome  = incomes.reduce((s: number, x: any) => s + +x.gopay + +x.bca + +x.mandiri + +x.cash, 0)
  const totalExpense = expenses.reduce((s: number, x: any) => s + +x.amount, 0)

  return (
    <FinanceHomeClient
      today={today}
      branchId={branchId}
      branches={branches ?? []}
      todayIncome={todayInc ?? null}
      todayExpenses={todayExps}
      totalIncome={totalIncome}
      totalExpense={totalExpense}
      net={totalIncome - totalExpense}
      monthLabel={new Date(firstOfMonth + 'T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
    />
  )
}
