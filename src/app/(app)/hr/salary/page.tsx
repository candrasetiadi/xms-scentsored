import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { SalaryClient } from './SalaryClient'

export const metadata = { title: 'Komponen Gaji — Scentsored' }

export default async function SalaryPage() {
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

  return (
    <SalaryClient
      staffRole={staff?.role ?? 'admin'}
      branchId={staff?.branch_id ?? null}
    />
  )
}
