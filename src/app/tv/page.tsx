import { TvClient } from './TvClient'

export const metadata = { title: 'Antrian Produksi — Scentsored' }

export default async function TvPage({
  searchParams,
}: {
  searchParams: Promise<{ branch_id?: string }>
}) {
  const { branch_id } = await searchParams

  return <TvClient branchId={branch_id ?? null} />
}
