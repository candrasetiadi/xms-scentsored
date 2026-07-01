import { createClient } from '@/lib/supabase/server'
import { DriversClient } from './DriversClient'

export const metadata = { title: 'Driver — Scentsored' }

export default async function DriversPage() {
  const supabase = await createClient()
  const [{ data: drivers }, { data: agencies }] = await Promise.all([
    supabase.from('drivers').select('*').order('name'),
    supabase.from('travel_agencies').select('id, name').eq('active', true).order('name'),
  ])
  return <DriversClient initialData={drivers ?? []} agencies={agencies ?? []} />
}
