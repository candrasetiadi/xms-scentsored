import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { OvertimeClient } from './OvertimeClient'

export const metadata = { title: 'Lembur — Scentsored' }

export default async function OvertimePage() {
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
    <OvertimeClient
      staffId={staff?.id ?? ''}
      staffRole={staff?.role ?? 'cashier'}
    />
  )
}
