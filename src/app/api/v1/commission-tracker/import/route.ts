import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const MANAGER_ROLES = ['owner', 'admin']

// Shape dari JSON yang di-export oleh commission_tracker.html
interface HtmlTransaction {
  id:            number           // timestamp numeric
  driver:        string           // nama mitra (string)
  company?:      string           // nama perusahaan (string, opsional)
  date:          string           // YYYY-MM-DD
  amount:        number           // nilai penjualan
  note?:         string
  admin?:        number           // biaya admin
  driverComm:    number           // komisi mitra (sudah dihitung di HTML)
  travelComm?:   number           // komisi perusahaan
  status:        'pending' | 'paid'
  transferDate?: string | null
  transferNote?: string | null
  photoReceipt?: string | null    // base64 atau null (foto tidak diimport)
  photoGuest?:   string | null
  transferPhoto?: string | null
  editHistory?:  unknown[]
}

interface HtmlAdvanceFee {
  id?:      number
  company:  string
  amount:   number
  date:     string
  note?:    string
}

interface ImportPayload {
  exported_at?:  string
  drivers?:      string[]
  companies?:    string[]
  transactions:  HtmlTransaction[]
  advance_fees?: HtmlAdvanceFee[]
}

// POST /api/v1/commission-tracker/import
// Body: JSON yang di-export dari commission_tracker.html
// Owner/admin only. Idempotent per (driver_name, tx_date, sale_amount).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff').select('id, role').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || !MANAGER_ROLES.includes(staff.role))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  let payload: ImportPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Body harus JSON valid.' } }, { status: 400 })
  }

  if (!Array.isArray(payload.transactions)) {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Field "transactions" wajib berupa array.' } }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── 1. Kumpulkan nama unik driver dan company ─────────────────
  const driverNames  = new Set<string>()
  const companyNames = new Set<string>()

  // Dari standalone arrays (drivers/companies yang belum tentu ada di transaksi)
  for (const name of (payload.drivers ?? [])) {
    if (typeof name === 'string' && name.trim()) driverNames.add(name.trim())
  }
  for (const name of (payload.companies ?? [])) {
    if (typeof name === 'string' && name.trim()) companyNames.add(name.trim())
  }
  // Dari transaksi (supaya semua nama ter-cover)
  for (const tx of payload.transactions) {
    if (tx.driver?.trim()) driverNames.add(tx.driver.trim())
    if (tx.company?.trim()) companyNames.add(tx.company.trim())
  }
  for (const af of (payload.advance_fees ?? [])) {
    if (af.company?.trim()) companyNames.add(af.company.trim())
  }

  // ── 2. Fetch existing drivers dan companies ───────────────────
  const { data: existingDrivers } = await (admin as any)
    .from('drivers')
    .select('id, name')

  const { data: existingCompanies } = await (admin as any)
    .from('driver_companies')
    .select('id, name')

  // Map name (lowercase) → id
  const driverMap  = new Map<string, string>()
  const companyMap = new Map<string, string>()

  for (const d of (existingDrivers ?? []) as { id: string; name: string }[]) {
    driverMap.set(d.name.trim().toLowerCase(), d.id)
  }
  for (const c of (existingCompanies ?? []) as { id: string; name: string }[]) {
    companyMap.set(c.name.trim().toLowerCase(), c.id)
  }

  // ── 3. Upsert drivers yang belum ada ─────────────────────────
  let createdDrivers = 0
  for (const name of driverNames) {
    const key = name.toLowerCase()
    if (!driverMap.has(key)) {
      const { data: newDriver } = await (admin as any)
        .from('drivers')
        .insert({ name, fee_value: 15, fee_type: 'percentage', type: 'travel_driver', active: true })
        .select('id')
        .single()
      if (newDriver) {
        driverMap.set(key, (newDriver as { id: string }).id)
        createdDrivers++
      }
    }
  }

  // ── 4. Upsert companies yang belum ada ────────────────────────
  let createdCompanies = 0
  for (const name of companyNames) {
    const key = name.toLowerCase()
    if (!companyMap.has(key)) {
      const { data: newCompany } = await (admin as any)
        .from('driver_companies')
        .insert({ name, fee_value: 5, fee_type: 'percentage', is_active: true })
        .select('id')
        .single()
      if (newCompany) {
        companyMap.set(key, (newCompany as { id: string }).id)
        createdCompanies++
      }
    }
  }

  // ── 5. Import transactions ────────────────────────────────────
  // Idempotent: skip baris yang duplikat berdasarkan (driver_id, tx_date, sale_amount)
  // Gunakan fee amount dari JSON (preserves historical data), bukan recalculate.
  // Foto tidak diimport — disimpan sebagai null (foto sudah di HTML lokal saja).

  const { data: existingTxs } = await (admin as any)
    .from('commission_transactions')
    .select('driver_id, tx_date, sale_amount')

  // Build set untuk dedup check: "driverUuid|date|amount"
  const existingSet = new Set<string>()
  for (const t of (existingTxs ?? []) as { driver_id: string; tx_date: string; sale_amount: number }[]) {
    existingSet.add(`${t.driver_id}|${t.tx_date}|${t.sale_amount}`)
  }

  let importedTx  = 0
  let skippedTx   = 0
  const txErrors: string[] = []

  for (const tx of payload.transactions) {
    const driverName = tx.driver?.trim()
    if (!driverName) { skippedTx++; continue }

    const driverId = driverMap.get(driverName.toLowerCase())
    if (!driverId) { skippedTx++; continue }

    const companyName = tx.company?.trim()
    const companyId   = companyName ? (companyMap.get(companyName.toLowerCase()) ?? null) : null

    const txDate    = tx.date
    const saleAmt   = Number(tx.amount ?? 0)
    const dedupKey  = `${driverId}|${txDate}|${saleAmt}`

    if (existingSet.has(dedupKey)) { skippedTx++; continue }

    const driverComm  = Number(tx.driverComm ?? 0)
    const companyComm = Number(tx.travelComm ?? 0)
    const adminFee    = Number(tx.admin ?? 0)

    // Hitung fee_pct dari amount (preserves original %)
    const driverFeePct  = saleAmt > 0 ? Math.round((driverComm  / saleAmt) * 100 * 100) / 100 : 15
    const companyFeePct = saleAmt > 0 && companyComm > 0
      ? Math.round((companyComm / saleAmt) * 100 * 100) / 100
      : (companyId ? 5 : null)

    const row = {
      driver_id:            driverId,
      company_id:           companyId,
      tx_date:              txDate,
      sale_amount:          saleAmt,
      admin_fee:            adminFee,
      driver_fee_pct:       driverFeePct,
      driver_fee_amount:    driverComm,
      company_fee_pct:      companyFeePct,
      company_fee_amount:   companyId ? companyComm : null,
      driver_fee_snapshot:  JSON.stringify({ driver_name: driverName, fee_pct: driverFeePct, calculated_at: new Date().toISOString() }),
      company_fee_snapshot: companyId
        ? JSON.stringify({ company_name: companyName, fee_pct: companyFeePct, calculated_at: new Date().toISOString() })
        : null,
      status:               tx.status ?? 'pending',
      transfer_date:        tx.transferDate ?? null,
      // tx.note = catatan umum dari HTML; tx.transferNote = catatan transfer.
      // commission_transactions hanya punya kolom transfer_note — gabungkan keduanya.
      transfer_note:        tx.transferNote ?? tx.note ?? null,
      edit_history:         JSON.stringify([]),
      created_by_id:        staff.id,
    }

    const { error: insertErr } = await (admin as any)
      .from('commission_transactions')
      .insert(row)

    if (insertErr) {
      txErrors.push(`tx ${tx.id}: ${insertErr.message}`)
      skippedTx++
    } else {
      existingSet.add(dedupKey)
      importedTx++
    }
  }

  // ── 6. Import advance fees ────────────────────────────────────
  let importedAdvanceFees = 0
  let skippedAdvanceFees  = 0

  for (const af of (payload.advance_fees ?? [])) {
    const companyName = af.company?.trim()
    if (!companyName) { skippedAdvanceFees++; continue }

    const companyId = companyMap.get(companyName.toLowerCase())
    if (!companyId) { skippedAdvanceFees++; continue }

    const { error: afErr } = await (admin as any)
      .from('company_advance_fees')
      .insert({
        company_id:     companyId,
        amount:         Number(af.amount),
        given_at:       af.date,
        notes:          af.note ?? null,
        created_by_id:  staff.id,
      })

    if (afErr) { skippedAdvanceFees++ } else { importedAdvanceFees++ }
  }

  return NextResponse.json({
    data: {
      created_drivers:    createdDrivers,
      created_companies:  createdCompanies,
      imported_tx:        importedTx,
      skipped_tx:         skippedTx,
      imported_advance_fees: importedAdvanceFees,
      skipped_advance_fees:  skippedAdvanceFees,
      tx_errors:          txErrors.length > 0 ? txErrors : undefined,
    }
  })
}
