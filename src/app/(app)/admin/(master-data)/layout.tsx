import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const ADMIN_NAV = [
  { label: 'Produk',       href: '/admin/products' },
  { label: 'Bahan Baku',   href: '/admin/raw-materials' },
  { label: 'Resep / BOM',  href: '/admin/recipes' },
  { label: 'Supplier',     href: '/admin/suppliers' },
  { label: 'Driver',            href: '/admin/drivers' },
  { label: 'Travel Agent',      href: '/admin/travel-agencies' },
  { label: 'Pelanggan',         href: '/admin/customers' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()

  if (!staff || !['owner', 'admin'].includes(staff.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="font-display text-[28px] text-pine mb-4">Master Data</h1>
      {/* Sub-nav */}
      <nav className="flex gap-1 flex-wrap mb-6 border-b border-line pb-3">
        {ADMIN_NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-ink-500
                       hover:text-ink-900 hover:bg-sand-100 transition-colors
                       data-[active]:bg-pine-50 data-[active]:text-pine"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  )
}
