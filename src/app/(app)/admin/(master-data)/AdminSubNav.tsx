'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Role = string

interface NavEntry {
  label: string
  href: string
  roles: Role[]
}

const ADMIN_NAV: NavEntry[] = [
  { label: 'Produk',                 href: '/admin/products',           roles: ['owner', 'admin'] },
  { label: 'Bahan Baku',             href: '/admin/raw-materials',      roles: ['owner', 'admin'] },
  { label: 'Raw Mat Experience',     href: '/admin/workshop-materials', roles: ['owner', 'admin', 'stock_keeper'] },
  { label: 'Resep / BOM',            href: '/admin/recipes',            roles: ['owner', 'admin'] },
  { label: 'Supplier',               href: '/admin/suppliers',          roles: ['owner', 'admin'] },
  { label: 'Driver',                 href: '/admin/drivers',            roles: ['owner', 'admin'] },
  { label: 'Travel Agent',           href: '/admin/travel-agencies',    roles: ['owner', 'admin'] },
  { label: 'Pelanggan',              href: '/admin/customers',          roles: ['owner', 'admin'] },
]

export function AdminSubNav({ role }: { role: Role }) {
  const pathname = usePathname()
  const visible = ADMIN_NAV.filter(item => item.roles.includes(role))

  return (
    <nav className="flex gap-1 flex-wrap mb-6 border-b border-line pb-3">
      {visible.map(item => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              active
                ? 'bg-pine-50 text-pine'
                : 'text-ink-500 hover:text-ink-900 hover:bg-sand-100',
            ].join(' ')}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
