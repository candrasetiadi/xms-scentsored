import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ExpensesClient } from './ExpensesClient'
import { EXP_TYPE_LABEL } from '@/lib/finance-constants'

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  return { title: `${EXP_TYPE_LABEL[type] ?? 'Pengeluaran'} — Finance` }
}

export default async function ExpensesPage({
  params,
  searchParams,
}: {
  params:       Promise<{ type: string }>
  searchParams: Promise<{ branch?: string; from?: string; to?: string }>
}) {
  const { type } = await params
  if (!['toko', 'bahan', 'vendor'].includes(type)) redirect('/finance/expenses/toko')

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

  const { data: rows } = await (supabase as any)
    .from('finance_expenses')
    .select('*')
    .eq('branch_id', branchId)
    .eq('type', type)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <ExpensesClient
      type={type as 'toko' | 'bahan' | 'vendor'}
      branchId={branchId}
      branches={branches ?? []}
      rows={rows ?? []}
      from={from}
      to={to}
      today={today}
    />
  )
}
