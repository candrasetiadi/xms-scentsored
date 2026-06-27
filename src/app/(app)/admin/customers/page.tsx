import { createClient } from '@/lib/supabase/server'
import { CustomersClient } from './CustomersClient'

export const metadata = { title: 'Pelanggan — Scentsored' }

export default async function CustomersPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('customers').select('*').order('created_at', { ascending: false }).limit(100)
  return <CustomersClient initialData={data ?? []} />
}
