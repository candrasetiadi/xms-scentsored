import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FinanceSidebar } from './FinanceSidebar'

export const metadata = { title: 'Finance — Scentsored' }

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await (supabase as any)
    .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff) redirect('/login')
  if (!['owner', 'admin'].includes(staff.role)) redirect('/dashboard')

  return (
    <div className="flex min-h-screen bg-sand-50">
      <FinanceSidebar />
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  )
}
