import { createClient } from '@/lib/supabase/server'
import { TravelAgenciesClient } from './TravelAgenciesClient'

export const metadata = { title: 'Perusahaan / Travel Agent — Scentsored' }

export default async function TravelAgenciesPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('travel_agencies').select('*').order('name')
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-[28px] text-pine">Perusahaan / Travel Agent</h1>
        <p className="text-sm text-ink-500 mt-1">Daftarkan perusahaan yang mengirim driver. Komisi perusahaan dihitung otomatis saat transaksi.</p>
      </div>
      <TravelAgenciesClient initialData={data ?? []} />
    </div>
  )
}
