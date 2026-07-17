'use client'

// Cetak label parfum — Brother PT-P900W (TZe 36mm black-on-white laminated)
// MVP: browser print dialog dengan @page 36×40mm.
// TODO(production): jalur via P-touch Template + print agent lokal (TCP ke
//   Brother PT-P900W di LAN toko via Wi-Fi) — belum dikerjakan di MVP.

// no react imports needed

interface Props {
  perfumeName:  string
  perfumeSize:  string   // e.g. "50 ml"
  perfumeType:  string   // e.g. "EXTRAIT DE PARFUM"
  printQty:     number
  orderItemId:  string   // UUID order_item
  orderDate:    string   // ISO timestamp order dibuat
}

// Format batch code: YYMMDD-XXXXXXXX-001
// YYMMDD        = tanggal order
// XXXXXXXX      = 8 char pertama order_item_id (tanpa strip)
// 001            = nomor urut label (3 digit)
function makeBatchCode(orderItemId: string, orderDate: string, seq: number): string {
  const d    = new Date(orderDate)
  const yy   = String(d.getFullYear()).slice(2)
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const dd   = String(d.getDate()).padStart(2, '0')
  const code = orderItemId.replace(/-/g, '').slice(0, 8).toUpperCase()
  const s    = String(seq).padStart(3, '0')
  return `${yy}${mm}${dd}-${code}-${s}`
}

export function LabelPrintClient({ perfumeName, perfumeSize, perfumeType, printQty, orderItemId, orderDate }: Props) {
  const labels = Array.from({ length: printQty })

  return (
    <>
      {/* ── Kontrol (layar saja) ── */}
      <div id="screen-controls">
        <div style={{ position:'fixed', top:0, left:0, right:0, background:'#fff', borderBottom:'1px solid #ddd', padding:'8px 16px', display:'flex', gap:8, alignItems:'center', zIndex:10, boxShadow:'0 1px 4px rgba(0,0,0,.08)' }}>
          <button
            onClick={() => window.print()}
            style={{ height:32, padding:'0 16px', borderRadius:6, background:'#064733', color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer' }}
          >
            Cetak Label
          </button>
          <button
            onClick={() => window.close()}
            style={{ height:32, padding:'0 16px', borderRadius:6, background:'#fff', color:'#3d2e26', fontSize:13, fontWeight:500, border:'1px solid #ccc', cursor:'pointer' }}
          >
            Tutup
          </button>
          <span style={{ fontSize:12, color:'#6f6256', marginLeft:8 }}>
            {printQty} label · {perfumeName} · {perfumeSize}
          </span>
          <span style={{ fontSize:11, color:'#aaa', marginLeft:'auto' }}>
            Brother PT-P900W · TZe 36mm · 36×40mm
          </span>
          <span style={{ fontSize:11, color:'#b45309', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:4, padding:'2px 8px', marginLeft:8 }}>
            ⚠ Windows: di dialog print → Paper size = 36×40mm · matikan Headers and footers
          </span>
        </div>

        {/* ── Preview layar: 3× scale ── */}
        <div style={{ background:'#f0ece8', minHeight:'100vh', display:'flex', flexWrap:'wrap', gap:24, padding:'72px 24px 32px', alignItems:'flex-start', justifyContent:'center' }}>
          {labels.map((_, i) => (
            <div key={i} className="label-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo-web-bold.svg" alt="Scentsored" className="lp-logo" />
              <p className="lp-name">{perfumeName}</p>
              <div className="lp-bottom">
                <p className="lp-size">{perfumeSize}</p>
                <p className="lp-type">{perfumeType}</p>
                <p className="lp-batch">{makeBatchCode(orderItemId, orderDate, i + 1)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Print output: actual 32×40mm ── */}
      <div id="print-labels">
        {labels.map((_, i) => (
          <div key={i} className="label-print">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-web-bold.svg" alt="Scentsored" className="lp-logo" />
            <p className="lp-name">{perfumeName}</p>
            <div className="lp-bottom">
              <p className="lp-size">{perfumeSize}</p>
              <p className="lp-type">{perfumeType}</p>
              <p className="lp-batch">{makeBatchCode(orderItemId, orderDate, i + 1)}</p>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        /* ── Shared text styles ── */
        .lp-name, .lp-size, .lp-type {
          margin: 0;
          text-align: center;
          color: #000;
          font-family: 'Inter Tight', system-ui, sans-serif;
        }

        /* ══ SCREEN PREVIEW (3× of print) ══ */
        #print-labels { display: none; }

        .label-preview {
          width: min(108mm, 90vw);
          height: min(120mm, calc(90vw * 40 / 36));
          background: #fff;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 6mm 4mm;
          border: 1px dashed #bbb;
        }

        .label-preview .lp-logo {
          height: 31mm;
          width: auto;
          object-fit: contain;
          margin-top: 6mm;
        }
        .label-preview .lp-name {
          font-family: 'Chatime', Georgia, serif;
          font-size: 24pt;
          font-weight: 700;
          line-height: 1.2;
          margin: 0;
          word-break: break-word;
          hyphens: auto;
          text-transform: uppercase;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .label-preview .lp-bottom {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5mm;
          margin-bottom: 6mm;
        }
        .label-preview .lp-size {
          font-size: 16.5pt;
          font-weight: 700;
          letter-spacing: .06em;
          margin: 0;
        }
        .label-preview .lp-type {
          font-size: 12pt;
          font-weight: 600;
          letter-spacing: .14em;
          text-transform: uppercase;
          margin: 0;
        }
        .label-preview .lp-batch {
          font-size: 8pt;
          font-weight: 700;
          letter-spacing: .05em;
          color: #333;
          margin: 0;
          margin-top: 1.5mm;
          font-family: 'Courier New', monospace;
        }

        /* ══ PRINT OUTPUT ══ */
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          #screen-controls { display: none !important; }
          #print-labels    { display: block !important; }

          /*
           * margin: 0 → menghilangkan area header/footer browser (URL, jam, halaman).
           * Jika Windows Chrome/Edge masih muncul: buka More settings → matikan
           * "Headers and footers". Paper size harus diset ke 36×40mm di print dialog.
           */
          @page {
            size: 36mm 40mm;
            margin: 0;
          }

          .label-print {
            width: 36mm;
            height: 40mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            padding: 2mm 2mm;
            page-break-inside: avoid;
            background: white;
            overflow: hidden;
          }
          .label-print:not(:last-child) {
            page-break-after: always;
          }

          .label-print .lp-logo {
            height: 11mm;
            width: auto;
            object-fit: contain;
            margin-top: 1.5mm;
            /* double drop-shadow menebalkan stroke logo di plastik */
            }
          .label-print .lp-name {
            font-family: 'Chatime', Georgia, serif;
            font-size: 8pt;
            font-weight: 700;
            line-height: 1.2;
            margin: 0;
            word-break: break-word;
            hyphens: auto;
            text-transform: uppercase;
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .label-print .lp-bottom {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5mm;
            margin-bottom: 1.5mm;
          }
          .label-print .lp-size {
            font-size: 5.5pt;
            font-weight: 700;
            letter-spacing: .06em;
            margin: 0;
          }
          .label-print .lp-type {
            font-size: 4pt;
            font-weight: 600;
            letter-spacing: .12em;
            text-transform: uppercase;
            margin: 0;
          }
          .label-print .lp-batch {
            font-size: 3.5pt;
            font-weight: 700;
            letter-spacing: .04em;
            color: #000;
            margin: 0;
            margin-top: 0.5mm;
            font-family: 'Courier New', monospace;
          }
        }
      `}</style>
    </>
  )
}
