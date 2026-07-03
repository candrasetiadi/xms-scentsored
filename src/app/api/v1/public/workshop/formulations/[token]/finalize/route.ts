import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST /api/v1/public/workshop/formulations/[token]/finalize
// Finalisasi formulasi — mengunci status menjadi 'finalized'.
// Idempotent: jika sudah difinalisasi, kembalikan 409.
// Tidak memerlukan auth — diakses via link token.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  if (!UUID_RE.test(token))
    return NextResponse.json({ error: 'Token tidak valid.' }, { status: 400 })

  const admin = createAdminClient()

  const { error } = await admin.rpc('finalize_workshop_formulation', {
    p_access_token: token,
  })

  if (error) {
    // DB function melempar error dengan pesan "sudah difinalisasi" jika status bukan draft
    if (error.message.toLowerCase().includes('sudah difinalisasi'))
      return NextResponse.json({ error: 'Formulasi sudah difinalisasi.' }, { status: 409 })

    // Token tidak dikenali (formulasi tidak ditemukan)
    if (error.message.toLowerCase().includes('not found') || error.code === 'PGRST116')
      return NextResponse.json({ error: 'Formulasi tidak ditemukan.' }, { status: 404 })

    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: { message: 'Formulasi berhasil difinalisasi' } })
}
