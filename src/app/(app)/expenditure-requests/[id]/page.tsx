import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ExpenditureDetailClient } from './ExpenditureDetailClient'

export default async function ExpenditureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff').select('id, role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) redirect('/login')

  const { id } = await params

  return <ExpenditureDetailClient requestId={id} staffRole={staff.role} staffId={staff.id} />
}
