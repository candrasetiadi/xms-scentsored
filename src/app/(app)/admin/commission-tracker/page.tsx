import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CommissionTrackerClient } from './CommissionTrackerClient'

export const metadata = { title: 'Commission Tracker — Scentsored' }

export default async function CommissionTrackerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await (supabase as any)
    .from('staff')
    .select('role, can_access_commission')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()

  const isManager = staff && ['owner', 'admin'].includes(staff.role as string)
  const hasCommissionAccess = staff && (staff as any).can_access_commission
  if (!isManager && !hasCommissionAccess) redirect('/')

  const [driversResult, companiesResult] = await Promise.all([
    (supabase as any)
      .from('drivers')
      .select('id, name, fee_value, fee_type, active, company_id')
      .eq('active', true)
      .order('name'),
    (supabase as any)
      .from('driver_companies')
      .select('id, name, fee_value, is_active')
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <CommissionTrackerClient
      drivers={(driversResult.data ?? []) as { id: string; name: string; fee_value: number; fee_type: string; active: boolean; company_id: string | null }[]}
      companies={(companiesResult.data ?? []) as { id: string; name: string; fee_value: number }[]}
    />
  )
}
