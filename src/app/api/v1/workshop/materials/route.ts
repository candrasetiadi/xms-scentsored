import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type RawCategory = {
  id: string
  name: string
  color_hex: string
  sort_order: number
} | null

// GET /api/v1/workshop/materials
// List semua bahan workshop (termasuk stok). Manager only.
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff')
    .select('role')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['owner', 'admin'].includes(staff.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data, error } = await db
    .from('workshop_materials')
    .select(`
      id, branch_id, name, dilution_percentage, category_id,
      stock_gram, active, created_at,
      scent_categories(id, name, color_hex, sort_order)
    `)
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sorted = (data ?? []).sort((a: any, b: any) => {
    const aCat = a.scent_categories as RawCategory
    const bCat = b.scent_categories as RawCategory
    const aOrder = aCat?.sort_order ?? 9999
    const bOrder = bCat?.sort_order ?? 9999
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.name.localeCompare(b.name)
  })

  return NextResponse.json({ data: sorted })
}

// POST /api/v1/workshop/materials
// Tambah bahan workshop baru. Manager only.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff')
    .select('role')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['owner', 'admin'].includes(staff.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { name?: string; dilution_percentage?: number | null; category_id?: string | null }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 })
  }

  if (!body.name?.trim())
    return NextResponse.json({ error: 'Nama wajib diisi.' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data, error } = await db
    .from('workshop_materials')
    .insert({
      name:                 body.name.trim(),
      dilution_percentage:  body.dilution_percentage ?? null,
      category_id:          body.category_id ?? null,
      branch_id:            null,
      active:               true,
    })
    .select('*, scent_categories(id, name, color_hex, sort_order)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
