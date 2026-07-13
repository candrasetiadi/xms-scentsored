import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ExpenditureFormClient } from './ExpenditureFormClient'

export default async function NewExpenditureRequestPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff').select('id, role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) redirect('/login')

  return <ExpenditureFormClient />
}
