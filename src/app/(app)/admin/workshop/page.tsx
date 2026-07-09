import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect }          from 'next/navigation'
import { WorkshopAdminClient } from './WorkshopAdminClient'

export default async function WorkshopAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: staff } = await admin
    .from('staff').select('id')
    .eq('auth_user_id', user.id).eq('active', true).single()

  if (!staff) redirect('/dashboard')

  // Fetch data server-side via admin client (bypass RLS)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (admin as any)
    .from('workshop_formulations')
    .select(`
      id, access_token, perfume_name, status, total_grams, created_at,
      customers!workshop_formulations_customer_id_fkey(name, phone),
      consultation_slots!workshop_formulations_slot_id_fkey(date),
      workshop_formulation_items(id)
    `)
    .order('created_at', { ascending: false })

  return (
    <WorkshopAdminClient
      initialRows={rows ?? []}
    />
  )
}
