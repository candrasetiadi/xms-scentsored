import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { HrNav }        from './HrNav'
import { ToastProvider } from '@/components/hr/Toast'

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff')
    .select('id, name, role, branch_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()

  const role     = staff?.role   ?? 'cashier'
  const staffId  = staff?.id     ?? ''
  const branchId = staff?.branch_id ?? null

  return (
    <ToastProvider>
      <div className="flex min-h-[calc(100vh-56px)]">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-56 bg-pine-800 shrink-0 py-4">
          <HrNav role={role} staffId={staffId} branchId={branchId} />
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 pb-20 md:pb-0">
          {children}
        </div>

        {/* Mobile bottom nav (karyawan) */}
        <HrNav role={role} staffId={staffId} branchId={branchId} mobile />
      </div>
    </ToastProvider>
  )
}
