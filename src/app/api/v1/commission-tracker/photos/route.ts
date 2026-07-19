import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const MANAGER_ROLES = ['owner', 'admin']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_PHOTO_TYPES = ['receipt', 'guest', 'transfer'] as const
type PhotoType = typeof VALID_PHOTO_TYPES[number]

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg':  'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
}

// POST /api/v1/commission-tracker/photos
// multipart/form-data: tx_id, photo_type ('receipt'|'guest'|'transfer'), file
// Owner/admin only
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await (supabase as any).from('staff').select('role, can_access_commission').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || (!MANAGER_ROLES.includes(staff.role) && !(staff as any).can_access_commission))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  let formData: FormData
  try { formData = await request.formData() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Request harus multipart/form-data.' } }, { status: 400 })
  }

  const txId      = formData.get('tx_id') as string | null
  const photoType = formData.get('photo_type') as string | null
  const file      = formData.get('file') as File | null

  if (!txId || !UUID_RE.test(txId))
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'tx_id harus UUID valid.' } }, { status: 400 })
  if (!photoType || !VALID_PHOTO_TYPES.includes(photoType as PhotoType))
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'photo_type harus receipt, guest, atau transfer.' } }, { status: 400 })
  if (!file || file.size === 0)
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'file wajib.' } }, { status: 400 })

  // Validate tx exists
  const { data: tx, error: txErr } = await (supabase as any)
    .from('commission_transactions')
    .select('id')
    .eq('id', txId)
    .single()

  if (txErr || !tx)
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Transaksi tidak ditemukan.' } }, { status: 404 })

  // Determine file extension from MIME type
  const mimeType = file.type || 'image/jpeg'
  const ext = MIME_TO_EXT[mimeType] ?? 'jpg'
  const storagePath = `${txId}/${photoType}.${ext}`

  // Upload to Supabase Storage
  const fileBuffer = await file.arrayBuffer()
  const admin = createAdminClient()

  const { error: uploadErr } = await (admin as any)
    .storage
    .from('commission-photos')
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: true,
    })

  if (uploadErr)
    return NextResponse.json({ error: { code: 'STORAGE_ERROR', message: uploadErr.message } }, { status: 500 })

  // Get public URL
  const { data: urlData } = (admin as any)
    .storage
    .from('commission-photos')
    .getPublicUrl(storagePath)

  const publicUrl: string = urlData?.publicUrl ?? ''

  // Update via SECURITY DEFINER function (tidak ada direct .update() — RLS bypass aman)
  const { error: updateErr } = await (admin as any).rpc('update_commission_photo', {
    p_id:         txId,
    p_photo_type: photoType,
    p_url:        publicUrl,
  })

  if (updateErr)
    return NextResponse.json({ error: { code: 'DB_ERROR', message: updateErr.message } }, { status: 500 })

  return NextResponse.json({ data: { url: publicUrl } }, { status: 201 })
}
