import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { KanbanClient } from './KanbanClient'

export const metadata = { title: 'Produksi — Scentsored' }

export default async function ProductionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff')
    .select('id, role, branch_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()

  if (!staff) redirect('/login')
  if (!['owner', 'admin', 'perfumer'].includes(staff.role)) redirect('/dashboard')

  const { data: branches } = (staff.role === 'owner' || staff.role === 'admin')
    ? await supabase.from('branches').select('id, name').eq('active', true).order('name')
    : { data: null }

  const branchId = staff.branch_id ?? branches?.[0]?.id ?? null
  if (!branchId) redirect('/dashboard')

  return (
    <KanbanClient
      staffId={staff.id}
      staffRole={staff.role}
      initialBranchId={branchId}
      branches={branches ?? []}
    />
  )
}
