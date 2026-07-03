import { createClient } from '@/lib/supabase/server'
import { WorkshopFormClient } from './WorkshopFormClient'

export const metadata = {
  title: 'Formulasi Parfum — Workshop Scentsored',
}

interface SlotInfo {
  date: string
  start_time: string
  end_time: string
}

export default async function WorkshopPage({
  searchParams,
}: {
  searchParams: Promise<{ slot_id?: string }>
}) {
  const { slot_id } = await searchParams

  let slotInfo: SlotInfo | null = null

  if (slot_id) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('workshop_slots')
      .select('date, start_time, end_time')
      .eq('id', slot_id)
      .single()
    slotInfo = data ?? null
  }

  return <WorkshopFormClient slotId={slot_id ?? null} slotInfo={slotInfo} />
}
