/**
 * Import historical commission data from brand-assets/driver_commission.csv
 *
 * Usage:
 *   cd apps/web && npx tsx scripts/import-commissions.ts
 *
 * Requires apps/web/.env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Run TRUNCATE first in Supabase SQL Editor:
 *   TRUNCATE commission_transactions, commission_payouts, company_advance_fees CASCADE;
 */

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// ── Load env from apps/web/.env.local ────────────────────────────────────────
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env.local')
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing .env.local at ${envPath}`)
  }
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing')
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

// ── Date parsing ──────────────────────────────────────────────────────────────
const MONTHS: Record<string, string> = {
  januari: '01', februari: '02', maret: '03', april: '04',
  mei: '05', juni: '06', juli: '07', agustus: '08',
  september: '09', oktober: '10', november: '11', desember: '12',
}

function parseDate(raw: string): string | null {
  if (!raw.trim()) return null
  // Normalize: remove day name + separators, keep "DD MonthName YYYY"
  // Handles: "Senin / 26 Januari 2026", "Sabtu/ 06 Juni 2026", "Minggu 12 Juli 2026"
  const clean = raw.replace(/^[^/\d]*[/\s]?\s*/, '').trim()
  // Match: one or two digits, space, month name, space, 4-digit year
  const m = clean.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/)
  if (!m) return null
  const day   = m[1].padStart(2, '0')
  const month = MONTHS[m[2].toLowerCase()]
  const year  = m[3]
  if (!month) return null
  return `${year}-${month}-${day}`
}

// ── Amount parsing ────────────────────────────────────────────────────────────
function parseAmount(raw: string): number {
  // "  1,875,000 " → 1875000
  return parseInt(raw.replace(/[\s,]/g, ''), 10) || 0
}

function parsePct(raw: string): number {
  return parseFloat(raw.replace('%', '').trim()) || 15
}

// ── CSV parsing ───────────────────────────────────────────────────────────────
interface CsvRow {
  date:        string   // YYYY-MM-DD
  driverName:  string
  companyName: string
  saleAmount:  number
  feePct:      number
  feeAmount:   number
  payMethod:   string  // TRANSFER | TABUNG
  category:    string  // TRAVEL | AGENT
}

function parseCsv(filePath: string): CsvRow[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines   = content.split('\n')
  const rows: CsvRow[] = []

  for (let i = 1; i < lines.length; i++) { // skip header
    const line = lines[i]
    if (!line.trim()) continue

    // Parse CSV respecting quoted fields
    const fields = parseFields(line)
    if (fields.length < 7) continue

    const rawDate   = fields[0] ?? ''
    const driverRaw = (fields[1] ?? '').trim()
    const companyRaw = (fields[2] ?? '').trim()
    const nominalRaw = (fields[4] ?? '').trim()
    const pctRaw    = (fields[5] ?? '').trim()
    const komisiRaw = (fields[6] ?? '').trim()
    const method    = (fields[7] ?? '').trim()
    const category  = (fields[8] ?? '').trim()

    // Skip empty rows
    if (!driverRaw || !nominalRaw) continue

    const date = parseDate(rawDate)
    if (!date) {
      console.warn(`[SKIP] Line ${i + 1}: cannot parse date "${rawDate}"`)
      continue
    }

    const saleAmount = parseAmount(nominalRaw)
    const feeAmount  = parseAmount(komisiRaw)
    const feePct     = parsePct(pctRaw)

    if (saleAmount === 0) {
      console.warn(`[SKIP] Line ${i + 1}: sale_amount = 0`)
      continue
    }

    rows.push({
      date,
      driverName:  driverRaw,
      companyName: companyRaw || '',
      saleAmount,
      feePct,
      feeAmount,
      payMethod: method,
      category,
    })
  }

  return rows
}

function parseFields(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuote = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

// ── Upsert helpers ────────────────────────────────────────────────────────────
async function upsertCompanies(names: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (names.length === 0) return map

  // Fetch existing
  const { data: existing, error } = await (admin as any)
    .from('driver_companies')
    .select('id, name')
    .in('name', names)

  if (error) throw new Error(`Fetch companies failed: ${error.message}`)

  for (const c of existing ?? []) {
    map.set(c.name.trim(), c.id)
  }

  // Create missing
  const missing = names.filter(n => !map.has(n))
  if (missing.length > 0) {
    const inserts = missing.map(name => ({ name, fee_value: 5, is_active: true }))
    const { data: created, error: insertErr } = await (admin as any)
      .from('driver_companies')
      .insert(inserts)
      .select('id, name')

    if (insertErr) throw new Error(`Insert companies failed: ${insertErr.message}`)
    for (const c of created ?? []) {
      map.set(c.name.trim(), c.id)
    }
    console.log(`  Created ${missing.length} new companies`)
  }

  return map
}

async function upsertDrivers(names: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (names.length === 0) return map

  // Fetch existing by name
  const { data: existing, error } = await (admin as any)
    .from('drivers')
    .select('id, name')
    .in('name', names)

  if (error) throw new Error(`Fetch drivers failed: ${error.message}`)

  for (const d of existing ?? []) {
    map.set(d.name.trim(), d.id)
  }

  // Create missing — company_id = NULL (drivers work with multiple companies)
  const missing = names.filter(n => !map.has(n))
  if (missing.length > 0) {
    const inserts = missing.map(name => ({
      name,
      type:       'travel_driver',
      fee_value:  15,
      fee_type:   'percentage',
      company_id: null,
      active:     true,
    }))
    const { data: created, error: insertErr } = await (admin as any)
      .from('drivers')
      .insert(inserts)
      .select('id, name')

    if (insertErr) throw new Error(`Insert drivers failed: ${insertErr.message}`)
    for (const d of created ?? []) {
      map.set(d.name.trim(), d.id)
    }
    console.log(`  Created ${missing.length} new drivers`)
  }

  return map
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const csvPath = path.resolve(__dirname, '../../../brand-assets/driver_commission.csv')
  console.log('Reading CSV:', csvPath)
  const rows = parseCsv(csvPath)
  console.log(`Parsed ${rows.length} valid rows`)

  // Collect unique names
  const companyNames = [...new Set(
    rows.map(r => r.companyName).filter(Boolean)
  )]
  const driverNames = [...new Set(rows.map(r => r.driverName))]

  console.log(`Unique drivers: ${driverNames.length}, companies: ${companyNames.length}`)

  console.log('Upserting companies...')
  const companyMap = await upsertCompanies(companyNames)

  console.log('Upserting drivers...')
  const driverMap = await upsertDrivers(driverNames)

  // Build transaction inserts
  const txInserts = rows.map((row, idx) => {
    const driverId  = driverMap.get(row.driverName)
    const companyId = row.companyName ? companyMap.get(row.companyName) ?? null : null

    if (!driverId) {
      throw new Error(`Driver ID not found for "${row.driverName}" at row ${idx + 1}`)
    }

    return {
      driver_id:           driverId,
      company_id:          companyId,
      tx_date:             row.date,
      sale_amount:         row.saleAmount,
      admin_fee:           0,
      driver_fee_pct:      row.feePct,
      driver_fee_amount:   row.feeAmount,
      company_fee_pct:     companyId ? row.feePct : null,
      company_fee_amount:  companyId ? row.feeAmount : null,
      driver_fee_snapshot: {
        driver_name:   row.driverName,
        fee_pct:       row.feePct,
        calculated_at: new Date().toISOString(),
      },
      company_fee_snapshot: companyId ? {
        company_name:  row.companyName,
        fee_pct:       row.feePct,
        calculated_at: new Date().toISOString(),
      } : null,
      status:        'paid',
      transfer_date: row.date,
      transfer_note: row.payMethod || null,
      edit_history:  [],
    }
  })

  // Insert in batches of 200
  const BATCH = 200
  let inserted = 0
  for (let i = 0; i < txInserts.length; i += BATCH) {
    const batch = txInserts.slice(i, i + BATCH)
    const { error } = await (admin as any)
      .from('commission_transactions')
      .insert(batch)

    if (error) {
      throw new Error(`Insert batch ${Math.floor(i / BATCH) + 1} failed: ${error.message}`)
    }
    inserted += batch.length
    console.log(`  Inserted ${inserted}/${txInserts.length} transactions`)
  }

  console.log(`\nDone. ${inserted} commission_transactions inserted.`)
  console.log(`Drivers: ${driverMap.size}, Companies: ${companyMap.size}`)
}

main().catch(err => {
  console.error('Import failed:', err.message)
  process.exit(1)
})
