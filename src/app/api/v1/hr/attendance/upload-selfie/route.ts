import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const BUCKET = 'attendance-selfies'

// POST /api/v1/hr/attendance/upload-selfie
// Body: FormData dengan field "file" (image/jpeg)
// Returns: { data: { path: string } }
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: staff } = await supabase
      .from('staff').select('id').eq('auth_user_id', user.id).eq('active', true).single()
    if (!staff) return NextResponse.json({ error: 'Staff tidak ditemukan.' }, { status: 401 })

    const form = await request.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 400 })

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return NextResponse.json({ error: 'Format file tidak didukung.' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file maksimal 5 MB.' }, { status: 400 })
    }

    const ext       = file.type === 'image/png' ? 'png' : 'jpg'
    const timestamp = Date.now()
    const path      = `${staff.id}/${timestamp}.${ext}`

    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType: file.type, upsert: false })

    if (uploadErr) {
      console.error('[upload-selfie]', uploadErr.message)
      return NextResponse.json({ error: uploadErr.message }, { status: 500 })
    }

    return NextResponse.json({ data: { path } })
  } catch (err) {
    console.error('[upload-selfie] unexpected:', err)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}
