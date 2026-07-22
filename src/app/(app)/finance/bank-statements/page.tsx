import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BankStatementsClient } from './BankStatementsClient'

export const metadata = { title: 'Rekening Koran — Finance' }

export default async function BankStatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; rekening?: string; from?: string; to?: string }>
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
  const from  = p.from     ?? today.slice(0, 8) + '01'
  const to    = p.to       ?? today
  const rek   = p.rekening ?? ''

  let q = (supabase as any)
    .from('finance_bank_statements')
    .select('*')
    .eq('branch_id', branchId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (rek) q = q.eq('rekening', rek)

  const { data: rows } = await q

  return (
    <BankStatementsClient
      branchId={branchId}
      branches={branches ?? []}
      rows={rows ?? []}
      from={from}
      to={to}
      rekeningFilter={rek}
      today={today}
    />
  )
}
