import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET /api/v1/public/workshop/materials
// Kembalikan semua bahan aktif untuk formulasi workshop.
// Tidak memerlukan auth — digunakan di halaman publik booking/formulasi.
// Stok tidak disertakan (PRD US-WS-4).
export async function GET() {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('workshop_materials')
    .select('id, name, dilution_percentage, scent_categories(id, name, color_hex, sort_order)')
    .eq('active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type RawCategory = { id: string; name: string; color_hex: string; sort_order: number } | null

  const sorted = (data ?? [])
    .sort((a, b) => {
      const aCat = a.scent_categories as unknown as RawCategory
      const bCat = b.scent_categories as unknown as RawCategory
      const aOrder = aCat?.sort_order ?? 9999
      const bOrder = bCat?.sort_order ?? 9999
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.name.localeCompare(b.name)
    })
    .map(m => {
      const cat = m.scent_categories as unknown as RawCategory
      return {
        id: m.id,
        name: m.name,
        dilution_percentage: m.dilution_percentage,
        category: cat ? { id: cat.id, name: cat.name, color_hex: cat.color_hex } : null,
      }
    })

  return NextResponse.json({ data: sorted })
}
