import { WorkshopFormClient } from './WorkshopFormClient'

export const metadata = {
  title: 'Formulasi Parfum — Workshop Scentsored',
}

export default async function WorkshopPage({
  searchParams,
}: {
  searchParams: Promise<{ slot_id?: string }>
}) {
  const { slot_id } = await searchParams
  return <WorkshopFormClient initialSlotId={slot_id ?? null} />
}
