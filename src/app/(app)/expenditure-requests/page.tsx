import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ExpenditureListClient } from './ExpenditureListClient'

export default async function ExpenditureRequestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff')
    .select('id, name, role, branch_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()

  if (!staff) redirect('/login')

  return (
    <ExpenditureListClient
      staffId={staff.id}
      staffRole={staff.role}
    />
  )
}
