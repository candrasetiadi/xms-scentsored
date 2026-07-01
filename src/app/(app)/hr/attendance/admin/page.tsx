import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { AttendanceAdminClient } from './AttendanceAdminClient'

export const metadata = { title: 'Rekap Absensi — Scentsored SDM' }

export default async function AttendanceAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff')
    .select('role, branch_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()

  if (!['owner', 'admin'].includes(staff?.role ?? '')) {
    redirect('/hr/attendance')
  }

  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .order('name')

  return (
    <AttendanceAdminClient
      branches={branches ?? []}
      defaultBranchId={staff?.branch_id ?? null}
      role={staff?.role ?? 'admin'}
    />
  )
}
