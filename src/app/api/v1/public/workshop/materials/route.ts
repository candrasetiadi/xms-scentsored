import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

type RawCategory = { id: string; name: string; color_hex: string; sort_order: number } | null

// GET /api/v1/public/workshop/materials
// Kembalikan semua bahan aktif untuk formulasi workshop.
// Tidak memerlukan auth — digunakan di halaman publik.
export async function GET() {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  const { data, error } = await db
    .from('workshop_materials')
    .select('id, name, dilution_percentage, scent_categories(id, name, color_hex, sort_order)')
    .eq('active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sorted = (data ?? [])
    .sort((a: any, b: any) => {
      const aCat = a.scent_categories as RawCategory
      const bCat = b.scent_categories as RawCategory
      const aOrder = aCat?.sort_order ?? 9999
      const bOrder = bCat?.sort_order ?? 9999
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.name.localeCompare(b.name)
    })
    .map((m: any) => {
      const cat = m.scent_categories as RawCategory
      return {
        id: m.id,
        name: m.name,
        dilution_percentage: m.dilution_percentage,
        category: cat ? { id: cat.id, name: cat.name, color_hex: cat.color_hex } : null,
      }
    })

  return NextResponse.json({ data: sorted })
}
