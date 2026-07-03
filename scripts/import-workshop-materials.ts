#!/usr/bin/env npx tsx
/**
 * Import bahan workshop dari brand-assets/workshop-materials.csv
 * ke tabel workshop_materials di Supabase.
 *
 * Jalankan dari root project:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/import-workshop-materials.ts
 *
 * Atau buat file .env di root dan load dengan dotenv.
 *
 * Cleaning yang dilakukan:
 * - Normalisasi "Fruit" → "Fruity"
 * - Kategori kosong → category_id = null
 * - Stok kosong/blank → 0
 * - Decimal pakai koma (ID) → titik (sudah otomatis via parseFloat)
 * - Duplikat "Neroli" → rename "Neroli 10%" dan "Neroli 20%"
 * - Duplikat "Star Anis Oil" → merge (jumlahkan stok)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync }  from 'fs'
import { resolve }       from 'path'

// Auto-load apps/web/.env.local (simpel parser, tidak perlu dotenv dependency)
function loadEnvFile(path: string) {
  try {
    const content = readFileSync(path, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim()
      if (!process.env[key]) process.env[key] = val
    }
  } catch { /* file tidak ada, skip */ }
}

// Coba load .env.local dari apps/web (relatif ke script ini)
loadEnvFile(resolve(__dirname, '../.env.local'))

const SUPABASE_URL              = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) dan SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Normalisasi kategori
const CATEGORY_NORM: Record<string, string> = {
  'Fruit': 'Fruity',
}

function parseDecimal(raw: string): number {
  if (!raw || raw.trim() === '') return 0
  // Ganti koma sebagai decimal separator ke titik (format ID)
  const cleaned = raw.trim().replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

interface RawRow {
  name:                string
  dilution_percentage: string
  stock_gram:          string
  category:            string
}

interface CleanRow {
  name:                string
  dilution_percentage: number | null
  stock_gram:          number
  category_raw:        string | null  // setelah normalisasi
}

async function main() {
  console.log('📦 Import Workshop Materials')
  console.log('URL:', SUPABASE_URL)

  // ── Baca CSV ────────────────────────────────────────────────────────────────
  const csvPath = resolve(__dirname, '../../../brand-assets/workshop-materials.csv')
  const content = readFileSync(csvPath, 'utf8')
  const lines   = content.split('\n').filter(l => l.trim())

  // Parse header
  const header = lines[0].split(',').map(h => h.trim())
  const nameIdx   = header.indexOf('name')
  const dilIdx    = header.indexOf('dilution_percentage')
  const stockIdx  = header.indexOf('stock_gram')
  const catIdx    = header.indexOf('category')

  if (nameIdx === -1 || dilIdx === -1) {
    console.error('❌ Header CSV tidak sesuai:', header)
    process.exit(1)
  }

  const rawRows: RawRow[] = lines.slice(1).map(line => {
    const cols = line.split(',')
    return {
      name:                (cols[nameIdx]  ?? '').trim(),
      dilution_percentage: (cols[dilIdx]   ?? '').trim(),
      stock_gram:          (cols[stockIdx] ?? '').trim(),
      category:            (cols[catIdx]   ?? '').trim(),
    }
  }).filter(r => r.name)

  console.log(`📄 ${rawRows.length} baris ditemukan di CSV`)

  // ── Cleaning ────────────────────────────────────────────────────────────────
  // 1. Normalisasi kategori
  const cleanRows: CleanRow[] = rawRows.map(r => ({
    name:                r.name,
    dilution_percentage: r.dilution_percentage ? parseDecimal(r.dilution_percentage) : null,
    stock_gram:          parseDecimal(r.stock_gram),
    category_raw:        CATEGORY_NORM[r.category] ?? (r.category || null),
  }))

  // 2. Handle duplikat Neroli (beda dilution → rename)
  //    Cari semua Neroli
  const neroliRows = cleanRows.filter(r => r.name === 'Neroli')
  if (neroliRows.length > 1) {
    // Rename berdasarkan dilution_percentage
    for (const row of cleanRows) {
      if (row.name === 'Neroli') {
        row.name = `Neroli ${row.dilution_percentage ?? '?'}%`
      }
    }
    console.log('🔄 Neroli duplikat → diubah ke "Neroli 10%", "Neroli 20%"')
  }

  // 3. Handle duplikat Star Anis Oil (sama dilution → merge stok)
  const starAnisRows = cleanRows.filter(r => r.name === 'Star Anis Oil')
  if (starAnisRows.length > 1) {
    const totalStock = starAnisRows.reduce((s, r) => s + r.stock_gram, 0)
    // Simpan di baris pertama, hapus sisanya
    let first = true
    for (const row of cleanRows) {
      if (row.name === 'Star Anis Oil') {
        if (first) { row.stock_gram = totalStock; first = false }
        else row.name = '__SKIP__'
      }
    }
    console.log(`🔄 Star Anis Oil duplikat → stok digabung: ${totalStock.toFixed(2)}g`)
  }

  const finalRows = cleanRows.filter(r => r.name !== '__SKIP__')
  console.log(`✅ ${finalRows.length} baris setelah cleaning`)

  // ── Ambil kategori dari DB ──────────────────────────────────────────────────
  const { data: categories, error: catErr } = await admin
    .from('scent_categories')
    .select('id, name')

  if (catErr || !categories) {
    console.error('❌ Gagal ambil scent_categories:', catErr?.message)
    console.error('   Pastikan migration M15 sudah diapply terlebih dahulu.')
    process.exit(1)
  }

  const catMap = new Map<string, string>(
    categories.map(c => [c.name.toLowerCase(), c.id])
  )

  console.log(`🏷️  ${categories.length} kategori ditemukan di DB`)

  // ── Hitung bahan per kategori ───────────────────────────────────────────────
  const catCount: Record<string, number> = {}
  let nullCatCount = 0
  for (const row of finalRows) {
    const k = row.category_raw ?? '(kosong)'
    catCount[k] = (catCount[k] ?? 0) + 1
    if (!row.category_raw) nullCatCount++
  }
  console.log('\n📊 Distribusi kategori:')
  for (const [cat, cnt] of Object.entries(catCount).sort((a,b) => b[1]-a[1])) {
    console.log(`   ${cat.padEnd(20)} ${cnt} bahan`)
  }

  // ── Insert ke workshop_materials ────────────────────────────────────────────
  const inserts = finalRows.map(row => ({
    name:                row.name,
    dilution_percentage: row.dilution_percentage,
    stock_gram:          row.stock_gram,
    category_id:         row.category_raw
                           ? (catMap.get(row.category_raw.toLowerCase()) ?? null)
                           : null,
    branch_id:           null,     // global pool
    active:              true,
  }))

  // Warn kategori yang tidak match
  const unknownCats = new Set(
    finalRows
      .filter(r => r.category_raw && !catMap.has(r.category_raw.toLowerCase()))
      .map(r => r.category_raw)
  )
  if (unknownCats.size > 0) {
    console.warn('⚠️  Kategori tidak dikenali (akan jadi null):', [...unknownCats])
  }

  console.log(`\n⬆️  Menginsert ${inserts.length} bahan ke workshop_materials...`)

  // Batch insert (50 per batch untuk safety)
  const BATCH = 50
  let inserted = 0
  for (let i = 0; i < inserts.length; i += BATCH) {
    const batch = inserts.slice(i, i + BATCH)
    const { error } = await admin.from('workshop_materials').insert(batch)
    if (error) {
      console.error(`❌ Error pada batch ${i}-${i+batch.length}:`, error.message)
      process.exit(1)
    }
    inserted += batch.length
    console.log(`   ${inserted}/${inserts.length} bahan diinsert`)
  }

  console.log('\n✅ Import selesai!')
  console.log(`   Total: ${inserted} bahan`)
  console.log(`   Tanpa kategori: ${nullCatCount} bahan`)
}

main().catch(err => {
  console.error('❌ Fatal:', err)
  process.exit(1)
})
