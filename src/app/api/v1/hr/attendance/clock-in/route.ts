import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ATTENDANCE_CONFIG } from '@/lib/attendance-config'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// POST /api/v1/hr/attendance/clock-in
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff')
    .select('id, role, branch_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()
  if (!staff) return NextResponse.json({ error: 'Staff tidak ditemukan.' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { work_date?: string; latitude?: number; longitude?: number }

  // Validasi radius lokasi
  if (ATTENDANCE_CONFIG.GEO_VALIDATION_ENABLED) {
    if (typeof body.latitude !== 'number' || typeof body.longitude !== 'number')
      return NextResponse.json({ error: 'Lokasi diperlukan untuk absen. Pastikan GPS aktif dan izin lokasi diberikan.' }, { status: 400 })

    const distance = haversineDistance(body.latitude, body.longitude, ATTENDANCE_CONFIG.OFFICE_LAT, ATTENDANCE_CONFIG.OFFICE_LNG)
    if (distance > ATTENDANCE_CONFIG.MAX_RADIUS_M)
      return NextResponse.json({ error: `Kamu berada ${Math.round(distance)} m dari kantor. Absen hanya bisa dilakukan dalam radius ${ATTENDANCE_CONFIG.MAX_RADIUS_M} m.` }, { status: 403 })
  }

  const workDate = body.work_date ?? new Date().toISOString().slice(0, 10)
  if (!DATE_RE.test(workDate))
    return NextResponse.json({ error: 'work_date harus format YYYY-MM-DD.' }, { status: 400 })

  const { error } = await supabase.rpc('clock_in', {
    p_staff_id:  staff.id,
    p_work_date: workDate,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch the updated record so client gets the actual clock_in_at timestamp
  const { data: att } = await supabase
    .from('attendances')
    .select('id, clock_in, clock_out, worked_minutes, status')
    .eq('staff_id', staff.id)
    .eq('work_date', workDate)
    .single()

  return NextResponse.json({
    data: {
      attendance_id:  att?.id       ?? null,
      clock_in_at:    att?.clock_in ?? null,
      clock_out_at:   null,
      worked_minutes: null,
      status:         att?.status   ?? 'present',
    }
  })
}
