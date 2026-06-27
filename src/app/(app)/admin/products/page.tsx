import { createClient } from '@/lib/supabase/server'
import { ProductsClient } from './ProductsClient'

export const metadata = { title: 'Produk — Scentsored' }

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .order('name')

  return <ProductsClient initialData={products ?? []} />
}
