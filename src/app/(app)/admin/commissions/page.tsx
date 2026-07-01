import { createClient } from '@/lib/supabase/server'
import { CommissionsClient } from './CommissionsClient'

export const metadata = { title: 'Komisi Driver — Scentsored' }

export default async function CommissionsPage() {
  const supabase = await createClient()
  const [{ data: drivers }, { data: agencies }] = await Promise.all([
    supabase.from('drivers').select('id, name, travel_agency_id').eq('active', true).order('name'),
    supabase.from('travel_agencies').select('id, name, fee_value').eq('active', true).order('name'),
  ])
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <CommissionsClient drivers={drivers ?? []} agencies={agencies ?? []} />
    </div>
  )
}
