import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type RawCategory = { name: string; color_hex: string } | null
type RawMaterial = {
  name: string
  dilution_percentage: number
  scent_categories: RawCategory
} | null
type RawItem = {
  id: string
  line_no: number
  drops: number | null
  grams: number
  adj: number | null
  workshop_materials: RawMaterial
}
type RawCustomer = { name: string; phone: string | null; email: string | null } | null
type RawSlot    = { date: string; start_time: string; end_time: string } | null

// GET /api/v1/public/workshop/formulations/[token]
// Kembalikan detail formulasi berdasarkan access_token (UUID).
// Tidak memerlukan auth — link berbasis token.
// 404 jika token tidak ditemukan.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  if (!UUID_RE.test(token))
    return NextResponse.json({ error: 'Token tidak valid.' }, { status: 400 })

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('workshop_formulations')
    .select(`
      id, access_token, perfume_name, theme, contact_socmed, notes,
      total_grams, status, created_at,
      customers(name, phone, email),
      consultation_slots(date, start_time, end_time),
      workshop_formulation_items(
        id, line_no, drops, grams, adj,
        workshop_materials(
          name, dilution_percentage,
          scent_categories(name, color_hex)
        )
      )
    `)
    .eq('access_token', token)
    .single()

  if (error || !data)
    return NextResponse.json({ error: 'Formulasi tidak ditemukan.' }, { status: 404 })

  const customer = data.customers         as unknown as RawCustomer
  const slot     = data.consultation_slots as unknown as RawSlot
  const items    = (data.workshop_formulation_items as unknown as RawItem[]) ?? []

  return NextResponse.json({
    data: {
      id:            data.id,
      access_token:  data.access_token,
      perfume_name:  data.perfume_name,
      theme:         data.theme,
      contact_socmed: data.contact_socmed,
      notes:         data.notes,
      total_grams:   data.total_grams,
      status:        data.status,
      created_at:    data.created_at,
      customer:      customer ?? null,
      slot:          slot
        ? { date: slot.date, start_time: slot.start_time, end_time: slot.end_time }
        : null,
      items: items
        .sort((a, b) => a.line_no - b.line_no)
        .map(item => {
          const mat = item.workshop_materials
          const cat = mat?.scent_categories ?? null
          return {
            line_no: item.line_no,
            drops:   item.drops,
            grams:   item.grams,
            adj:     item.adj,
            material: mat
              ? {
                  name:                 mat.name,
                  dilution_percentage:  mat.dilution_percentage,
                  category:             cat ? { name: cat.name, color_hex: cat.color_hex } : null,
                }
              : null,
          }
        }),
    },
  })
}
