import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { IncomeClient } from './IncomeClient'

export const metadata = { title: 'Pendapatan — Finance' }

export default async function IncomePage({
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

  const params    = await searchParams
  const branchId  = params.branch ?? staff.branch_id ?? branches?.[0]?.id
  if (!branchId) redirect('/dashboard')

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  const from  = params.from ?? today.slice(0, 8) + '01'
  const to    = params.to   ?? today

  const { data: rows } = await (supabase as any)
    .from('finance_income')
    .select('*')
    .eq('branch_id', branchId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })

  return (
    <IncomeClient
      branchId={branchId}
      branches={branches ?? []}
      rows={rows ?? []}
      from={from}
      to={to}
      today={today}
    />
  )
}
