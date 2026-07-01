import { createClient }  from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import { PayslipsClient } from './PayslipsClient'

export const metadata = { title: 'Slip Gaji — Scentsored' }

export default async function PayslipsPage() {
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
    <PayslipsClient
      staffId={staff?.id ?? ''}
      staffRole={staff?.role ?? 'cashier'}
    />
  )
}
