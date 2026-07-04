import { createClient } from '@supabase/supabase-js'
import { WorkshopResultClient } from './WorkshopResultClient'

interface Props { params: Promise<{ token: string }> }

async function fetchFormulation(token: string) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data } = await admin
    .from('workshop_formulations')
    .select(`
      id, access_token, perfume_name, theme, contact_socmed, notes,
      target_grams, total_grams, status, created_at,
      customers ( name ),
      consultation_slots ( date, start_time, end_time ),
      workshop_formulation_items (
        id, line_no, drops, grams,
        workshop_materials (
          id, name, dilution_percentage,
          scent_categories ( id, name, color_hex )
        )
      )
    `)
    .eq('access_token', token)
    .maybeSingle()
  return data
}

export default async function WorkshopResultPage({ params }: Props) {
  const { token } = await params
  const data = await fetchFormulation(token)

  if (!data) {
    return (
      <div className="min-h-screen bg-sand-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-4xl mb-4">🔍</p>
          <h1 className="text-lg font-semibold text-ink-900 mb-2">Formulasi tidak ditemukan</h1>
          <p className="text-sm text-ink-500">Pastikan link yang kamu buka sudah benar.</p>
        </div>
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <WorkshopResultClient formulation={data as unknown as Parameters<typeof WorkshopResultClient>[0]['formulation']} />
}
