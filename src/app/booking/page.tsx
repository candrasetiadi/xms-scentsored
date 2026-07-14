import { createClient } from '@/lib/supabase/server'
import { BookingClient } from './BookingClient'

export const metadata = {
  title:       'Raw Mat Experience — Scentsored',
  description: 'Booking sesi Raw Mat Experience bersama Scentsored.',
}

export default async function BookingPage() {
  const supabase = await createClient()
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('active', true)
    .order('name')

  return <BookingClient branches={branches ?? []} />
}
