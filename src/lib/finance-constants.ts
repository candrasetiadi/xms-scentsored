export const FINANCE_METHODS = [
  'Rekening Gina',
  'Rekening Dessy',
  'Rekening Alina',
  'Rekening Kevin',
  'BCA PT Scentsored',
  'Mandiri PT Scentsored',
  'Cash',
] as const

export type FinanceMethod = typeof FINANCE_METHODS[number]

export const FINANCE_REKENINGS = [
  'BCA PT Scentsored',
  'Mandiri PT Scentsored',
] as const

export type FinanceRekening = typeof FINANCE_REKENINGS[number]

export const TAX_CATS = [
  { n: 'Konsumsi Karyawan (Makan & Minum)', t: 'D',  akun: 'Beban Konsumsi Pegawai',        note: 'Deductible jika disediakan untuk seluruh pegawai di tempat kerja.' },
  { n: 'ATK & Perlengkapan Kantor',          t: 'D',  akun: 'Beban ATK & Perlengkapan',       note: 'Biaya usaha, dapat dikurangkan penuh.' },
  { n: 'Listrik, Air & Internet/Telepon',    t: 'D',  akun: 'Beban Utilitas',                 note: 'Biaya usaha, dapat dikurangkan penuh.' },
  { n: 'Sewa Tempat Usaha',                  t: 'D',  akun: 'Beban Sewa',                     note: 'Deductible; sewa tanah/bangunan wajib potong PPh Final 4(2) 10%.' },
  { n: 'Gaji, Upah & Tunjangan',             t: 'D',  akun: 'Beban Gaji & Tunjangan',         note: 'Deductible; natura/kenikmatan ikuti PMK 66/2023.' },
  { n: 'Pemeliharaan & Perbaikan',           t: 'D',  akun: 'Beban Pemeliharaan',             note: 'Biaya usaha, dapat dikurangkan penuh.' },
  { n: 'Kebersihan & Keamanan Toko',         t: 'D',  akun: 'Beban Kebersihan & Keamanan',    note: 'Biaya usaha, dapat dikurangkan penuh.' },
  { n: 'Transportasi & Perjalanan Dinas',    t: 'D',  akun: 'Beban Transportasi',             note: 'Deductible untuk keperluan usaha.' },
  { n: 'Promosi & Pemasaran',                t: 'DN', akun: 'Beban Promosi',                  note: 'Deductible tetapi wajib daftar nominatif di SPT.' },
  { n: 'Jamuan / Entertainment',             t: 'DN', akun: 'Beban Jamuan',                   note: 'Deductible tetapi wajib daftar nominatif di SPT.' },
  { n: 'Pajak & Retribusi Daerah',           t: 'D',  akun: 'Beban Pajak & Retribusi',        note: 'PBB, retribusi, pajak daerah (kecuali PPh).' },
  { n: 'Iuran RT/Lingkungan & Keamanan',     t: 'ND', akun: 'Beban Iuran Lingkungan',         note: 'Bersifat sumbangan — tidak dapat dikurangkan.' },
  { n: 'Sumbangan & Hadiah',                 t: 'ND', akun: 'Beban Sumbangan',                note: 'Tidak dapat dikurangkan (kecuali yang diatur PP).' },
  { n: 'Lainnya',                            t: 'R',  akun: 'Beban Operasional Lain',         note: 'Tinjau perlakuan pajaknya bersama finance/konsultan.' },
] as const

export type TaxCat = typeof TAX_CATS[number]

export const BAHAN_JENIS = [
  'Parfum Jadi',
  'Bahan Baku',
  'Kemasan',
  'Label & Sticker',
  'Lainnya',
] as const

export function taxChipStyle(t: string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    D:  { label: 'Deductible',       cls: 'bg-success-bg text-success border-success-bd' },
    ND: { label: 'Non-Deductible',   cls: 'bg-danger-bg text-danger border-danger-bd' },
    DN: { label: 'Daftar Nominatif', cls: 'bg-sand-100 text-ink-500 border-line' },
    R:  { label: 'Tinjau Manual',    cls: 'bg-warning-bg text-warning border-warning-bd' },
  }
  return map[t] ?? map['R']
}

export const EXP_TYPE_LABEL: Record<string, string> = {
  toko:   'Kebutuhan Toko',
  bahan:  'Bahan Baku & Produk',
  vendor: 'Pembayaran Vendor',
}
