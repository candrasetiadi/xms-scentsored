import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { LeaveClient }  from './LeaveClient'

export const metadata = { title: 'Cuti — Scentsored' }

export default async function LeavePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff')
    .select('id, name, role, branch_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()

  return (
    <LeaveClient
      staffId={staff?.id ?? ''}
      staffRole={staff?.role ?? 'cashier'}
      branchId={staff?.branch_id ?? null}
    />
  )
}
