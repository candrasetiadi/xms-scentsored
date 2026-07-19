import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const MANAGER_ROLES = ['owner', 'admin']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// DELETE /api/v1/commission-tracker/advance-fees/[id]
// Owner/admin only
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await (supabase as any).from('staff').select('role, can_access_commission').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || (!MANAGER_ROLES.includes(staff.role) && !(staff as any).can_access_commission))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { id } = await params
  if (!UUID_RE.test(id))
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'ID tidak valid.' } }, { status: 400 })

  // Use admin client to bypass RLS write restriction
  const admin = createAdminClient()

  // Check existence first
  const { data: existing, error: fetchErr } = await (admin as any)
    .from('company_advance_fees')
    .select('id')
    .eq('id', id)
    .single()

  if (fetchErr || !existing)
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Advance fee tidak ditemukan.' } }, { status: 404 })

  const { error } = await (admin as any)
    .from('company_advance_fees')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  return new Response(null, { status: 204 })
}
