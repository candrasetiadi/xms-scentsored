import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InventoryClient } from './InventoryClient'
import type { RawStockRow } from '@/types/database'

export const metadata = { title: 'Inventory — Scentsored' }

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) redirect('/login')

  // Owner/admin bisa pilih cabang; role lain pakai cabang sendiri
  const { data: branches } = staff.role === 'owner' || staff.role === 'admin'
    ? await supabase.from('branches').select('id, name').eq('active', true).order('name')
    : { data: null }

  const resolvedParams = await searchParams
  const branchId = resolvedParams.branch ?? staff.branch_id ?? branches?.[0]?.id ?? null

  let rawStock: RawStockRow[] = []
  let productStock: { product_id: string; current_stock: number; updated_at: string }[] = []
  let products: { id: string; name: string; sku: string; type: string }[] = []

  if (branchId) {
    const [rawRes, psRes, prodRes] = await Promise.all([
      supabase.rpc('get_branch_raw_stock', { p_branch_id: branchId }),
      supabase.from('product_stock').select('product_id, current_stock, updated_at').eq('branch_id', branchId),
      supabase.from('products').select('id, name, sku, type').eq('active', true).order('name'),
    ])
    rawStock     = (rawRes.data as RawStockRow[]) ?? []
    productStock = psRes.data ?? []
    products     = prodRes.data ?? []
  }

  // Untuk modal batch input: butuh semua raw_materials aktif (bukan hanya yang ada stoknya)
  const { data: allRawMaterials } = await supabase
    .from('raw_materials').select('id, name, unit').eq('active', true).order('name')

  return (
    <InventoryClient
      staffId={staff.id}
      staffRole={staff.role}
      branchId={branchId}
      branches={branches ?? []}
      rawStock={rawStock}
      productStock={productStock}
      products={products}
      allRawMaterials={allRawMaterials ?? []}
    />
  )
}
