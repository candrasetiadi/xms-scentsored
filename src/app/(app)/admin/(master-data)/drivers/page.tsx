import { createClient } from '@/lib/supabase/server'
import { DriversClient } from './DriversClient'

export const metadata = { title: 'Driver — Scentsored' }

export default async function DriversPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('drivers').select('*').order('name')
  return <DriversClient initialData={data ?? []} />
}
