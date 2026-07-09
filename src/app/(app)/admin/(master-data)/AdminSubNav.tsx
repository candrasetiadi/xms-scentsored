'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ADMIN_NAV = [
  { label: 'Produk',                 href: '/admin/products' },
  { label: 'Bahan Baku',             href: '/admin/raw-materials' },
  { label: 'Raw Materials Workshop', href: '/admin/workshop-materials' },
  { label: 'Resep / BOM',            href: '/admin/recipes' },
  { label: 'Supplier',               href: '/admin/suppliers' },
  { label: 'Driver',                 href: '/admin/drivers' },
  { label: 'Travel Agent',           href: '/admin/travel-agencies' },
  { label: 'Pelanggan',              href: '/admin/customers' },
]

export function AdminSubNav() {
  const pathname = usePathname()
  return (
    <nav className="flex gap-1 flex-wrap mb-6 border-b border-line pb-3">
      {ADMIN_NAV.map(item => {
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
