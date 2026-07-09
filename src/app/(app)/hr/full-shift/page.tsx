import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { FullShiftClient } from './FullShiftClient'

export const metadata = { title: 'Full Shift — Scentsored SDM' }

export default async function FullShiftPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff')
    .select('role')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()

  if (!staff || (staff.role !== 'owner' && staff.role !== 'admin')) redirect('/hr')

  return <FullShiftClient />
}
