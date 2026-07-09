import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StaffClient } from './StaffClient'

export const metadata = { title: 'Karyawan — SDM Scentsored' }

export default async function StaffPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!me || !['owner', 'admin'].includes(me.role)) redirect('/hr')

  const [{ data: staffList }, { data: branches }] = await Promise.all([
    supabase.from('staff').select('id, name, nickname, team, job_title, role, active, branch_id').order('name'),
    supabase.from('branches').select('id, name').eq('active', true).order('name'),
  ])

  return <StaffClient initialStaff={staffList ?? []} branches={branches ?? []} />
}
