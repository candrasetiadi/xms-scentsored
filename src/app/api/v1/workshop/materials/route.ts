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
// Order: kategori sort_order ASC, lalu nama ASC.
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

  const { data, error } = await supabase
    .from('workshop_materials')
    .select(`
      id, branch_id, name, dilution_percentage, category_id,
      stock_gram, active, created_at,
      scent_categories(id, name, color_hex, sort_order)
    `)
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sorted = (data ?? []).sort((a, b) => {
    const aCat = a.scent_categories as unknown as RawCategory
    const bCat = b.scent_categories as unknown as RawCategory
    const aOrder = aCat?.sort_order ?? 9999
    const bOrder = bCat?.sort_order ?? 9999
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.name.localeCompare(b.name)
  })

  return NextResponse.json({ data: sorted })
}
