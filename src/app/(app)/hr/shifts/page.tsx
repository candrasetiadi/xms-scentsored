import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { ShiftsClient } from './ShiftsClient'

export const metadata = { title: 'Shift & Jadwal — Scentsored' }

export default async function ShiftsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff')
    .select('id, role, branch_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()

  if (!['owner', 'admin'].includes(staff?.role ?? '')) {
    redirect('/hr/attendance')
  }

  const { data: branches } = await supabase.from('branches').select('id, name').order('name')

  return (
    <ShiftsClient
      staffRole={staff?.role ?? 'admin'}
      branchId={staff?.branch_id ?? null}
      branches={branches ?? []}
    />
  )
}
