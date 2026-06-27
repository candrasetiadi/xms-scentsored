import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PosClient } from './PosClient'

export const metadata = { title: 'POS — Scentsored' }

export default async function PosPage({
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

  if (!['owner', 'admin', 'cashier'].includes(staff.role)) redirect('/dashboard')

  const { data: branches } = staff.role === 'owner' || staff.role === 'admin'
    ? await supabase.from('branches').select('id, name').eq('active', true).order('name')
    : { data: null }

  const resolvedParams = await searchParams
  const branchId = resolvedParams.branch ?? staff.branch_id ?? branches?.[0]?.id ?? null

  if (!branchId) redirect('/dashboard')

  const [productsRes, driversRes, productStockRes, edcRes, branchRes] = await Promise.all([
    supabase.from('products').select('id, sku, name, category, type, price, image_url').eq('active', true).order('name'),
    supabase.from('drivers').select('id, name, fee_value, type').eq('active', true).order('name'),
    supabase.from('product_stock').select('product_id, current_stock').eq('branch_id', branchId),
    supabase.from('edc_machines').select('id, bank_name, terminal_id, label').eq('branch_id', branchId).eq('active', true).order('bank_name'),
    supabase.from('branches').select('qris_image_url').eq('id', branchId).single(),
  ])

  const stockMap: Record<string, number> = {}
  for (const s of productStockRes.data ?? []) {
    stockMap[s.product_id] = s.current_stock
  }

  return (
    <PosClient
      staffId={staff.id}
      staffRole={staff.role}
      branchId={branchId}
      branches={branches ?? []}
      products={productsRes.data ?? []}
      drivers={driversRes.data ?? []}
      stockMap={stockMap}
      edcMachines={edcRes.data ?? []}
      qrisImageUrl={branchRes.data?.qris_image_url ?? null}
    />
  )
}
