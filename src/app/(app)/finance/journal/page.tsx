import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { JournalClient } from './JournalClient'

export const metadata = { title: 'Jurnal Umum — Finance' }

export default async function JournalPage({
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

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/v1/finance/journal?branch_id=${branchId}&from=${from}&to=${to}`,
    { cache: 'no-store', headers: { cookie: '' } }
  ).catch(() => null)

  // Fallback: fetch server-side directly
  const [incRes, expRes] = await Promise.all([
    (supabase as any)
      .from('finance_income').select('*')
      .eq('branch_id', branchId).gte('date', from).lte('date', to)
      .order('date', { ascending: true }),
    (supabase as any)
      .from('finance_expenses').select('*')
      .eq('branch_id', branchId).gte('date', from).lte('date', to)
      .order('date', { ascending: true }).order('created_at', { ascending: true }),
  ])

  return (
    <JournalClient
      branchId={branchId}
      branches={branches ?? []}
      incomes={incRes.data ?? []}
      expenses={expRes.data ?? []}
      from={from}
      to={to}
    />
  )
}
