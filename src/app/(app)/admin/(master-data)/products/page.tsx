import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProductsClient } from './ProductsClient'

export const metadata = { title: 'Produk — Scentsored' }

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()

  // stock_keeper tidak punya akses ke produk — redirect ke halaman yang diizinkan
  if (staff?.role === 'stock_keeper') redirect('/admin/workshop-materials')
  if (!staff || !['owner', 'admin'].includes(staff.role)) redirect('/dashboard')

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .order('name')

  return <ProductsClient initialData={products ?? []} />
}
