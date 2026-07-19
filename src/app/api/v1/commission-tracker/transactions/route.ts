import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const MANAGER_ROLES = ['owner', 'admin']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// GET /api/v1/commission-tracker/transactions
// Query params: q, status, from, to, page (default 0), limit (default 20, max 50)
// Owner/admin only
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await (supabase as any).from('staff').select('role, can_access_commission').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || (!MANAGER_ROLES.includes(staff.role) && !(staff as any).can_access_commission))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const q      = searchParams.get('q')?.trim() ?? ''
  const status = searchParams.get('status') ?? ''
  const from   = searchParams.get('from')
  const to     = searchParams.get('to')
  const page   = Math.max(0, parseInt(searchParams.get('page') ?? '0'))
  const limit  = Math.min(Math.max(1, parseInt(searchParams.get('limit') ?? '20')), 50)

  // Step 1: fetch commission_transactions with status + date filters
  let txQuery = (supabase as any)
    .from('commission_transactions')
    .select(
      'id, tx_date, sale_amount, admin_fee, driver_fee_pct, driver_fee_amount, ' +
      'company_fee_pct, company_fee_amount, status, transfer_date, transfer_note, ' +
      'receipt_photo_url, guest_photo_url, transfer_photo_url, edit_history, ' +
      'driver_id, company_id, created_at, updated_at'
    )
    .order('tx_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (status === 'pending' || status === 'paid') txQuery = txQuery.eq('status', status)
  if (from) txQuery = txQuery.gte('tx_date', from)
  if (to)   txQuery = txQuery.lte('tx_date', to)

  const { data: txRows, error: txErr } = await txQuery
  if (txErr) return NextResponse.json({ error: { code: 'DB_ERROR', message: txErr.message } }, { status: 500 })

  const allTx: any[] = txRows ?? []

  // Step 2: collect unique driver_ids and company_ids
  const driverIds  = [...new Set(allTx.map(r => r.driver_id).filter(Boolean))]
  const companyIds = [...new Set(allTx.map(r => r.company_id).filter(Boolean))]

  // Step 3 + 4: fetch drivers and companies in parallel
  const [driversRes, companiesRes] = await Promise.all([
    driverIds.length
      ? supabase.from('drivers').select('id, name, phone').in('id', driverIds)
      : { data: [] },
    companyIds.length
      ? (supabase as any).from('driver_companies').select('id, name').in('id', companyIds)
      : { data: [] },
  ])

  const driverMap  = new Map<string, { name: string; phone: string | null }>(
    (driversRes.data ?? []).map((d: { id: string; name: string; phone: string | null }) => [d.id, { name: d.name, phone: d.phone }])
  )
  const companyMap = new Map<string, { name: string }>(
    (companiesRes.data ?? []).map((c: { id: string; name: string }) => [c.id, { name: c.name }])
  )

  // Step 5: merge and apply search filter
  const merged = allTx.map(tx => ({
    ...tx,
    driver_name:  driverMap.get(tx.driver_id)?.name ?? null,
    driver_phone: driverMap.get(tx.driver_id)?.phone ?? null,
    company_name: tx.company_id ? (companyMap.get(tx.company_id)?.name ?? null) : null,
  }))

  const filtered = q
    ? merged.filter(tx =>
        (tx.driver_name ?? '').toLowerCase().includes(q.toLowerCase()) ||
        (tx.company_name ?? '').toLowerCase().includes(q.toLowerCase())
      )
    : merged

  // Step 6: paginate
  const total_count = filtered.length
  const transactions = filtered.slice(page * limit, page * limit + limit)

  return NextResponse.json({
    data: { transactions, total_count, page, limit }
  })
}

// POST /api/v1/commission-tracker/transactions
// Body: { driver_id, company_id?, tx_date, sale_amount, admin_fee?, status?, transfer_date?, transfer_note?, notes? }
// Owner/admin only
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await (supabase as any).from('staff').select('id, role, can_access_commission').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || (!MANAGER_ROLES.includes(staff.role) && !(staff as any).can_access_commission))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  let body: {
    driver_id: string
    company_id?: string
    tx_date: string
    sale_amount: number
    admin_fee?: number
    status?: string
    transfer_date?: string
    transfer_note?: string
    notes?: string
  }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Body tidak valid.' } }, { status: 400 })
  }

  // Validation
  if (!body.driver_id || !UUID_RE.test(body.driver_id))
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'driver_id harus UUID valid.' } }, { status: 400 })
  if (!body.tx_date || !DATE_RE.test(body.tx_date))
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'tx_date harus format YYYY-MM-DD.' } }, { status: 400 })
  if (!body.sale_amount || body.sale_amount <= 0)
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'sale_amount harus lebih dari 0.' } }, { status: 400 })
  if (body.company_id && !UUID_RE.test(body.company_id))
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'company_id harus UUID valid.' } }, { status: 400 })
  if (body.status === 'paid' && !body.transfer_date)
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'transfer_date wajib jika status paid.' } }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await (admin as any).rpc('create_commission_transaction', {
    p: {
      driver_id:     body.driver_id,
      company_id:    body.company_id ?? null,
      tx_date:       body.tx_date,
      sale_amount:   body.sale_amount,
      admin_fee:     body.admin_fee ?? 0,
      status:        body.status ?? 'pending',
      transfer_date: body.transfer_date ?? null,
      transfer_note: body.transfer_note ?? null,
      notes:         body.notes ?? null,
      created_by_id: staff.id,
    }
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('tidak ditemukan'))
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: msg } }, { status: 404 })
    return NextResponse.json({ error: { code: 'DB_ERROR', message: msg } }, { status: 500 })
  }

  return NextResponse.json({ data: { transaction: data } }, { status: 201 })
}
