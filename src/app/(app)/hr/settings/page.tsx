import { createClient }    from '@/lib/supabase/server'
import { redirect }        from 'next/navigation'
import { HrSettingsClient } from './HrSettingsClient'

export const metadata = { title: 'Pengaturan SDM — Scentsored' }

export default async function HrSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff')
    .select('id, role, branch_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()

  if (!['owner', 'admin'].includes(staff?.role ?? '')) {
    redirect('/hr/attendance')
  }

  const { data: branches } = await supabase.from('branches').select('id, name').order('name')

  return (
    <HrSettingsClient
      staffRole={staff?.role ?? 'admin'}
      branchId={staff?.branch_id ?? null}
      branches={branches ?? []}
    />
  )
}
