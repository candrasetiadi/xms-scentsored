import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WorkshopMaterialsClient } from './WorkshopMaterialsClient'

export const metadata = { title: 'Bahan Workshop — Scentsored' }

export default async function WorkshopMaterialsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role)) redirect('/dashboard')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [{ data: materials }, { data: categories }] = await Promise.all([
    db.from('workshop_materials')
      .select('id, name, dilution_percentage, category_id, stock_gram, active, scent_categories(id, name, color_hex, sort_order)')
      .order('name'),
    db.from('scent_categories').select('id, name, color_hex, sort_order').order('sort_order'),
  ])

  return (
    <WorkshopMaterialsClient
      initialData={materials ?? []}
      categories={categories ?? []}
    />
  )
}
