import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { AttendanceClient } from './AttendanceClient'

export const metadata = { title: 'Kehadiran — Scentsored SDM' }

export default async function AttendancePage() {
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
    <AttendanceClient
      staffId={staff?.id ?? ''}
      staffName={staff?.name ?? ''}
      staffRole={staff?.role ?? 'cashier'}
    />
  )
}
