import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Sesi tidak valid.' } },
      { status: 401 },
    )
  }

  const { data: staff, error } = await supabase
    .from('staff')
    .select('id, name, role, active, branch_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()

  if (error || !staff) {
    return NextResponse.json(
      { error: { code: 'STAFF_NOT_FOUND', message: 'Profil karyawan tidak ditemukan.' } },
      { status: 404 },
    )
  }

  let branch = null
  if (staff.branch_id) {
    const { data } = await supabase
      .from('branches')
      .select('id, name')
      .eq('id', staff.branch_id)
      .single()
    branch = data
  }

  return NextResponse.json({
    data: {
      id: staff.id,
      name: staff.name,
      role: staff.role,
      branch_id: staff.branch_id,
      branch,
      email: user.email,
    },
  })
}
