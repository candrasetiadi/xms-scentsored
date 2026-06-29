import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ReportingClient } from './ReportingClient'

export const metadata = { title: 'Laporan — Scentsored' }

export default async function ReportingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) redirect('/login')
  if (!['owner', 'admin'].includes(staff.role)) redirect('/dashboard')

  const { data: branches } = await supabase.from('branches').select('id, name').order('name')

  const defaultBranch = staff.branch_id ?? branches?.[0]?.id ?? null

  return (
    <ReportingClient
      staffRole={staff.role}
      defaultBranchId={defaultBranch}
      branches={branches ?? []}
    />
  )
}
