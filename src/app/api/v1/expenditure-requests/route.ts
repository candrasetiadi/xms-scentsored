import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET  /api/v1/expenditure-requests?status=pending&branch_id=
// POST /api/v1/expenditure-requests
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

    const { data: staff } = await supabase
      .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
    if (!staff) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')

    let query = (supabase as any)
      .from('expenditure_requests')
      .select(`
        id, title, description, total_estimated, status,
        submitted_at, reviewed_at, created_at, updated_at,
        branch_id,
        requester:requester_id(id, name, role),
        reviewer:reviewer_id(id, name),
        reviewer_note,
        expenditure_request_items(id, name, qty, unit_price, subtotal, note)
      `)
      .order('created_at', { ascending: false })

    // Non-manager hanya lihat milik sendiri
    if (!['owner', 'admin'].includes(staff.role)) {
      query = query.eq('requester_id', staff.id)
    }

    if (statusFilter) query = query.eq('status', statusFilter)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    console.error('[expenditure-requests GET]', err)
    return NextResponse.json({ error: { code: 'INTERNAL' } }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

    const { data: staff } = await supabase
      .from('staff').select('id, role, branch_id').eq('auth_user_id', user.id).eq('active', true).single()
    if (!staff) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

    // Owner/admin lintas cabang → branch_id null, fallback ke branch utama (is_primary)
    let branchId = staff.branch_id
    if (!branchId) {
      const { data: primaryBranch } = await supabase
        .from('branches').select('id').eq('is_primary', true).single()
      branchId = primaryBranch?.id ?? null
    }
    if (!branchId) {
      return NextResponse.json({ error: { code: 'VALIDATION', message: 'Branch tidak ditemukan.' } }, { status: 400 })
    }

    const body = await request.json()
    const { title, description, items } = body as {
      title:       string
      description: string | null
      items:       { name: string; qty: number; unit_price: number; note?: string }[]
    }

    if (!title?.trim()) {
      return NextResponse.json({ error: { code: 'VALIDATION', message: 'Judul wajib diisi.' } }, { status: 400 })
    }
    if (!items?.length) {
      return NextResponse.json({ error: { code: 'VALIDATION', message: 'Minimal 1 item.' } }, { status: 400 })
    }

    const totalEstimated = items.reduce((sum, i) => sum + i.qty * i.unit_price, 0)

    const { data: req, error: reqErr } = await (supabase as any)
      .from('expenditure_requests')
      .insert({
        branch_id:       branchId,
        requester_id:    staff.id,
        title:           title.trim(),
        description:     description?.trim() || null,
        total_estimated: totalEstimated,
        status:          'draft',
      })
      .select('id')
      .single()

    if (reqErr) return NextResponse.json({ error: { code: 'DB_ERROR', message: reqErr.message } }, { status: 500 })

    const itemRows = items.map(i => ({
      request_id: req.id,
      name:       i.name.trim(),
      qty:        i.qty,
      unit_price: i.unit_price,
      note:       i.note?.trim() || null,
    }))

    const { error: itemErr } = await (supabase as any)
      .from('expenditure_request_items')
      .insert(itemRows)

    if (itemErr) return NextResponse.json({ error: { code: 'DB_ERROR', message: itemErr.message } }, { status: 500 })

    return NextResponse.json({ data: { id: req.id } }, { status: 201 })
  } catch (err) {
    console.error('[expenditure-requests POST]', err)
    return NextResponse.json({ error: { code: 'INTERNAL' } }, { status: 500 })
  }
}
