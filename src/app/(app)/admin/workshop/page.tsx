import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { WorkshopAdminClient } from './WorkshopAdminClient'

export default async function WorkshopAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff').select('id')
    .eq('auth_user_id', user.id).eq('active', true).single()

  if (!staff) redirect('/dashboard')

  const { data: branches } = await supabase
    .from('branches').select('id, name').order('name')

  return (
    <WorkshopAdminClient
      branches={branches ?? []}
    />
  )
}
