import { createAdminClient } from '@/lib/supabase/admin'
import { updateEventDescription } from '@/lib/google-calendar'

export async function syncCalendar(opts: { slotId: string; maxBookings: number }) {
  const admin = createAdminClient()

  const { data: slot, error: slotErr } = await admin
    .from('consultation_slots')
    .select('calendar_event_id, branches!inner(name)')
    .eq('id', opts.slotId)
    .single()

  if (slotErr) { console.error('[Calendar] gagal ambil slot:', slotErr.message); return }
  if (!slot?.calendar_event_id) return

  const { data: bookings } = await admin
    .from('consultation_bookings')
    .select('queue_number, customer_name, customer_phone')
    .eq('slot_id', opts.slotId)
    .eq('status', 'confirmed')
    .order('queue_number')

  await updateEventDescription({
    eventId:     slot.calendar_event_id as string,
    branchName:  ((slot.branches as unknown) as { name: string }).name,
    maxBookings: opts.maxBookings,
    bookings:    (bookings ?? []).map(b => ({
      queueNumber: b.queue_number,
      name:        b.customer_name,
      phone:       b.customer_phone,
    })),
  })

  console.log(`[Calendar] Updated event ${slot.calendar_event_id} (${bookings?.length ?? 0} booking confirmed)`)
}
