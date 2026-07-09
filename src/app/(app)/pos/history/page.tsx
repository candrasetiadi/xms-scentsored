import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OrderHistoryClient } from './OrderHistoryClient'

export const metadata = { title: 'Riwayat Transaksi — Scentsored' }

export default async function OrderHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; date?: string; status?: string }>
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

  const params      = await searchParams
  const branchId    = params.branch ?? staff.branch_id ?? branches?.[0]?.id ?? null
  const today       = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  const selectedDate = params.date ?? today
  const statusFilter = params.status ?? ''

  if (!branchId) redirect('/dashboard')

  let query = supabase
    .from('orders')
    .select('id, order_number, queue_number, status, subtotal, discount, total, paid_at, created_at, customer_id, driver_id, sales_staff_id')
    .eq('branch_id', branchId)
    .gte('created_at', `${selectedDate}T00:00:00+07:00`)
    .lt('created_at',  `${selectedDate}T23:59:59+07:00`)
    .order('created_at', { ascending: false })
    .limit(100)

  if (statusFilter) query = (query as typeof query).eq('status', statusFilter as 'draft' | 'awaiting_payment' | 'paid' | 'in_production' | 'ready' | 'completed' | 'cancelled')

  const { data: orders } = await query

  // Fetch customers + sales staff in parallel
  const custIds  = [...new Set((orders ?? []).map(o => o.customer_id).filter(Boolean) as string[])]
  const salesIds = [...new Set((orders ?? []).map(o => o.sales_staff_id).filter(Boolean) as string[])]

  const [{ data: customers }, { data: salesStaff }] = await Promise.all([
    custIds.length  ? supabase.from('customers').select('id, name, phone').in('id', custIds)  : Promise.resolve({ data: [] }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    salesIds.length ? (supabase as any).from('staff').select('id, name, nickname').in('id', salesIds) : Promise.resolve({ data: [] }),
  ])

  const custMap  = new Map((customers  ?? []).map((c: { id: string; name: string | null; phone: string | null }) => [c.id, c]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staffMap = new Map(((salesStaff ?? []) as any[]).map((s: { id: string; name: string; nickname: string | null }) => [s.id, s]))

  const enriched = (orders ?? []).map(o => ({
    ...o,
    customer:    o.customer_id    ? custMap.get(o.customer_id)       ?? null : null,
    sales_staff: o.sales_staff_id ? staffMap.get(o.sales_staff_id)   ?? null : null,
  }))

  // Summary hari ini
  const paid   = enriched.filter(o => o.status === 'paid' || o.status === 'completed')
  const revenue = paid.reduce((s, o) => s + o.total, 0)

  return (
    <OrderHistoryClient
      staffRole={staff.role}
      branchId={branchId}
      branches={branches ?? []}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orders={enriched as any}
      selectedDate={selectedDate}
      statusFilter={statusFilter}
      summary={{ totalOrders: paid.length, revenue }}
    />
  )
}
