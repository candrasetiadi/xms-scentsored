import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/v1/finance/expenses/:id/photo
// Body: multipart/form-data, field "file" (image/*)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await (supabase as any)
    .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { id } = await params
  const form = await request.formData()
  const file = form.get('file') as File | null

  if (!file || !file.type.startsWith('image/'))
    return NextResponse.json({ error: { code: 'INVALID_FILE' } }, { status: 400 })

  // Hapus foto lama
  const { data: row } = await (supabase as any)
    .from('finance_expenses').select('photo_url').eq('id', id).single()
  if (row?.photo_url) {
    const oldPath = row.photo_url.split('/finance-receipts/')[1]
    if (oldPath) await (supabase as any).storage.from('finance-receipts').remove([oldPath])
  }

  const ext      = file.name.split('.').pop() ?? 'jpg'
  const filePath = `receipts/${id}/${Date.now()}.${ext}`
  const buffer   = await file.arrayBuffer()

  const { error: uploadErr } = await (supabase as any)
    .storage.from('finance-receipts')
    .upload(filePath, buffer, { contentType: file.type, upsert: true })

  if (uploadErr) return NextResponse.json({ error: { message: uploadErr.message } }, { status: 500 })

  const { data: { publicUrl } } = (supabase as any)
    .storage.from('finance-receipts').getPublicUrl(filePath)

  const { error: updateErr } = await (supabase as any)
    .from('finance_expenses').update({ photo_url: publicUrl }).eq('id', id)

  if (updateErr) return NextResponse.json({ error: { message: updateErr.message } }, { status: 500 })

  return NextResponse.json({ photo_url: publicUrl })
}
