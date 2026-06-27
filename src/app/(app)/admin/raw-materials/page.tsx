import { createClient } from '@/lib/supabase/server'
import { RawMaterialsClient } from './RawMaterialsClient'

export const metadata = { title: 'Bahan Baku — Scentsored' }

export default async function RawMaterialsPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('raw_materials').select('*').order('name')
  return <RawMaterialsClient initialData={data ?? []} />
}
