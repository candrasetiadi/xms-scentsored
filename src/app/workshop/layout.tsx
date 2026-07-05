import type { Metadata } from 'next'
import { BrandLogo } from '@/components/ui/BrandLogo'

export const metadata: Metadata = {
  title: 'Perfume Formulation — Scentsored',
  description: 'Create your personal perfume formulation with Scentsored.',
}

export default function WorkshopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-sand-50 flex flex-col">
      <header className="sticky top-0 z-30 bg-white border-b border-line px-4 py-4">
        <BrandLogo variant="light" size="sm" />
        <p className="text-xs text-ink-500 mt-0.5">PERFUME FORMULATION</p>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  )
}
