import { createClient } from '@/lib/supabase/server'
import { BookingClient } from './BookingClient'

export const metadata = {
  title:       'Booking Konsultasi — Scentsored',
  description: 'Booking sesi konsultasi racik parfum personal bersama Scentsored.',
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
