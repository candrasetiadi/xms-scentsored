import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Bebas diakses siapa saja — login maupun tidak
const PUBLIC_PATHS = ['/workshop', '/booking']
// Hanya untuk guest — jika sudah login, redirect ke dashboard
const GUEST_ONLY_PATHS = ['/login']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic    = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  const isGuestOnly = GUEST_ONLY_PATHS.some(p => pathname.startsWith(p))

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Belum login & bukan halaman publik/guest-only → paksa login
  if (!user && !isPublic && !isGuestOnly) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Sudah login & buka /login → tidak perlu login lagi
  if (user && isGuestOnly) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|brand/|fonts/|api/v1/webhooks|api/v1/public).*)',
  ],
}
