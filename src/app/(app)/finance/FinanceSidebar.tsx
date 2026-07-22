'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/finance/home',            label: 'Beranda',              icon: '◈' },
  { href: null,                       label: 'UANG MASUK',           icon: null, sep: true },
  { href: '/finance/income',          label: 'Pendapatan',           icon: '▲' },
  { href: null,                       label: 'PENGELUARAN',          icon: null, sep: true },
  { href: '/finance/expenses/toko',   label: 'Kebutuhan Toko',       icon: '▼' },
  { href: '/finance/expenses/bahan',  label: 'Bahan Baku & Produk',  icon: '▼' },
  { href: '/finance/expenses/vendor', label: 'Pembayaran Vendor',    icon: '▼' },
  { href: null,                       label: 'BANK & LAPORAN',       icon: null, sep: true },
  { href: '/finance/bank-statements', label: 'Rekening Koran',       icon: '▤' },
  { href: '/finance/journal',         label: 'Jurnal Umum',          icon: '≡' },
  { href: '/finance/cash-flow',       label: 'Laporan Arus Kas',     icon: '⇄' },
]

export function FinanceSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-line sticky top-0 h-screen flex flex-col py-5 px-3 gap-0.5 overflow-y-auto">
      <div className="px-3 pb-4">
        <p className="text-[11px] font-bold tracking-widest text-ink-400 uppercase">Finance</p>
        <h2 className="text-base font-extrabold text-pine leading-tight mt-0.5">Scentsored</h2>
      </div>

      {NAV.map((item, i) => {
        if (item.sep) return (
          <p key={i} className="text-[10px] font-bold tracking-widest text-ink-300 uppercase px-3 pt-3 pb-1">
            {item.label}
          </p>
        )
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href!}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              active
                ? 'bg-pine text-white'
                : 'text-ink-500 hover:bg-sand-100 hover:text-ink-900'
            }`}
          >
            <span className="w-4 text-center text-base leading-none">{item.icon}</span>
            {item.label}
          </Link>
        )
      })}

      <div className="mt-auto pt-4 border-t border-line">
        <Link href="/dashboard"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-ink-400 hover:text-ink-700 transition-colors">
          ← Kembali ke Dashboard
        </Link>
      </div>
    </aside>
  )
}
