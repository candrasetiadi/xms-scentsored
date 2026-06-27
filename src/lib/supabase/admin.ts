import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Service role client — HANYA untuk server-side (route handlers, server components).
// JANGAN import di client component.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
