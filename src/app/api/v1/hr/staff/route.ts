import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ── auth guard helper ─────────────────────────────────────────────────────────

async function requireManager() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: staff } = await supabase
    .from('staff').select('id, role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role)) return null
  return { supabase, staff }
}

// ── GET /api/v1/hr/staff — list all staff with branch ────────────────────────

export async function GET() {
  const ctx = await requireManager()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await ctx.supabase
    .from('staff')
    .select('id, name, nickname, team, job_title, role, active, branch_id, branches(id, name)')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// ── POST /api/v1/hr/staff — create auth user + staff record ──────────────────

export async function POST(request: Request) {
  const ctx = await requireManager()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    name: string
    email: string
    password: string
    role: string
    branch_id: string | null
    nickname?: string | null
    team?: string | null
    job_title?: string | null
  }

  if (!body.name?.trim()) return NextResponse.json({ error: 'Nama wajib diisi.' }, { status: 400 })
  if (!body.email?.trim()) return NextResponse.json({ error: 'Email wajib diisi.' }, { status: 400 })
  if (!body.password || body.password.length < 6)
    return NextResponse.json({ error: 'Password minimal 6 karakter.' }, { status: 400 })
  const VALID_ROLES = ['owner', 'admin', 'cashier', 'perfumer', 'stock_keeper']
  if (!VALID_ROLES.includes(body.role))
    return NextResponse.json({ error: 'Role tidak valid.' }, { status: 400 })

  const admin = createAdminClient()

  // 1. Create auth user
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: body.email.trim(),
    password: body.password,
    email_confirm: true,
  })
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })

  // 2. Create staff record
  const { data: staff, error: staffErr } = await admin
    .from('staff')
    .insert({
      auth_user_id: authData.user.id,
      name:      body.name.trim(),
      role:      body.role as 'owner' | 'admin' | 'cashier' | 'perfumer' | 'stock_keeper',
      branch_id: body.branch_id || null,
      nickname:  body.nickname?.trim() || null,
      team:      body.team || null,
      job_title: body.job_title?.trim() || null,
      active:    true,
    })
    .select('id, name, nickname, team, job_title, role, active, branch_id')
    .single()

  if (staffErr) {
    // Rollback auth user if staff insert failed
    await admin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: staffErr.message }, { status: 500 })
  }

  return NextResponse.json({ data: staff }, { status: 201 })
}
