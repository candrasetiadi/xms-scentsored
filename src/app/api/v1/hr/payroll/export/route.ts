import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'

// GET /api/v1/hr/payroll/export?period_year=2026&period_month=7&branch_id=
// Manager only. Returns text/csv with BOM so Excel bisa buka tanpa encoding issues.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role, branch_id')
    .eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const yearParam   = searchParams.get('period_year')
  const monthParam  = searchParams.get('period_month')
  const branchParam = searchParams.get('branch_id')

  if (!yearParam || isNaN(Number(yearParam)))
    return NextResponse.json({ error: 'period_year wajib diisi.' }, { status: 400 })

  const year  = parseInt(yearParam)
  const month = monthParam && !isNaN(Number(monthParam)) ? parseInt(monthParam) : null

  // Manager lintas cabang (owner tanpa param) atau dibatasi branch sendiri
  const effectiveBranch = branchParam || (staff.role !== 'owner' ? staff.branch_id : null)

  let query = supabase
    .from('payslips')
    .select(`
      id,
      gross,
      total_allowances,
      total_deductions,
      overtime_amount,
      sales_fee_amount,
      tax_amount,
      net,
      status,
      staff:staff_id ( name, employee_number ),
      payroll_run:payroll_run_id (
        period_month,
        period_year,
        branch:branch_id ( name )
      )
    `)
    .order('staff(name)')

  // Filtering perlu dilakukan lewat payroll_runs — pakai filter nested
  // Supabase tidak support filter nested langsung, jadi ambil run_ids dulu
  let runsQuery = supabase
    .from('payroll_runs')
    .select('id')
    .eq('period_year', year)

  if (month) runsQuery = runsQuery.eq('period_month', month)
  if (effectiveBranch) runsQuery = runsQuery.eq('branch_id', effectiveBranch)

  const { data: runs, error: runsErr } = await runsQuery
  if (runsErr) return NextResponse.json({ error: runsErr.message }, { status: 500 })
  if (!runs || runs.length === 0) return buildCsvResponse([], year, month)

  const runIds = runs.map(r => r.id)
  query = query.in('payroll_run_id', runIds)

  const { data: rows, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return buildCsvResponse(rows ?? [], year, month)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCsvResponse(rows: any[], year: number, month: number | null) {
  const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni',
                  'Juli','Agustus','September','Oktober','November','Desember']

  const periodLabel = month ? `${MONTHS[month - 1]}_${year}` : String(year)
  const filename = `payroll_${periodLabel}.csv`

  const headers = [
    'Cabang',
    'NIK',
    'Nama Karyawan',
    'Periode',
    'Gaji Pokok + Tunjangan',
    'Lembur',
    'Komisi Penjualan',
    'Total Potongan',
    'Pajak (Manual)',
    'Gaji Bersih',
    'Status',
  ]

  const csvRows = rows.map(r => {
    const s   = r.staff  as { name: string; employee_number: string | null } | null
    const pr  = r.payroll_run as { period_month: number; period_year: number; branch: { name: string } | null } | null
    const period = pr ? `${MONTHS[(pr.period_month ?? 1) - 1]} ${pr.period_year}` : ''
    return [
      pr?.branch?.name ?? '',
      s?.employee_number ?? '',
      s?.name ?? '',
      period,
      r.gross ?? 0,
      r.overtime_amount ?? 0,
      r.sales_fee_amount ?? 0,
      r.total_deductions ?? 0,
      r.tax_amount ?? 0,
      r.net ?? 0,
      r.status ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`)
     .join(',')
  })

  // UTF-8 BOM supaya Excel Windows bisa buka tanpa encoding rusak
  const BOM  = '﻿'
  const body = BOM + [headers.join(','), ...csvRows].join('\r\n')

  return new Response(body, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
