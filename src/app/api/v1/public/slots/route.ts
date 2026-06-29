import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') ?? '*'
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Max-Age':       '86400',
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) })
}

function validateApiKey(request: Request): boolean {
  const expected = process.env.BOOKING_API_KEY
  if (!expected) return false
  const provided = request.headers.get('x-api-key') ?? ''
  if (provided.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  } catch {
    return false
  }
}

// GET /api/v1/public/slots?branch_id=&from=&to=
//
// Kembalikan slot aktif beserta sisa kuota.
// Parameter:
//   branch_id  string  — opsional, filter per cabang
//   from       string  — YYYY-MM-DD, default hari ini
//   to         string  — YYYY-MM-DD, default 30 hari ke depan

export async function GET(request: Request) {
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'API key tidak valid.' } },
      { status: 401, headers: corsHeaders(request) },
    )
  }

  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branch_id')
  const from     = searchParams.get('from') ?? new Date().toISOString().slice(0, 10)
  const to       = searchParams.get('to')   ?? new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10)

  const admin = createAdminClient()

  let query = admin
    .from('consultation_slots')
    .select(`
      id, branch_id, date, start_time, end_time, max_bookings, notes,
      branches!inner(id, name),
      consultation_bookings(status)
    `)
    .eq('is_active', true)
    .gte('date', from)
    .lte('date', to)
    .order('date')
    .order('start_time')

  if (branchId) query = query.eq('branch_id', branchId)

  const { data, error } = await query
  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500, headers: corsHeaders(request) },
    )
  }

  const result = (data ?? []).map(slot => {
    const bookings = ((slot.consultation_bookings ?? []) as unknown) as { status: string }[]
    const filled   = bookings.filter(b => b.status === 'confirmed').length
    const branch   = (slot.branches as unknown) as { id: string; name: string }
    return {
      id:           slot.id,
      branch_id:    slot.branch_id,
      branch_name:  branch.name,
      date:         slot.date,
      start_time:   slot.start_time.slice(0, 5),
      end_time:     slot.end_time.slice(0, 5),
      max_bookings: slot.max_bookings,
      filled,
      available:    slot.max_bookings - filled,
      is_full:      filled >= slot.max_bookings,
      notes:        slot.notes,
    }
  })

  return NextResponse.json({ data: result }, { headers: corsHeaders(request) })
}
