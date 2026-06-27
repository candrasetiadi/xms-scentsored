import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Dashboard — Scentsored' }

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner', admin: 'Admin', cashier: 'Kasir',
  perfumer: 'Peracik', stock_keeper: 'Stock Keeper',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff')
    .select('name, role, branch_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()

  let branchName: string | null = null
  if (staff?.branch_id) {
    const { data: branch } = await supabase
      .from('branches').select('name').eq('id', staff.branch_id).single()
    branchName = branch?.name ?? null
  }

  return (
    <div className="max-w-2xl mx-auto p-6 mt-8">
      <h1 className="font-display text-[30px] text-pine mb-1">Dashboard</h1>
      <p className="text-ink-500 text-sm mb-6">MVP Fase 1 — sedang dibangun</p>

      <div className="bg-white border border-line rounded-lg shadow-sm p-6 flex flex-col gap-2">
        <p className="text-xs text-ink-400 uppercase tracking-wider font-medium">Sesi aktif</p>
        <p className="text-lg font-semibold text-ink-900">{staff?.name ?? '—'}</p>
        <div className="flex gap-2 flex-wrap mt-1">
          {staff?.role && (
            <span className="text-xs font-medium bg-pine-50 text-pine px-2.5 py-0.5 rounded-full border border-pine-100">
              {ROLE_LABEL[staff.role] ?? staff.role}
            </span>
          )}
          {branchName && (
            <span className="text-xs font-medium bg-sand-100 text-ink-700 px-2.5 py-0.5 rounded-full border border-line">
              {branchName}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
