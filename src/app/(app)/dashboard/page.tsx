import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardClient } from './DashboardClient'

export const metadata = { title: 'Dashboard — Scentsored' }

export default async function DashboardPage() {
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
    <DashboardClient
      staffId={staff?.id ?? null}
      staffName={staff?.name ?? 'Tamu'}
      staffRole={staff?.role ?? 'cashier'}
      branchId={staff?.branch_id ?? null}
    />
  )
}
