import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppNav } from '@/components/ui/AppNav'
import type { Role } from '@/types/domain'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
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
    <div className="min-h-screen bg-sand-50 flex flex-col">
      <AppNav
        staffName={staff?.name ?? ''}
        role={(staff?.role ?? 'cashier') as Role}
        branchName={branchName}
        branchId={staff?.branch_id ?? null}
      />
      <main className="flex-1">{children}</main>
    </div>
  )
}
