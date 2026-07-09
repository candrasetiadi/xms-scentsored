import { LoginForm } from './LoginForm'
import { BrandLogo } from '@/components/ui/BrandLogo'

export const metadata = { title: 'Masuk — Scentsored' }

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-sand-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <BrandLogo variant="light" size="lg" />
        </div>
        <div className="bg-white border border-line rounded-lg shadow-sm p-8">
          <h1 className="font-display text-[28px] text-pine mb-1">Masuk</h1>
          <p className="text-sm text-ink-500 mb-6">Sistem operasional Scentsored</p>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
