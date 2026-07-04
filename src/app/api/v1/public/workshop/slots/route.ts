import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET /api/v1/public/workshop/slots?date=YYYY-MM-DD&branch_id=<uuid>
// Kembalikan slot aktif pada tanggal tertentu (default: hari ini).
// Tidak memerlukan auth — digunakan di form publik workshop.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  // Default ke hari ini (WIB = UTC+7)
  const today = new Date(Date.now() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const dateParam   = searchParams.get('date')     ?? today
  const branchParam = searchParams.get('branch_id') ?? null

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam))
    return NextResponse.json({ error: 'date harus format YYYY-MM-DD.' }, { status: 400 })

  const admin = createAdminClient()

  let query = admin
    .from('consultation_slots')
    .select('id, date, start_time, end_time, branch_id')
    .eq('date', dateParam)
    .eq('is_active', true)
    .order('start_time', { ascending: true })

  if (branchParam) query = query.eq('branch_id', branchParam)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}
