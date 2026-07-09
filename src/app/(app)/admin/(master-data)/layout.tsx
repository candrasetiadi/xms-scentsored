import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminSubNav } from './AdminSubNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()

  if (!staff || !['owner', 'admin', 'stock_keeper'].includes(staff.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="font-display text-[28px] text-pine mb-4">Master Data</h1>
      <AdminSubNav role={staff.role} />
      {children}
    </div>
  )
}
