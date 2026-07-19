import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DriverAttributionClient } from './DriverAttributionClient'

export const metadata = { title: 'Atribusi Driver — Scentsored' }

export default async function DriverAttributionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff')
    .select('role')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()

  if (!staff || !['owner', 'admin'].includes(staff.role)) redirect('/')

  const { data: driversRaw } = await supabase
    .from('drivers')
    .select('id, name, fee_value')
    .eq('active', true)
    .order('name')

  const drivers = (driversRaw ?? []).map(d => ({
    id:        d.id as string,
    name:      d.name as string,
    fee_value: d.fee_value as number,
  }))

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <DriverAttributionClient drivers={drivers} />
    </div>
  )
}
