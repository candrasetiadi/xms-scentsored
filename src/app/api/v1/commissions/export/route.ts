import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MANAGER_ROLES = ['owner', 'admin']

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtRp(n: number | null) {
  if (n == null) return ''
  return new Intl.NumberFormat('id-ID').format(n)
}

// GET /api/v1/commissions/export?type=driver|agency&id=<uuid>&from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns CSV file
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !MANAGER_ROLES.includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') // 'driver' | 'agency'
  const id   = searchParams.get('id')
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  if (!type || !['driver', 'agency'].includes(type))
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'type harus driver atau agency.' } }, { status: 400 })
  if (!id)
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'id wajib.' } }, { status: 400 })

  let query = supabase
    .from('driver_fees')
    .select(`
      base_amount, fee_amount, status, agency_fee_amount, agency_status,
      accrued_at,
      drivers!inner(id, name),
      travel_agencies(id, name),
      orders!inner(order_number, paid_at, branches(name))
    `)
    .order('accrued_at', { ascending: true })

  if (type === 'driver') query = query.eq('driver_id', id)
  if (type === 'agency') query = query.eq('agency_id', id)
  if (from) query = query.gte('accrued_at', from)
  if (to)   query = query.lte('accrued_at', to + 'T23:59:59')

  const { data: fees, error } = await query
  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  // Build CSV
  const rows: string[] = []

  if (type === 'driver') {
    rows.push(['Tanggal', 'No. Order', 'Cabang', 'Total Penjualan', 'Komisi Driver (Rp)', 'Status Komisi Driver', 'Perusahaan', 'Komisi Perusahaan (Rp)', 'Status Komisi Perusahaan'].join(','))
    for (const f of fees ?? []) {
      const order  = f.orders   as unknown as { order_number: string; paid_at: string; branches: { name: string } | null }
      const agency = f.travel_agencies as unknown as { name: string } | null
      rows.push([
        fmtDate(order.paid_at),
        order.order_number,
        order.branches?.name ?? '',
        fmtRp(f.base_amount),
        fmtRp(f.fee_amount),
        f.status === 'paid' ? 'Sudah Dibayar' : 'Pending',
        agency?.name ?? '-',
        f.agency_fee_amount ? fmtRp(f.agency_fee_amount) : '-',
        f.agency_status ? (f.agency_status === 'paid' ? 'Sudah Dibayar' : 'Pending') : '-',
      ].map(v => `"${v}"`).join(','))
    }
  } else {
    rows.push(['Tanggal', 'No. Order', 'Cabang', 'Nama Mitra', 'Total Penjualan', 'Komisi Perusahaan (Rp)', 'Status'].join(','))
    for (const f of fees ?? []) {
      const order  = f.orders  as unknown as { order_number: string; paid_at: string; branches: { name: string } | null }
      const driver = f.drivers as unknown as { name: string }
      rows.push([
        fmtDate(order.paid_at),
        order.order_number,
        order.branches?.name ?? '',
        driver.name,
        fmtRp(f.base_amount),
        f.agency_fee_amount ? fmtRp(f.agency_fee_amount) : '0',
        f.agency_status === 'paid' ? 'Sudah Dibayar' : 'Pending',
      ].map(v => `"${v}"`).join(','))
    }
  }

  const csv      = rows.join('\n')
  const filename = `komisi-${type}-${id.slice(0, 8)}-${from ?? 'all'}-${to ?? 'now'}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
