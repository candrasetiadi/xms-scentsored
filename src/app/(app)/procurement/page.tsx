import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProcurementClient } from './ProcurementClient'

export const metadata = { title: 'Procurement — Scentsored' }

export default async function ProcurementPage({
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
  if (!['owner', 'admin', 'stock_keeper'].includes(staff.role)) redirect('/dashboard')

  const isManager = ['owner', 'admin'].includes(staff.role)

  const { data: branches } = isManager
    ? await supabase.from('branches').select('id, name').order('name')
    : { data: null }

  const resolvedParams = await searchParams
  const branchId = resolvedParams.branch ?? staff.branch_id ?? branches?.[0]?.id ?? null
  if (!branchId) redirect('/dashboard')

  const [suppliersRes, rawMaterialsRes] = await Promise.all([
    supabase.from('suppliers').select('id, name').order('name'),
    supabase.from('raw_materials').select('id, name, unit, active').eq('active', true).order('name'),
  ])

  return (
    <ProcurementClient
      staffId={staff.id}
      staffRole={staff.role}
      branchId={branchId}
      branches={branches ?? []}
      suppliers={suppliersRes.data ?? []}
      rawMaterials={rawMaterialsRes.data ?? []}
    />
  )
}
