import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/v1/finance/journal?branch_id=&from=&to=
// Jurnal umum — dibuat dari income + expenses, format debit-kredit.
// Tidak ada tabel sendiri; digenerate on-the-fly.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const sp       = new URL(request.url).searchParams
  const branchId = sp.get('branch_id')
  const from     = sp.get('from')
  const to       = sp.get('to')

  if (!branchId) return NextResponse.json({ error: { code: 'MISSING_BRANCH' } }, { status: 400 })

  const [incRes, expRes] = await Promise.all([
    (supabase as any)
      .from('finance_income')
      .select('*')
      .eq('branch_id', branchId)
      .gte('date', from ?? '1970-01-01')
      .lte('date', to   ?? '9999-12-31')
      .order('date', { ascending: true }),
    (supabase as any)
      .from('finance_expenses')
      .select('*')
      .eq('branch_id', branchId)
      .gte('date', from ?? '1970-01-01')
      .lte('date', to   ?? '9999-12-31')
      .order('date', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  if (incRes.error) return NextResponse.json({ error: { message: incRes.error.message } }, { status: 500 })
  if (expRes.error) return NextResponse.json({ error: { message: expRes.error.message } }, { status: 500 })

  const EXP_AKUN: Record<string, string> = {
    bahan:  'Pembelian Bahan Baku & Produk',
    vendor: 'Beban Jasa Vendor',
  }

  // Tax category → account name map (toko)
  const TAX_AKUN: Record<string, string> = {
    'Konsumsi Karyawan (Makan & Minum)': 'Beban Konsumsi Pegawai',
    'ATK & Perlengkapan Kantor':          'Beban ATK & Perlengkapan',
    'Listrik, Air & Internet/Telepon':    'Beban Utilitas',
    'Sewa Tempat Usaha':                  'Beban Sewa',
    'Gaji, Upah & Tunjangan':             'Beban Gaji & Tunjangan',
    'Pemeliharaan & Perbaikan':           'Beban Pemeliharaan',
    'Kebersihan & Keamanan Toko':         'Beban Kebersihan & Keamanan',
    'Transportasi & Perjalanan Dinas':    'Beban Transportasi',
    'Promosi & Pemasaran':                'Beban Promosi',
    'Jamuan / Entertainment':             'Beban Jamuan',
    'Pajak & Retribusi Daerah':           'Beban Pajak & Retribusi',
    'Iuran RT/Lingkungan & Keamanan':     'Beban Iuran Lingkungan',
    'Sumbangan & Hadiah':                 'Beban Sumbangan',
    'Lainnya':                            'Beban Operasional Lain',
  }

  const entries: any[] = []

  // Income → credit each channel, debit Kas/Bank channel
  for (const x of incRes.data ?? []) {
    const channels = [
      { label: 'Gopay',        value: +x.gopay    },
      { label: 'Bank BCA',     value: +x.bca      },
      { label: 'Bank Mandiri', value: +x.mandiri  },
      { label: 'Cash',         value: +x.cash     },
    ]
    for (const ch of channels) {
      if (ch.value <= 0) continue
      entries.push({
        date:    x.date,
        ref:     x.id,
        type:    'income',
        debit:   ch.label,
        credit:  'Pendapatan Penjualan',
        akun:    ch.label,
        nominal: ch.value,
        note:    x.note || null,
      })
    }
  }

  // Expenses → debit expense account, credit payment method
  for (const x of expRes.data ?? []) {
    const akun = x.type === 'toko'
      ? (TAX_AKUN[x.cat] ?? 'Beban Operasional Lain')
      : EXP_AKUN[x.type] ?? 'Beban Operasional Lain'
    entries.push({
      date:    x.date,
      ref:     x.id,
      type:    x.type,
      debit:   akun,
      credit:  x.method,
      akun,
      nominal: +x.amount,
      note:    x.note || null,
      cat:     x.cat || null,
      who:     x.who || null,
    })
  }

  // Sort by date asc, then income before expense
  entries.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    if (a.type === 'income' && b.type !== 'income') return -1
    if (a.type !== 'income' && b.type === 'income') return 1
    return 0
  })

  return NextResponse.json({ data: entries })
}
