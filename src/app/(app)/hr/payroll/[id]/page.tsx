import { createClient }       from '@/lib/supabase/server'
import { redirect }           from 'next/navigation'
import { PayrollDetailClient } from './PayrollDetailClient'

export const metadata = { title: 'Detail Penggajian — Scentsored' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function PayrollDetailPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff')
    .select('role')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()

  if (!['owner', 'admin'].includes(staff?.role ?? '')) {
    redirect('/hr/attendance')
  }

  const { data: run } = await supabase
    .from('payroll_runs')
    .select('id, month, year, status, branch_id, branches(name)')
    .eq('id', id)
    .single()

  if (!run) redirect('/hr/payroll')

  return (
    <PayrollDetailClient
      runId={id}
      month={(run as any).month}
      year={(run as any).year}
      status={(run as any).status}
      branchName={(run as any).branches?.name ?? ''}
    />
  )
}
