import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/v1/hr/attendance
//
// Mode 1 — staff (no query params, or non-manager):
//   Returns { data: { today, history } } untuk halaman absensi karyawan sendiri.
//
// Mode 2 — admin/owner (query params: from, to, branch_id?, status?, search?):
//   Returns { data: { records, summary } } untuk halaman rekap admin.
export async function GET(request: Request) {
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

  const isManager = ['owner', 'admin'].includes(staff.role)
  const { searchParams } = new URL(request.url)
  const hasRangeParam = searchParams.has('from') || searchParams.has('to')

  // ── Mode 2: Admin rekap ────────────────────────────────────────────────────
  if (isManager && hasRangeParam) {
    const from     = searchParams.get('from') ?? new Date().toISOString().slice(0, 10)
    const to       = searchParams.get('to')   ?? from
    const branchId = searchParams.get('branch_id') ?? null
    const status   = searchParams.get('status')    ?? null
    const search   = searchParams.get('search')    ?? null

    let q = (supabase as any)
      .from('attendances')
      .select(`
        id,
        work_date,
        clock_in,
        clock_out,
        worked_minutes,
        status,
        selfie_in_url,
        selfie_out_url,
        staff:staff_id ( id, name, branch_id )
      `)
      .gte('work_date', from)
      .lte('work_date', to)
      .order('work_date', { ascending: false })
      .order('staff_id')

    if (branchId) q = q.eq('branch_id', branchId)
    if (status)   q = q.eq('status', status)

    const { data: rows, error: dbErr } = await q
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

    // Fetch branch names for display
    const { data: branches } = await supabase
      .from('branches')
      .select('id, name')

    const branchMap: Record<string, string> = Object.fromEntries(
      (branches ?? []).map(b => [b.id, b.name])
    )

    // Generate signed URLs for all selfie paths in one batch
    const BUCKET = 'attendance-selfies'
    const EXPIRES = 60 * 60 // 1 jam

    const allPaths = (rows ?? []).flatMap((row: any) => {
      const paths: string[] = []
      if (row.selfie_in_url)  paths.push(row.selfie_in_url)
      if (row.selfie_out_url) paths.push(row.selfie_out_url)
      return paths
    })

    const signedMap: Record<string, string> = {}
    if (allPaths.length > 0) {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(allPaths, EXPIRES)
      ;(signed ?? []).forEach((s: any) => {
        if (s.path && s.signedUrl) signedMap[s.path] = s.signedUrl
      })
    }

    // Map + optional client-side search filter
    const searchLower = search?.toLowerCase() ?? ''
    const records = (rows ?? [])
      .map((row: any) => ({
        id:              row.id,
        date:            row.work_date,
        clock_in_at:     row.clock_in,
        clock_out_at:    row.clock_out,
        worked_minutes:  row.worked_minutes,
        status:          row.status,
        staff_name:      row.staff?.name ?? '–',
        branch_name:     branchMap[row.staff?.branch_id] ?? '–',
        selfie_in_url:   row.selfie_in_url  ? (signedMap[row.selfie_in_url]  ?? null) : null,
        selfie_out_url:  row.selfie_out_url ? (signedMap[row.selfie_out_url] ?? null) : null,
      }))
      .filter((r: { staff_name: string }) =>
        !searchLower || r.staff_name.toLowerCase().includes(searchLower)
      )

    const summary = {
      present:  records.filter((r: { status: string }) => r.status === 'present').length,
      late:     records.filter((r: { status: string }) => r.status === 'late').length,
      absent:   records.filter((r: { status: string }) => r.status === 'absent').length,
      on_leave: records.filter((r: { status: string }) => r.status === 'on_leave').length,
    }

    return NextResponse.json({ data: { records, summary } })
  }

  // ── Mode 1: Staff — today + last 7 days ───────────────────────────────────
  const todayStr     = new Date().toISOString().slice(0, 10)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [attRes, schedRes, histRes] = await Promise.all([
    supabase
      .from('attendances')
      .select('id, clock_in, clock_out, worked_minutes, status')
      .eq('staff_id', staff.id)
      .eq('work_date', todayStr)
      .maybeSingle(),

    supabase
      .from('staff_schedules')
      .select('shift_id')
      .eq('staff_id', staff.id)
      .eq('work_date', todayStr)
      .maybeSingle(),

    supabase
      .from('attendances')
      .select('id, work_date, clock_in, clock_out, worked_minutes, status')
      .eq('staff_id', staff.id)
      .gte('work_date', sevenDaysAgo)
      .lt('work_date', todayStr)
      .order('work_date', { ascending: false })
      .limit(7),
  ])

  let shift: { name: string; start_time: string; end_time: string } | null = null
  if (schedRes.data?.shift_id) {
    const { data: shiftData } = await supabase
      .from('shifts')
      .select('name, start_time, end_time')
      .eq('id', schedRes.data.shift_id)
      .single()
    shift = shiftData
  }

  const att = attRes.data
  const today = {
    attendance_id:  att?.id              ?? null,
    clock_in_at:    att?.clock_in        ?? null,
    clock_out_at:   att?.clock_out       ?? null,
    worked_minutes: att?.worked_minutes  ?? null,
    status:         att?.status          ?? 'absent',
    shift_name:     shift?.name          ?? null,
    shift_start:    shift?.start_time    ?? null,
    shift_end:      shift?.end_time      ?? null,
  }

  const history = (histRes.data ?? []).map((rec: any) => ({
    id:             rec.id,
    date:           rec.work_date,
    clock_in_at:    rec.clock_in,
    clock_out_at:   rec.clock_out,
    worked_minutes: rec.worked_minutes,
    status:         rec.status,
    shift_name:     null,
    shift_start:    null,
    shift_end:      null,
  }))

  return NextResponse.json({ data: { today, history } })
}

// POST /api/v1/hr/attendance — input manual absensi oleh admin
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('staff')
    .select('id, role, branch_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single()
  if (!me || !['owner', 'admin'].includes(me.role))
    return NextResponse.json({ error: 'Hanya admin/owner yang bisa input manual.' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body?.staff_id || !body?.date || !body?.clock_in_at)
    return NextResponse.json({ error: 'staff_id, date, clock_in_at wajib diisi.' }, { status: 400 })

  const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/
  if (!TIME_RE.test(body.clock_in_at))
    return NextResponse.json({ error: 'Format jam masuk tidak valid (HH:MM).' }, { status: 400 })
  if (body.clock_out_at && !TIME_RE.test(body.clock_out_at))
    return NextResponse.json({ error: 'Format jam keluar tidak valid (HH:MM).' }, { status: 400 })

  const { data: target } = await supabase
    .from('staff')
    .select('id, branch_id')
    .eq('id', body.staff_id)
    .single()
  if (!target) return NextResponse.json({ error: 'Staff tidak ditemukan.' }, { status: 404 })

  // Normalize to HH:MM:00 so the appended offset is always valid
  function toTs(date: string, time: string) {
    const hhmm = time.slice(0, 5)
    return `${date}T${hhmm}:00+07:00`
  }

  const clockIn  = toTs(body.date, body.clock_in_at)
  const clockOut = body.clock_out_at ? toTs(body.date, body.clock_out_at) : null

  if (clockOut && new Date(clockOut) <= new Date(clockIn))
    return NextResponse.json({ error: 'Jam keluar harus lebih besar dari jam masuk.' }, { status: 400 })

  const workedMinutes = clockOut
    ? Math.round((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 60000)
    : null

  const { data: row, error: dbErr } = await supabase
    .from('attendances')
    .upsert({
      staff_id:       body.staff_id,
      branch_id:      target.branch_id ?? '',
      work_date:      body.date,
      clock_in:       clockIn,
      clock_out:      clockOut,
      worked_minutes: workedMinutes,
      status:         'present',
      note:           body.note ?? null,
    }, { onConflict: 'staff_id,work_date' })
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data: row }, { status: 201 })
}
