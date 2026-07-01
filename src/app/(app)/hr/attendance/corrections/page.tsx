import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { CorrectionsClient } from './CorrectionsClient'

export const metadata = { title: 'Koreksi Absensi — Scentsored' }

export default async function CorrectionsPage() {
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
    <CorrectionsClient
      staffId={staff?.id ?? ''}
      staffRole={staff?.role ?? 'cashier'}
      branchId={staff?.branch_id ?? null}
    />
  )
}
