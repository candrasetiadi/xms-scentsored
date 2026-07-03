import { createClient }              from '@/lib/supabase/server'
import { redirect }                  from 'next/navigation'
import { VendorPayrollDetailClient } from './VendorPayrollDetailClient'

export const metadata = { title: 'Detail Penggajian Vendor — Scentsored' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function VendorPayrollDetailPage({ params }: Props) {
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
    .from('vendor_payroll_runs')
    .select('id, period_month, period_year, status, total_amount, branch_id, branches(name)')
    .eq('id', id)
    .single()

  if (!run) redirect('/hr/vendor-payroll')

  return (
    <VendorPayrollDetailClient
      runId={id}
      month={(run as any).period_month}
      year={(run as any).period_year}
      status={(run as any).status}
      totalAmount={(run as any).total_amount ?? 0}
      branchName={(run as any).branches?.name ?? ''}
    />
  )
}
