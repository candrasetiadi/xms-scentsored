import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/v1/finance/bank-statements/import
// Body: { branch_id, rows: Array<{ rekening, date, jenis, nominal, keterangan }> }
// SheetJS parsing dilakukan di client, endpoint hanya terima array JSON siap insert.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await (supabase as any)
    .from('staff').select('id, role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !['owner', 'admin'].includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const body = await request.json()
  const { branch_id, rows } = body

  if (!branch_id || !Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: { code: 'MISSING_FIELDS' } }, { status: 400 })

  const VALID_REKENINGS = ['BCA PT Scentsored', 'Mandiri PT Scentsored']
  const VALID_JENIS     = ['kredit', 'debit', 'saldo']

  const inserts: any[] = []
  const skipped: string[] = []

  rows.forEach((r: any, i: number) => {
    const no = i + 1
    if (!VALID_REKENINGS.includes(r.rekening)) { skipped.push(`Baris ${no}: rekening tidak valid`); return }
    if (!VALID_JENIS.includes(r.jenis))        { skipped.push(`Baris ${no}: jenis tidak valid`);    return }
    if (!r.date)                               { skipped.push(`Baris ${no}: tanggal kosong`);        return }
    if (r.nominal == null || isNaN(+r.nominal)){ skipped.push(`Baris ${no}: nominal tidak valid`);  return }
    inserts.push({
      branch_id,
      rekening:    r.rekening,
      date:        r.date,
      jenis:       r.jenis,
      nominal:     Math.abs(+r.nominal),
      keterangan:  r.keterangan || null,
      created_by:  staff.id,
    })
  })

  if (inserts.length === 0)
    return NextResponse.json({ error: { message: 'Tidak ada baris valid untuk diimport.', skipped } }, { status: 400 })

  const { data, error } = await (supabase as any)
    .from('finance_bank_statements')
    .insert(inserts)
    .select('id')

  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 })

  return NextResponse.json({ inserted: data?.length ?? 0, skipped })
}
