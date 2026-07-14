import { WorkshopFormClient } from './WorkshopFormClient'

export const metadata = {
  title: 'Raw Mat Experience — Scentsored',
}

export default async function WorkshopPage({
  searchParams,
}: {
  searchParams: Promise<{ slot_id?: string; edit?: string }>
}) {
  const { slot_id, edit } = await searchParams
  return <WorkshopFormClient initialSlotId={slot_id ?? null} editToken={edit ?? null} />
}
