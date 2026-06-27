'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Role } from '@/types/domain'

const ROLE_REDIRECT: Record<Role, string> = {
  owner:        '/dashboard',
  admin:        '/dashboard',
  cashier:      '/pos',
  perfumer:     '/production',
  stock_keeper: '/inventory',
}

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError('Email atau password salah.')
      setLoading(false)
      return
    }

    // Ambil role untuk redirect
    const res = await fetch('/api/v1/me')
    if (res.ok) {
      const { data } = await res.json()
      const dest = ROLE_REDIRECT[data.role as Role] ?? '/dashboard'
      router.push(dest)
    } else {
      setError('Profil karyawan tidak ditemukan. Hubungi admin.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="h-10 rounded-md border border-line-strong px-3 text-sm text-ink-900
                     focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100
                     placeholder:text-ink-400"
          placeholder="nama@scentsored.id"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink-700" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="h-10 rounded-md border border-line-strong px-3 text-sm text-ink-900
                     focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger bg-danger-bg border border-danger-bd rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 h-10 rounded-md bg-pine text-white text-sm font-medium
                   hover:bg-pine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rust
                   disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Memproses…' : 'Masuk'}
      </button>
    </form>
  )
}
