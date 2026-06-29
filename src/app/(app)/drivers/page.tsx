import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DriversClient } from './DriversClient'

export const metadata = { title: 'Driver & Fee — Scentsored' }

export default async function DriversPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff').select('id, role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) redirect('/login')
  if (!['owner', 'admin'].includes(staff.role)) redirect('/dashboard')

  return <DriversClient staffRole={staff.role} />
}
