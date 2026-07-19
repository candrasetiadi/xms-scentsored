'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

interface ImportResult {
  created_drivers:       number
  created_companies:     number
  imported_tx:           number
  skipped_tx:            number
  imported_advance_fees: number
  skipped_advance_fees:  number
  tx_errors?:            string[]
}

interface PreviewData {
  drivers:      string[]
  companies:    string[]
  tx_count:     number
  advance_count: number
  sample_txs:   { driver: string; company?: string; date: string; amount: number; status: string }[]
}

function fmtRp(n: number) {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n))
}

export default function CommissionTrackerImportPage() {
  const fileRef    = useRef<HTMLInputElement>(null)
  const [fileName, setFileName]     = useState<string | null>(null)
  const [rawJson,  setRawJson]      = useState<unknown>(null)
  const [preview,  setPreview]      = useState<PreviewData | null>(null)
  const [parseErr, setParseErr]     = useState<string | null>(null)
  const [importing, setImporting]   = useState(false)
  const [result,   setResult]       = useState<ImportResult | null>(null)
  const [importErr, setImportErr]   = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setPreview(null)
    setParseErr(null)
    setResult(null)
    setImportErr(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        if (!Array.isArray(parsed.transactions)) {
          setParseErr('File tidak valid: field "transactions" tidak ditemukan.')
          return
        }

        const txs = parsed.transactions as { driver?: string; company?: string; date?: string; amount?: number; status?: string }[]
        const driverSet  = new Set<string>()
        const companySet = new Set<string>()
        for (const tx of txs) {
          if (tx.driver?.trim())  driverSet.add(tx.driver.trim())
          if (tx.company?.trim()) companySet.add(tx.company.trim())
        }

        setRawJson(parsed)
        setPreview({
          drivers:      [...driverSet].sort(),
          companies:    [...companySet].sort(),
          tx_count:     txs.length,
          advance_count: (parsed.advance_fees ?? []).length,
          sample_txs:   txs.slice(0, 5).map(t => ({
            driver:  t.driver ?? '—',
            company: t.company,
            date:    t.date ?? '—',
            amount:  Number(t.amount ?? 0),
            status:  t.status ?? 'pending',
          })),
        })
      } catch {
        setParseErr('File bukan JSON valid atau format tidak dikenali.')
      }
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!rawJson) return
    setImporting(true)
    setImportErr(null)
    setResult(null)

    try {
      const res  = await fetch('/api/v1/commission-tracker/import', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(rawJson),
      })
      const json = await res.json()

      if (!res.ok) {
        setImportErr(json.error?.message ?? 'Import gagal.')
      } else {
        setResult(json.data as ImportResult)
      }
    } catch {
      setImportErr('Terjadi kesalahan jaringan.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={{ background: '#f0ede7', minHeight: '100vh', padding: '1.5rem 1rem 4rem' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ background: '#064733', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 20, color: '#F5F0E8', letterSpacing: 2, textTransform: 'uppercase' }}>
            Commission Tracker
          </div>
          <div style={{ fontSize: 12, color: '#7a9a8a', marginTop: 4 }}>Import Data dari HTML Lama</div>
        </div>

        {/* Instruksi */}
        <div style={{ background: '#fff', border: '.5px solid rgba(0,0,0,.09)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#064733', textTransform: 'uppercase', letterSpacing: '.9px', marginBottom: '.75rem', paddingBottom: 8, borderBottom: '1px solid #e8e0d0' }}>
            Cara Import
          </div>
          <ol style={{ fontSize: 13, color: '#444', lineHeight: 2, paddingLeft: '1.25rem' }}>
            <li>Buka file <code style={{ background: '#f5f0e8', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>commission_tracker.html</code> di browser</li>
            <li>Scroll ke bawah → bagian <strong>Export</strong></li>
            <li>Klik <strong>"⬇ Export Semua Data (JSON)"</strong></li>
            <li>Upload file JSON yang terdownload di sini</li>
            <li>Review preview, lalu klik <strong>Mulai Import</strong></li>
          </ol>
          <div style={{ fontSize: 11, color: '#888', marginTop: '.75rem', padding: '8px 12px', background: '#f8f6f1', borderRadius: 8 }}>
            · Mitra/perusahaan yang sudah ada akan dipakai (tidak duplikat)<br />
            · Mitra baru dibuat otomatis dengan komisi default 15%<br />
            · Perusahaan baru dibuat otomatis dengan komisi default 5%<br />
            · Transaksi duplikat (mitra + tanggal + nominal sama) dilewati<br />
            · Foto tidak diimport (hanya data teks dan nominal)
          </div>
        </div>

        {/* Upload */}
        <div style={{ background: '#fff', border: '.5px solid rgba(0,0,0,.09)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#064733', textTransform: 'uppercase', letterSpacing: '.9px', marginBottom: '1rem' }}>
            Upload File JSON
          </div>
          <label
            style={{ display: 'block', border: '1.5px dashed #c5bfb5', borderRadius: 10, padding: '2rem', textAlign: 'center', cursor: 'pointer', background: '#faf7f0' }}
            onClick={() => fileRef.current?.click()}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
            <div style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>
              {fileName ?? 'Klik untuk pilih file JSON'}
            </div>
            {fileName && <div style={{ fontSize: 11, color: '#15803d', marginTop: 4 }}>✓ File terpilih</div>}
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          {parseErr && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: '#fee2e2', borderRadius: 8, fontSize: 12, color: '#b42318' }}>
              {parseErr}
            </div>
          )}
        </div>

        {/* Preview */}
        {preview && !result && (
          <div style={{ background: '#fff', border: '.5px solid rgba(0,0,0,.09)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#064733', textTransform: 'uppercase', letterSpacing: '.9px', marginBottom: '1rem', paddingBottom: 8, borderBottom: '1px solid #e8e0d0' }}>
              Preview Data
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1rem' }}>
              {[
                { label: 'Transaksi', val: preview.tx_count },
                { label: 'Mitra', val: preview.drivers.length },
                { label: 'Perusahaan', val: preview.companies.length },
              ].map(({ label, val }) => (
                <div key={label} style={{ background: '#F5F0E8', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: '#064733', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: '#1e3f30' }}>{val}</div>
                </div>
              ))}
            </div>

            {preview.advance_count > 0 && (
              <div style={{ fontSize: 12, color: '#0369a1', background: '#e0f2fe', borderRadius: 8, padding: '8px 12px', marginBottom: '1rem' }}>
                + {preview.advance_count} advance fee perusahaan akan diimport
              </div>
            )}

            <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 8 }}>Sample 5 transaksi pertama:</div>
            <div style={{ border: '.5px solid rgba(0,0,0,.07)', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#F5F0E8' }}>
                    {['Tanggal', 'Mitra', 'Perusahaan', 'Nilai', 'Status'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: '#064733', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample_txs.map((tx, i) => (
                    <tr key={i} style={{ borderTop: '.5px solid rgba(0,0,0,.07)' }}>
                      <td style={{ padding: '6px 8px', color: '#555' }}>{tx.date}</td>
                      <td style={{ padding: '6px 8px' }}>{tx.driver}</td>
                      <td style={{ padding: '6px 8px', color: '#888' }}>{tx.company ?? '—'}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 600 }}>{fmtRp(tx.amount)}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <span style={{
                          padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                          background: tx.status === 'paid' ? '#dcfce7' : '#fef3c7',
                          color:      tx.status === 'paid' ? '#15803d' : '#b45309',
                        }}>
                          {tx.status === 'paid' ? 'Paid' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: 10 }}>
              <button
                onClick={handleImport}
                disabled={importing}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: importing ? '#aaa' : '#064733', color: '#fff', fontSize: 13, fontWeight: 600, cursor: importing ? 'not-allowed' : 'pointer' }}
              >
                {importing ? 'Mengimport...' : `Mulai Import ${preview.tx_count} Transaksi`}
              </button>
              <button
                onClick={() => { setPreview(null); setRawJson(null); setFileName(null); if (fileRef.current) fileRef.current.value = '' }}
                style={{ padding: '10px 16px', borderRadius: 8, border: '.5px solid #ccc', background: '#fff', fontSize: 13, cursor: 'pointer' }}
              >
                Batal
              </button>
            </div>

            {importErr && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#fee2e2', borderRadius: 8, fontSize: 12, color: '#b42318' }}>
                {importErr}
              </div>
            )}
          </div>
        )}

        {/* Hasil Import */}
        {result && (
          <div style={{ background: '#fff', border: '.5px solid rgba(0,0,0,.09)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#064733', textTransform: 'uppercase', letterSpacing: '.9px', marginBottom: '1rem', paddingBottom: 8, borderBottom: '1px solid #e8e0d0' }}>
              Hasil Import
            </div>

            <div style={{ background: '#dcfce7', borderRadius: 10, padding: '12px 16px', marginBottom: '1rem' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>✓ Import selesai</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Mitra baru dibuat',       val: result.created_drivers,    color: '#15803d' },
                { label: 'Perusahaan baru dibuat',  val: result.created_companies,  color: '#15803d' },
                { label: 'Transaksi diimport',       val: result.imported_tx,        color: '#15803d' },
                { label: 'Transaksi dilewati (duplikat/error)', val: result.skipped_tx, color: '#b45309' },
                { label: 'Advance fee diimport',    val: result.imported_advance_fees, color: '#15803d' },
                { label: 'Advance fee dilewati',    val: result.skipped_advance_fees,  color: result.skipped_advance_fees > 0 ? '#b45309' : '#888' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '.5px solid rgba(0,0,0,.06)' }}>
                  <span style={{ color: '#444' }}>{label}</span>
                  <span style={{ fontWeight: 600, color }}>{val}</span>
                </div>
              ))}
            </div>

            {result.tx_errors && result.tx_errors.length > 0 && (
              <details style={{ marginTop: '1rem' }}>
                <summary style={{ fontSize: 12, color: '#b42318', cursor: 'pointer' }}>
                  {result.tx_errors.length} error saat import →
                </summary>
                <div style={{ marginTop: 8, padding: '8px 12px', background: '#fee2e2', borderRadius: 8, fontSize: 11, color: '#b42318' }}>
                  {result.tx_errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              </details>
            )}

            <div style={{ marginTop: '1rem', display: 'flex', gap: 10 }}>
              <Link
                href="/admin/commission-tracker"
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#064733', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', display: 'block' }}
              >
                Buka Commission Tracker →
              </Link>
              <button
                onClick={() => { setResult(null); setPreview(null); setRawJson(null); setFileName(null); if (fileRef.current) fileRef.current.value = '' }}
                style={{ padding: '10px 16px', borderRadius: 8, border: '.5px solid #ccc', background: '#fff', fontSize: 13, cursor: 'pointer' }}
              >
                Import Lagi
              </button>
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <Link href="/admin/commission-tracker" style={{ fontSize: 12, color: '#7a9a8a', textDecoration: 'none' }}>
            ← Kembali ke Commission Tracker
          </Link>
        </div>
      </div>
    </div>
  )
}
