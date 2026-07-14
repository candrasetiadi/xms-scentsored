import type { Metadata } from 'next'
import { BrandLogo } from '@/components/ui/BrandLogo'

export const metadata: Metadata = {
  title: 'Raw Mat Experience — Scentsored',
  description: 'Create your personal Raw Mat Experience with Scentsored.',
}

export default function WorkshopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-sand-50 flex flex-col">
      <header className="sticky top-0 z-30 bg-white border-b border-line px-4 py-4">
        <BrandLogo variant="light" size="sm" />
        <p className="text-xs text-ink-500 mt-0.5">RAW MAT EXPERIENCE</p>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  )
}
