import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SlotsClient } from './SlotsClient'

export const metadata = { title: 'Kelola Slot Booking — Scentsored' }

export default async function SlotsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) redirect('/login')
  if (!['owner', 'admin'].includes(staff.role)) redirect('/dashboard')

  const { data: branches } = await supabase.from('branches').select('id, name').eq('active', true).order('name')
  const defaultBranch = staff.branch_id ?? branches?.[0]?.id ?? null

  return <SlotsClient branches={branches ?? []} defaultBranchId={defaultBranch} />
}
